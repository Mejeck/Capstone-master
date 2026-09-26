import { Head, Link, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import {
    ShoppingCart,
    Package,
    Search,
    X,
    CheckCircle,
    Clock,
    AlertTriangle,
    FileText,
    DollarSign,
    Trash2,
    CreditCard,
    Ban
} from 'lucide-react';
import { router } from '@inertiajs/react';
import { type SharedData } from '@/types';
import CustomerNav from '@/components/CustomerNav';
import { getCartStorageKey } from '@/lib/cart';
import { getStatusColor } from '@/lib/order-status';
import { computeOrderTotal, useOrderTotals } from '@/hooks/useOrderTotals';
import { useOrderForm } from '@/hooks/useOrderForm';
import { usePreOrders } from '@/hooks/usePreOrders';
import { showToast } from '@/lib/toast';
import { usePaymentProofUpload } from '@/hooks/usePaymentProofUpload';
import { useSubmitOrder } from '@/hooks/useSubmitOrder';
import OrderTypeSelector from '@/components/customer/OrderTypeSelector';
import PaymentMethodSelector from '@/components/customer/PaymentMethodSelector';
import DownPaymentNotice from '@/components/customer/DownPaymentNotice';
import DeliveryAddressFields from '@/components/customer/DeliveryAddressFields';
import PickupLocationInfo from '@/components/customer/PickupLocationInfo';
import OrderSummaryList from '@/components/customer/OrderSummaryList';
import PreOrdersModal from '@/components/customer/PreOrdersModal';
import GCashProofModal from '@/components/customer/GCashProofModal';
import CodProofModal from '@/components/customer/CodProofModal';
import OrderSuccessModal from '@/components/customer/OrderSuccessModal';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirmModal } from '@/hooks/useConfirmModal';
import QuantityInput, { toStockCount } from '@/components/customer/QuantityInput';

// GCash-rejected notice acknowledgement: persisted per-user in localStorage so
// clicking "Got it" keeps it dismissed across page loads/future visits, not
// just for the current page view. Keyed by order id -> the
// gcash_rejected_count already shown for it, so a *new* rejection on the
// same order (after the customer resubmits and gets rejected again) still
// surfaces a fresh notice.
function getGCashRejectedAckKey(userId: number | string | null | undefined): string {
    return userId ? `mejeck_gcash_rejected_ack_${userId}` : 'mejeck_gcash_rejected_ack_guest';
}

function readGCashRejectedAckMap(key: string): Record<number, number> {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

interface Product {
    product_id: number;
    product_name: string;
    category: string;
    description: string | null;
    unit: string;
    price: number;
    price_per_case: number | null;
    price_per_case_cold: number | null;
    price_per_bottle: number | null;
    image: string | null;
    current_quantity: number;
    min_stock_level: number;
    is_low_stock: boolean;
    variants?: Product[];
    hasVariants?: boolean;
}

interface UserAddress {
    id: number;
    label: string | null;
    house_no: string | null;
    street: string | null;
    barangay_name: string | null;
    municipality: string | null;
    landmark: string | null;
    barangay: string | null;
    purok: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    is_default: boolean;
    full_address: string;
}

interface Order {
    order_id: number;
    total_amount: number;
    status: string;
    order_date: string;
    order_type: string;
    payment_method?: string;
    payment_status?: string;
    gcash_screenshot?: string | null;
    gcash_resubmit_count?: number;
    gcash_rejected_count?: number;
    gcash_flagged?: boolean;
    down_payment?: number;
    customer: {
        first_name: string;
        last_name: string;
    };
}

interface CustomerDashboardProps {
    recentOrders: Order[];
    products: Product[];
    categories: { id: number; category_name: string }[];
    stats: {
        totalOrders: number;
        pendingOrders: number;
        completedOrders: number;
        totalSpent: number;
    };
    addresses?: UserAddress[];
    deliveryFeeSettings?: {
        in_town_fee: number;
        out_of_town_fee: number;
        in_town_municipality: string;
    };
}

export default function CustomerDashboard({ recentOrders, products, categories, stats, addresses = [], deliveryFeeSettings }: CustomerDashboardProps) {
    const { auth } = usePage<SharedData>().props;
    const cartStorageKey = getCartStorageKey(auth.user?.id);
    const gcashRejectedAckKey = getGCashRejectedAckKey(auth.user?.id);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<{ productId: number; quantity: number; kiloAmount?: number; orderType?: 'kilo' | 'bottle' | 'case'; isCold?: boolean }[]>(() => {
        try {
            const saved = localStorage.getItem(cartStorageKey);
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [quantities, setQuantities] = useState<{ [key: number]: number }>({});
    const [selectedKilo, setSelectedKilo] = useState<{ [key: number]: number }>({});
    const [bottleQuantities, setBottleQuantities] = useState<{ [key: number]: number }>({});
    const [selectedVariant, setSelectedVariant] = useState<{ [key: string]: Product }>({});
    const [showOrderModal, setShowOrderModal] = useState(false);
    const {
        preOrders,
        showPreOrdersModal,
        setShowPreOrdersModal,
        fetchPreOrders,
    } = usePreOrders<Order>();
    const [selectedPreOrder, setSelectedPreOrder] = useState<Order | null>(null);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    // Dashboard-only pre-order checkout mutation (completePreOrderCheckout) —
    // kept separate from useSubmitOrder's own isPlacingOrder since it's a
    // different network call to a different endpoint.
    const [isPreOrderCheckoutProcessing, setIsPreOrderCheckoutProcessing] = useState(false);
    const [showGCashModal, setShowGCashModal] = useState(false);
    const [gCashOrderData, setGCashOrderData] = useState<any>(null);
    const [showResubmitModal, setShowResubmitModal] = useState(false);
    const [resubmitOrder, setResubmitOrder] = useState<Order | null>(null);
    const [resubmitScreenshot, setResubmitScreenshot] = useState<File | null>(null);
    const [resubmitUploading, setResubmitUploading] = useState(false);
    const [resubmitDone, setResubmitDone] = useState(false);
    const { upload: uploadGcashResubmitProof } = usePaymentProofUpload('gcash');
    const [showCodModal, setShowCodModal] = useState(false);
    const [codOrderData, setCodOrderData] = useState<any>(null);
    // Order success modal (Cash + dine-in, i.e. no proof-upload step).
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    // Centered confirm() replacement, shared by every confirmation prompt on
    // this page (currently just "place this order?").
    const { confirm, confirmModalProps } = useConfirmModal();
    const [showCompletedOrders, setShowCompletedOrders] = useState(false);
    const [isBuyNow, setIsBuyNow] = useState(false);
    const [buyNowCart, setBuyNowCart] = useState<{ productId: number; quantity: number; kiloAmount?: number; orderType?: 'kilo' | 'bottle' | 'case'; isCold?: boolean }[]>([]);
    const [caseQuantities, setCaseQuantities] = useState<{ [key: number]: number }>({});
    const [selectedBeverageType, setSelectedBeverageType] = useState<{ [key: number]: 'case' | 'bottle' }>({});
    // Only meaningful when the case package type is selected: whether the
    // customer wants the chilled (pricier) case instead of the regular one.
    // Cold is never offered by the bottle.
    const [coldSelections, setColdSelections] = useState<{ [key: number]: boolean }>({});
    const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
    // GCash-rejected notice: was an inline banner sitting wherever it fell in
    // the page flow (easy to miss if scrolled past); now a centered pop-up
    // like the rest of the app's notifications. Only shows for a rejection
    // the customer hasn't already acknowledged (see gcashRejectedAckKey) —
    // clicking "Got it" is a one-time acknowledgement per rejection, not
    // just a per-page-view dismissal, so it won't pop up again on the next
    // visit unless a new GCash rejection happens after that.
    const [showGCashRejectedModal, setShowGCashRejectedModal] = useState(() => {
        const ackMap = readGCashRejectedAckMap(gcashRejectedAckKey);
        return recentOrders.some(o =>
            o.payment_method === 'GCash' && o.payment_status === 'Unpaid' && o.gcash_screenshot
            && (o.gcash_rejected_count ?? 0) > (ackMap[o.order_id] ?? 0)
        );
    });

    // Marks every currently-shown GCash rejection as acknowledged (so it
    // won't resurface) and closes the notice.
    const dismissGCashRejectedModal = () => {
        try {
            const ackMap = readGCashRejectedAckMap(gcashRejectedAckKey);
            recentOrders.forEach(o => {
                if (o.payment_method === 'GCash' && o.payment_status === 'Unpaid' && o.gcash_screenshot) {
                    ackMap[o.order_id] = o.gcash_rejected_count ?? 0;
                }
            });
            localStorage.setItem(gcashRejectedAckKey, JSON.stringify(ackMap));
        } catch {
            // localStorage unavailable (private browsing, quota, etc.) — the
            // notice will just show again next load, which is a safe
            // fallback rather than losing the dismissal silently.
        }
        setShowGCashRejectedModal(false);
    };
    const {
        orderForm,
        setOrderForm,
        selectedAddressId,
        handleAddressSelectChange,
        resetOrderForm,
    } = useOrderForm(addresses, { prefillWhen: showOrderModal });

    // Picks up the flag the pre-order checkout handler stashed right before
    // reloading — see the comment there for why the toast couldn't just fire
    // from there.
    useEffect(() => {
        if (sessionStorage.getItem('preOrderCheckoutSuccess') === '1') {
            sessionStorage.removeItem('preOrderCheckoutSuccess');
            showToast('success', 'Pre-order checkout successful!');
        }
    }, []);

    // Esc closes whichever modal is currently on top, respecting the same
    // guards as their X buttons (e.g. mid-upload steps can't be dismissed).
    useEffect(() => {
        const anyModalOpen = quickViewProduct || showOrderModal || showPreOrdersModal
            || showCheckoutModal || showGCashModal || showCodModal || showResubmitModal || showSuccessModal
            || confirmModalProps.open || showGCashRejectedModal;
        if (!anyModalOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (confirmModalProps.open) {
                confirmModalProps.onCancel();
            } else if (showGCashRejectedModal) {
                dismissGCashRejectedModal();
            } else if (showSuccessModal) {
                setShowSuccessModal(false);
                window.location.reload();
            } else if (showResubmitModal) {
                if (resubmitUploading) return;
                setShowResubmitModal(false);
                setResubmitOrder(null);
                setResubmitScreenshot(null);
                setResubmitDone(false);
            } else if (showCodModal) {
                setShowCodModal(false);
                setCodOrderData(null);
                setShowOrderModal(false);
            } else if (showGCashModal) {
                // GCashProofModal owns its own Esc handling (it blocks closing
                // while its internal step is 'upload') — this branch only
                // needs to consume the keypress so it doesn't fall through.
            } else if (showCheckoutModal) {
                setShowCheckoutModal(false);
                setSelectedPreOrder(null);
            } else if (showPreOrdersModal) {
                setShowPreOrdersModal(false);
            } else if (showOrderModal) {
                setShowOrderModal(false);
            } else if (quickViewProduct) {
                setQuickViewProduct(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [quickViewProduct, showOrderModal, showPreOrdersModal, showCheckoutModal, showGCashModal, showCodModal, showResubmitModal, resubmitUploading, showSuccessModal, confirmModalProps.open, showGCashRejectedModal]);

    // Persist cart to localStorage on every change
    useEffect(() => {
        localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    }, [cart, cartStorageKey]);

    const filteredProducts = products.filter(product => {
        const matchesCategory = selectedCategory === null || product.category === selectedCategory;
        const matchesSearch = product.product_name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Group products by name for ice tubes (same name, different units)
    const groupedProducts = filteredProducts.reduce((acc, product) => {
        const key = product.product_name;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(product);
        return acc;
    }, {} as Record<string, Product[]>);

    // Convert to array and determine if each group should show dropdown
    const displayProducts = Object.entries(groupedProducts).map(([name, variants]) => {
        // Prioritize products with images and remove duplicates without images
        const sortedVariants = variants.sort((a, b) => {
            // Prioritize products with images
            if (a.image && !b.image) return -1;
            if (!a.image && b.image) return 1;
            return 0;
        });
        
        // If multiple variants with same name, show as single card with dropdown
        if (sortedVariants.length > 1) {
            return {
                ...sortedVariants[0], // Use first variant (prioritized with image) as base
                variants: sortedVariants,
                hasVariants: true,
            };
        }
        return {
            ...sortedVariants[0],
            variants: [],
            hasVariants: false,
        };
    }).filter((product, index, self) => {
        // Remove exact duplicates based on product_id and image
        const isDuplicate = self.findIndex(p => p.product_id === product.product_id) === index;

        // Additionally, remove 'Red Horse' products without an image
        if (product.product_name === 'Red Horse' && !product.image) {
            return false; // Exclude this specific 'Red Horse' product without an image
        }

        return isDuplicate;
    });

    // Get unique categories from available products
    const availableCategories = [...new Set(products.map(p => p.category))];

    // Beverages are age-restricted (18+). Returns true (and warns) if this
    // product should be blocked for the current customer.
    const blockIfUnderageForBeverage = (productId: number): boolean => {
        const product = products.find(p => p.product_id === productId);
        if (product?.category === 'Beverages' && !auth.user?.is_adult) {
            alert('Sorry, you cannot order beverages because you are still a minor. You must be 18 years old or above to order beverages.');
            return true;
        }
        return false;
    };

    const addToCart = (productId: number, orderType: 'kilo' | 'bottle' | 'case' = 'kilo') => {
        const product = products.find(p => p.product_id === productId);
        const isIceTube = product?.product_name?.toLowerCase().includes('ice tube');

        if (blockIfUnderageForBeverage(productId)) return;

        if (orderType === 'bottle' && !isIceTube) {
            // Bottle ordering for beverages
            const bottleQuantity = bottleQuantities[productId] || 1;
            if (bottleQuantity <= 0) return;

            setCart(prev => {
                const existing = prev.find(item => item.productId === productId && item.orderType === 'bottle');
                if (existing) {
                    return prev.map(item =>
                        item.productId === productId && item.orderType === 'bottle'
                            ? { ...item, quantity: item.quantity + bottleQuantity }
                            : item
                    );
                }
                return [...prev, { productId, quantity: bottleQuantity, orderType: 'bottle' }];
            });
            // Reset bottle quantity after adding
            setBottleQuantities(prev => ({ ...prev, [productId]: 0 }));
        } else if (orderType === 'case' && !isIceTube) {
            // Case ordering for beverages
            if (!product) return;
            const caseQty = caseQuantities[productId] || 1;
            setCart(prev => {
                const existing = prev.find(item => item.productId === productId && item.orderType === 'case');
                if (existing) {
                    return prev.map(item =>
                        item.productId === productId && item.orderType === 'case'
                            ? { ...item, quantity: item.quantity + caseQty }
                            : item
                    );
                }
                return [...prev, { productId, quantity: caseQty, orderType: 'case' }];
            });
            setCaseQuantities(prev => ({ ...prev, [productId]: 1 }));
        } else {
            // Kilo ordering for ice tubes - use the selected variant
            if (!product) return;
            const currentVariant = selectedVariant[product.product_name] || product;
            const kiloAmount = parseInt(currentVariant.unit) || 1;
            const quantity = quantities[productId] || 1;
            if (quantity <= 0) return;

            setCart(prev => {
                const existing = prev.find(item => item.productId === currentVariant.product_id && item.kiloAmount === kiloAmount);
                if (existing) {
                    return prev.map(item =>
                        item.productId === currentVariant.product_id && item.kiloAmount === kiloAmount
                            ? { ...item, quantity: item.quantity + quantity }
                            : item
                    );
                }
                return [...prev, { productId: currentVariant.product_id, quantity, kiloAmount, orderType: 'kilo' }];
            });
            // Reset quantity after adding
            setQuantities(prev => ({ ...prev, [productId]: 0 }));
        }
    };

    const buyNow = (productId: number, quantity: number, orderType: 'kilo' | 'bottle' | 'case' = 'kilo') => {
        const product = products.find(p => p.product_id === productId);
        if (!product || quantity <= 0) return;
        if (blockIfUnderageForBeverage(productId)) return;

        let item: { productId: number; quantity: number; kiloAmount?: number; orderType?: 'kilo' | 'bottle' | 'case' };

        if (orderType === 'kilo') {
            const currentVar = selectedVariant[product.product_name] || product;
            const kiloAmount = parseInt(currentVar.unit) || 1;
            item = { productId: currentVar.product_id, quantity, kiloAmount, orderType: 'kilo' };
        } else {
            item = { productId, quantity, orderType };
        }

        setBuyNowCart([item]);
        setIsBuyNow(true);
        setShowOrderModal(true);
    };

    // The quantity stepper displays `?? 1` (so it shows "1" the moment the
    // quick-view opens, before the customer touches +/-), but nothing ever
    // wrote that 1 into caseQuantities/bottleQuantities state. Reading it
    // back with `|| 0` therefore saw 0 and silently no-opped on the very
    // first click. This mirrors the display default so the two agree.
    const resolveBeverageQty = (productId: number) => {
        const product = products.find(p => p.product_id === productId);
        const isCase = (selectedBeverageType[productId] || (product?.price_per_case ? 'case' : 'bottle')) === 'case';
        const qty = isCase ? (caseQuantities[productId] ?? 1) : (bottleQuantities[productId] ?? 1);
        const isCold = isCase && !!coldSelections[productId] && !!product?.price_per_case_cold;
        return { isCase, qty, isCold };
    };

    const addBeverageToCart = (productId: number) => {
        const { isCase, qty, isCold } = resolveBeverageQty(productId);
        if (qty <= 0) return;
        if (blockIfUnderageForBeverage(productId)) return;

        const orderType = isCase ? 'case' : 'bottle';
        setCart(prev => {
            const existing = prev.find(item => item.productId === productId && item.orderType === orderType && !!item.isCold === isCold);
            if (existing) {
                return prev.map(item =>
                    item.productId === productId && item.orderType === orderType && !!item.isCold === isCold
                        ? { ...item, quantity: item.quantity + qty }
                        : item
                );
            }
            return [...prev, { productId, quantity: qty, orderType, isCold: isCold || undefined }];
        });

        if (isCase) setCaseQuantities(prev => ({ ...prev, [productId]: 0 }));
        else setBottleQuantities(prev => ({ ...prev, [productId]: 0 }));
    };

    const beverageBuyNow = (productId: number) => {
        const { isCase, qty, isCold } = resolveBeverageQty(productId);
        if (qty <= 0) return;
        if (blockIfUnderageForBeverage(productId)) return;

        const items: { productId: number; quantity: number; orderType: 'kilo' | 'bottle' | 'case'; isCold?: boolean }[] = [
            { productId, quantity: qty, orderType: isCase ? 'case' : 'bottle', isCold: isCold || undefined },
        ];

        setBuyNowCart(items);
        setIsBuyNow(true);
        setShowOrderModal(true);
    };

    const updateOrRemoveFromCart = (productId: number, newQuantity: number, kiloAmount: number) => {
        if (newQuantity <= 0) {
            // Remove from cart if quantity is 0
            setCart(prev => prev.filter(item => item.productId !== productId || item.kiloAmount !== kiloAmount));
        } else {
            // Update quantity in cart
            setCart(prev => {
                const existing = prev.find(item => item.productId === productId && item.kiloAmount === kiloAmount);
                if (existing) {
                    return prev.map(item =>
                        item.productId === productId && item.kiloAmount === kiloAmount
                            ? { ...item, quantity: newQuantity }
                            : item
                    );
                }
                return [...prev, { productId, quantity: newQuantity, kiloAmount }];
            });
        }
    };

    const handleQuantityChange = (productId: number, value: number) => {
        setQuantities(prev => ({ ...prev, [productId]: Math.max(0, value) }));
    };

    const removeFromCart = (productId: number, orderType?: string, kiloAmount?: number) => {
        if (kiloAmount !== undefined) {
            setCart(prev => prev.filter(item => item.productId !== productId || item.kiloAmount !== kiloAmount));
        } else if (orderType !== undefined) {
            setCart(prev => prev.filter(item => !(item.productId === productId && item.orderType === orderType)));
        } else {
            setCart(prev => prev.filter(item => item.productId !== productId));
        }
    };

    const updateCartQuantity = (productId: number, quantity: number, orderType?: string, kiloAmount?: number) => {
        if (quantity <= 0) {
            removeFromCart(productId, orderType, kiloAmount);
        } else {
            setCart(prev => {
                const existing = prev.find(item =>
                    item.productId === productId &&
                    (kiloAmount !== undefined ? item.kiloAmount === kiloAmount : item.orderType === orderType)
                );
                if (existing) {
                    return prev.map(item =>
                        item.productId === productId &&
                        (kiloAmount !== undefined ? item.kiloAmount === kiloAmount : item.orderType === orderType)
                            ? { ...item, quantity }
                            : item
                    );
                }
                return [...prev, { productId, quantity, orderType: orderType as any, kiloAmount }];
            });
        }
    };

    const placeOrder = async () => {
        if (cart.length === 0) return;
        setIsBuyNow(false);
        setShowOrderModal(true);
    };

    const checkoutPreOrder = (order: Order) => {
        setSelectedPreOrder(order);
        setShowPreOrdersModal(false);
        setShowCheckoutModal(true);
    };

    const completePreOrderCheckout = async () => {
        if (!selectedPreOrder) return;

        setIsPreOrderCheckoutProcessing(true);
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const response = await fetch(`/customer/orders/${selectedPreOrder.order_id}/checkout`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || '',
                },
                body: JSON.stringify({
                    payment_method: orderForm.payment_method,
                    delivery_address: orderForm.delivery_address,
                    delivery_municipality: orderForm.delivery_municipality,
                    delivery_barangay: orderForm.delivery_barangay,
                    delivery_purok: orderForm.delivery_purok,
                    delivery_city: orderForm.delivery_city,
                    delivery_province: orderForm.delivery_province,
                    delivery_postal_code: orderForm.delivery_postal_code,
                    delivery_latitude: orderForm.delivery_latitude,
                    delivery_longitude: orderForm.delivery_longitude,
                }),
            });

            if (response.ok) {
                // A toast dispatched right before reload would never be seen —
                // the page (and the FlashToaster listening for it) unmounts
                // before it can render. Stash a flag and show it after the
                // reload instead, once this page's own mount effect picks it up.
                sessionStorage.setItem('preOrderCheckoutSuccess', '1');
                setShowCheckoutModal(false);
                setSelectedPreOrder(null);
                resetOrderForm();
                window.location.reload();
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to checkout pre-order');
            }
        } catch (error) {
            console.error('Error checking out pre-order:', error);
            alert('Failed to checkout pre-order');
        } finally {
            setIsPreOrderCheckoutProcessing(false);
        }
    };

    // "Done" on the GCash/COD proof modals — unchanged behavior: clear the
    // persisted multi-item cart (not buyNowCart/isBuyNow — mirrors the
    // original inline handlers exactly), close the order modal, and reload.
    const handleGCashDone = () => {
        setShowGCashModal(false);
        setGCashOrderData(null);
        setCart([]);
        setShowOrderModal(false);
        window.location.reload();
    };

    const handleCodDone = () => {
        setShowCodModal(false);
        setCodOrderData(null);
        setCart([]);
        setShowOrderModal(false);
        window.location.reload();
    };

    const cartTotal = computeOrderTotal(cart, products);
    const activeOrderItems = isBuyNow ? buyNowCart : cart;
    const {
        total: activeOrderTotal,
        subtotalExclVAT: activeOrderSubtotalExclVAT,
        vatAmount: activeOrderVATAmount,
        deliveryFee: activeOrderDeliveryFee,
        grandTotal: activeOrderGrandTotal,
    } = useOrderTotals(activeOrderItems, products, orderForm, deliveryFeeSettings);
    const { submitOrder, isPlacingOrder } = useSubmitOrder({
        items: activeOrderItems,
        products,
        orderForm,
        onGCashCreated: (data) => {
            setShowOrderModal(false);
            setShowGCashModal(true);
            setGCashOrderData(data);
        },
        onCodRequired: (data) => {
            setShowOrderModal(false);
            setShowCodModal(true);
            setCodOrderData(data);
        },
        onImmediateSuccess: () => {
            setCart([]);
            setBuyNowCart([]);
            setIsBuyNow(false);
            setShowOrderModal(false);
            resetOrderForm();
            setShowSuccessModal(true);
        },
        confirmPlaceOrder: confirm,
    });

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
            <Head title="Customer Dashboard" />
            <CustomerNav currentPage="home" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
                {/* Order Status Notification */}
                {recentOrders.some(order => order.status === 'Delivered' || order.status === 'Completed') && (
                    <div className="mb-6">
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                    {recentOrders.filter(o => o.status === 'Delivered' || o.status === 'Completed').length} order(s) successfully delivered and completed
                                </p>
                            </div>
                            <button
                                onClick={() => setShowCompletedOrders(prev => !prev)}
                                className="text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 font-medium transition-colors"
                            >
                                {showCompletedOrders ? 'Hide Orders' : 'View Orders'}
                            </button>
                        </div>

                        {showCompletedOrders && (
                            <div className="mt-3 space-y-3">
                                {recentOrders
                                    .filter(o => o.status === 'Delivered' || o.status === 'Completed')
                                    .map(order => (
                                        <div
                                            key={order.order_id}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-lg border border-green-200 dark:border-green-800 gap-3"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white text-sm">Order #{order.order_id}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(order.order_date).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 sm:gap-4">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                                    {order.status}
                                                </span>
                                                <span className="font-bold text-gray-900 dark:text-white text-sm">₱{Number(order.total_amount).toFixed(2)}</span>
                                                <Link
                                                    href={route('customer.orders.show', order.order_id)}
                                                    className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
                                                >
                                                    Details
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Products Section */}
                <div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
                            {/* Search and Filter */}
                            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="Search products..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                    />
                                </div>
                                <select
                                    value={selectedCategory ?? ''}
                                    onChange={(e) => setSelectedCategory(e.target.value || null)}
                                    className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                >
                                    <option value="">All Categories</option>
                                    {availableCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Products Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                {displayProducts.map((product) => {
                                    const productImage = product.image ? `/${product.image}` : null;
                                    const currentVariant = selectedVariant[product.product_name] || (product.hasVariants ? product.variants?.[0] : product);
                                    const displayPrice = currentVariant?.price || product.price;
                                    const displayUnit = currentVariant?.unit || product.unit;
                                    const isBeverage = !!(product.price_per_case || product.price_per_bottle);

                                    return (
                                        <div
                                            key={product.product_id}
                                            onClick={() => setQuickViewProduct(product)}
                                            className="group cursor-pointer bg-white dark:bg-slate-700 rounded-xl overflow-hidden border-2 border-gray-300 dark:border-slate-400 shadow-sm hover:border-cyan-500 dark:hover:border-cyan-500 hover:-translate-y-2 hover:shadow-[0_8px_30px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all duration-300"
                                        >
                                            {/* Product Image */}
                                            <div className="relative h-72 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 overflow-hidden">
                                                {productImage ? (
                                                    <img
                                                        src={productImage}
                                                        alt={product.product_name}
                                                        loading="lazy"
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.style.display = 'none';
                                                            const parent = target.parentElement;
                                                            if (parent && !parent.querySelector('.fallback-icon')) {
                                                                const fallback = document.createElement('div');
                                                                fallback.className = 'fallback-icon absolute inset-0 flex items-center justify-center';
                                                                fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-cyan-300 dark:text-cyan-600"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>';
                                                                parent.appendChild(fallback);
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Package className="w-16 h-16 text-cyan-300 dark:text-cyan-600" />
                                                    </div>
                                                )}
                                                {/* View Details overlay */}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-end p-4 pointer-events-none">
                                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-cyan-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
                                                        View Details
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Card Body */}
                                            <div className="p-5">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                                                            {product.product_name}
                                                        </h3>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">{product.category}</p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-2 ${
                                                        product.is_low_stock
                                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                    }`}>
                                                        {product.is_low_stock ? 'Low Stock' : 'In Stock'}
                                                    </span>
                                                </div>

                                                {/* Price */}
                                                <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400 mb-2">
                                                    {isBeverage ? (
                                                        <>
                                                            {product.price_per_case ? `₱${Number(product.price_per_case).toFixed(2)}/case` : ''}
                                                            {product.price_per_case && product.price_per_bottle ? ' • ' : ''}
                                                            {product.price_per_bottle ? `₱${Number(product.price_per_bottle).toFixed(2)}/bottle` : ''}
                                                        </>
                                                    ) : (
                                                        <>
                                                            ₱{Number(displayPrice).toFixed(2)}
                                                            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">/{displayUnit}</span>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Description */}
                                                {product.description && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                                        {product.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {displayProducts.length === 0 && (
                                <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                                    <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                    <p className="text-sm font-medium">No products found</p>
                                </div>
                            )}
                        </div>
                    </div>

                {/* Account Blocked Banner */}
                {!!(auth.user as any)?.is_blocked && (
                    <div className="mt-6 bg-gray-900 dark:bg-gray-950 border border-gray-700 rounded-lg p-4 flex items-start gap-3">
                        <Ban className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-white">Your account has been blocked</p>
                            <p className="text-sm text-gray-300 mt-0.5">
                                You cannot place new orders or submit payment proofs. Please contact the store for assistance.
                            </p>
                            {(auth.user as any)?.blocked_reason && (
                                <p className="text-sm text-gray-400 mt-1">
                                    Reason: <span className="italic">{(auth.user as any).blocked_reason}</span>
                                </p>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* Quick View Modal */}
            {quickViewProduct && (() => {
                const product = quickViewProduct;
                const productImage = product.image ? `/${product.image}` : null;
                const currentVariant = selectedVariant[product.product_name] || (product.hasVariants ? product.variants?.[0] : product);
                const displayPrice = currentVariant?.price || product.price;
                const displayUnit = currentVariant?.unit || product.unit;
                const isBeverage = !!(product.price_per_case || product.price_per_bottle);
                const pid = product.product_id;
                // Beverages have no variants, so the base product carries the
                // real stock; a kilo product's stock lives on whichever
                // variant is currently selected.
                const stockSource = isBeverage ? product : (currentVariant || product);
                const modalStock = toStockCount(stockSource.current_quantity);
                const modalLowStock = stockSource.is_low_stock;

                return (
                    <div
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                        onClick={() => setQuickViewProduct(null)}
                    >
                        <div
                            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="relative h-64 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 overflow-hidden rounded-t-2xl">
                                {productImage ? (
                                    <img src={productImage} alt={product.product_name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Package className="w-16 h-16 text-cyan-300 dark:text-cyan-600" />
                                    </div>
                                )}
                                <button
                                    onClick={() => setQuickViewProduct(null)}
                                    aria-label="Close"
                                    className="absolute top-3 right-3 p-2.5 bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 rounded-full shadow-md transition-colors"
                                >
                                    <X className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{product.product_name}</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{product.category}</p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ml-2 whitespace-nowrap ${
                                        modalStock === 0
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                            : modalLowStock
                                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                    }`}>
                                        {modalStock === 0 ? 'Out of Stock' : `${modalLowStock ? 'Low Stock' : 'In Stock'} · ${modalStock} left`}
                                    </span>
                                </div>

                                {product.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-300">{product.description}</p>
                                )}

                                {/* Variant selector */}
                                {product.hasVariants && product.variants && product.variants.length > 0 && (
                                    <select
                                        value={currentVariant?.product_id}
                                        onChange={(e) => {
                                            const variant = product.variants?.find(v => v.product_id === Number(e.target.value));
                                            if (variant) setSelectedVariant(prev => ({ ...prev, [product.product_name]: variant }));
                                        }}
                                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                    >
                                        {product.variants.map((variant) => (
                                            <option key={variant.product_id} value={variant.product_id}>
                                                {variant.unit} — ₱{Number(variant.price).toFixed(2)}
                                            </option>
                                        ))}
                                    </select>
                                )}

                                {isBeverage ? (() => {
                                    const bevType = selectedBeverageType[pid] || (product.price_per_case ? 'case' : 'bottle');
                                    const isCase = bevType === 'case';
                                    const bevQty = isCase ? (caseQuantities[pid] ?? 1) : (bottleQuantities[pid] ?? 1);
                                    const isCold = isCase && !!coldSelections[pid] && !!product.price_per_case_cold;
                                    const bevPrice = isCase
                                        ? Number((isCold ? product.price_per_case_cold : product.price_per_case) || 0)
                                        : Number(product.price_per_bottle || 0);
                                    const setBevQty = (val: number) => isCase
                                        ? setCaseQuantities(prev => ({ ...prev, [pid]: Math.max(0, val) }))
                                        : setBottleQuantities(prev => ({ ...prev, [pid]: Math.max(0, val) }));
                                    const switchType = (type: 'case' | 'bottle') => {
                                        setSelectedBeverageType(prev => ({ ...prev, [pid]: type }));
                                        if (type === 'case') setBottleQuantities(prev => { const next = { ...prev }; delete next[pid]; return next; });
                                        else {
                                            setCaseQuantities(prev => { const next = { ...prev }; delete next[pid]; return next; });
                                            // Cold is only offered by the case.
                                            setColdSelections(prev => { const next = { ...prev }; delete next[pid]; return next; });
                                        }
                                    };
                                    return (
                                        <div className="space-y-2.5">
                                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Package Type: <span className="text-gray-900 dark:text-white">{isCase ? 'Case' : 'Bottle'}</span>
                                            </p>
                                            <div className="flex gap-2">
                                                {product.price_per_case && (
                                                    <button
                                                        onClick={() => switchType('case')}
                                                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                                            isCase
                                                                ? 'bg-gray-900 dark:bg-slate-100 text-white dark:text-gray-900 border-gray-900 dark:border-slate-100'
                                                                : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-500 hover:border-gray-500'
                                                        }`}
                                                    >Case</button>
                                                )}
                                                {product.price_per_bottle && (
                                                    <button
                                                        onClick={() => switchType('bottle')}
                                                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                                            !isCase
                                                                ? 'bg-gray-900 dark:bg-slate-100 text-white dark:text-gray-900 border-gray-900 dark:border-slate-100'
                                                                : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-500 hover:border-gray-500'
                                                        }`}
                                                    >Bottle</button>
                                                )}
                                            </div>
                                            {isCase && product.price_per_case_cold && (
                                                <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none w-fit">
                                                    <input
                                                        type="checkbox"
                                                        checked={isCold}
                                                        onChange={(e) => setColdSelections(prev => ({ ...prev, [pid]: e.target.checked }))}
                                                        className="w-3.5 h-3.5 rounded border-gray-300 dark:border-slate-500 text-cyan-500 focus:ring-cyan-500"
                                                    />
                                                    Cold (+₱{(Number(product.price_per_case_cold) - Number(product.price_per_case || 0)).toFixed(2)})
                                                </label>
                                            )}
                                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                                                ₱{bevPrice.toFixed(2)}
                                                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">/{isCase ? (isCold ? 'case (cold)' : 'case') : 'bottle'}</span>
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">Qty:</span>
                                                <QuantityInput
                                                    value={bevQty}
                                                    onChange={setBevQty}
                                                    max={product.current_quantity}
                                                    size="sm"
                                                    className="w-28 flex-shrink-0"
                                                    inputClassName="text-xs w-8"
                                                />
                                                <button
                                                    onClick={() => { addBeverageToCart(pid); setQuickViewProduct(null); }}
                                                    disabled={bevQty <= 0}
                                                    className="flex-1 flex items-center justify-center gap-1 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white h-9 rounded-lg text-xs font-semibold transition-colors"
                                                >
                                                    <ShoppingCart className="w-3.5 h-3.5" />
                                                    Add to Cart
                                                </button>
                                                <button
                                                    onClick={() => { beverageBuyNow(pid); setQuickViewProduct(null); }}
                                                    disabled={bevQty <= 0}
                                                    className="flex-1 flex items-center justify-center gap-1 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white h-9 rounded-lg text-xs font-semibold transition-colors"
                                                >
                                                    <CreditCard className="w-3.5 h-3.5" />
                                                    Buy Now
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })() : (
                                    <div className="space-y-3">
                                        <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                                            ₱{Number(displayPrice).toFixed(2)}
                                            <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">/{displayUnit}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">Qty:</span>
                                            <QuantityInput
                                                value={quantities[currentVariant?.product_id || pid] || 1}
                                                onChange={(val) => handleQuantityChange(currentVariant?.product_id || pid, Math.max(1, val))}
                                                min={1}
                                                max={(currentVariant || product).current_quantity}
                                                className="flex-1"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => { addToCart(currentVariant?.product_id || pid); setQuickViewProduct(null); }}
                                                className="flex items-center justify-center gap-1.5 bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white py-2.5 rounded-lg text-xs font-semibold transition-colors"
                                            >
                                                <ShoppingCart className="w-3.5 h-3.5" />
                                                Add to Cart
                                            </button>
                                            <button
                                                onClick={() => {
                                                    buyNow(currentVariant?.product_id || pid, quantities[currentVariant?.product_id || pid] || 1, 'kilo');
                                                    setQuickViewProduct(null);
                                                }}
                                                className="flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white py-2.5 rounded-lg text-xs font-semibold transition-colors"
                                            >
                                                <CreditCard className="w-3.5 h-3.5" />
                                                Buy Now
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Order Modal */}
            {showOrderModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 pb-8">
                            <div className="flex items-center justify-between gap-3 mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Complete Your Order</h2>
                                <button
                                    onClick={() => { setShowOrderModal(false); }}
                                    aria-label="Close"
                                    className="p-2.5 -m-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                                >
                                    <X className="w-7 h-7 text-gray-600 dark:text-gray-300" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <OrderTypeSelector orderForm={orderForm} setOrderForm={setOrderForm} />

                                <DownPaymentNotice orderForm={orderForm} total={activeOrderTotal} />

                                <PaymentMethodSelector orderForm={orderForm} setOrderForm={setOrderForm} total={activeOrderTotal} />

                                {/* Delivery Address - Only show for delivery orders, not pickup or pre-order */}
                                {orderForm.order_type === 'delivery' && (
                                    <DeliveryAddressFields
                                        orderForm={orderForm}
                                        setOrderForm={setOrderForm}
                                        addresses={addresses}
                                        selectedAddressId={selectedAddressId}
                                        onAddressSelectChange={handleAddressSelectChange}
                                    />
                                )}

                                <PickupLocationInfo
                                    active={orderForm.order_type === 'pickup' || orderForm.order_type === 'preorder'}
                                    mapId="pickup-store-map"
                                    windowKey="pickupStoreMap"
                                />

                                <DownPaymentNotice orderForm={orderForm} total={activeOrderTotal} />

                                <OrderSummaryList
                                    items={activeOrderItems}
                                    products={products}
                                    subtotalExclVAT={activeOrderSubtotalExclVAT}
                                    vatAmount={activeOrderVATAmount}
                                    total={activeOrderTotal}
                                    deliveryFee={activeOrderDeliveryFee}
                                    grandTotal={activeOrderGrandTotal}
                                    showDeliveryFee={orderForm.order_type === 'delivery'}
                                />

                                {/* Submit Button */}
                                <button
                                    onClick={submitOrder}
                                    disabled={
                                        isPlacingOrder ||
                                        (orderForm.order_type === 'delivery' && ((!orderForm.delivery_barangay_name || !orderForm.delivery_municipality) || !orderForm.delivery_landmark)) ||
                                        ((orderForm.order_type === 'pickup' || orderForm.order_type === 'preorder') && (!orderForm.pickup_date || !orderForm.pickup_time))
                                    }
                                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isPlacingOrder ? 'Placing Order...' : 'Confirm Order'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <PreOrdersModal
                open={showPreOrdersModal}
                onClose={() => setShowPreOrdersModal(false)}
                preOrders={preOrders}
                onCheckout={checkoutPreOrder}
            />

            {/* Pre-Order Checkout Modal */}
            {showCheckoutModal && selectedPreOrder && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 pb-8">
                            <div className="flex items-center justify-between gap-3 mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Checkout Pre-Order #{selectedPreOrder.order_id}</h2>
                                <button
                                    onClick={() => {
                                        setShowCheckoutModal(false);
                                        setSelectedPreOrder(null);
                                    }}
                                    aria-label="Close"
                                    className="p-2.5 -m-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                                >
                                    <X className="w-7 h-7 text-gray-600 dark:text-gray-300" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Order Summary */}
                                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Order Summary</h3>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                                        <span className="font-bold text-cyan-600 dark:text-cyan-400 text-xl">₱{Number(selectedPreOrder.total_amount).toFixed(2)}</span>
                                    </div>
                                    {(selectedPreOrder.down_payment ?? 0) > 0 && (
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-gray-600 dark:text-gray-400">Down Payment:</span>
                                            <span className="font-medium text-green-600 dark:text-green-400">-₱{Number(selectedPreOrder.down_payment ?? 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-gray-200 dark:border-slate-600 pt-2 mt-2">
                                        <div className="flex justify-between font-bold text-lg">
                                            <span className="text-gray-900 dark:text-white">
                                                {(selectedPreOrder.down_payment ?? 0) > selectedPreOrder.total_amount ? 'Sukli (Change):' : 'Remaining Balance:'}
                                            </span>
                                            <span className="text-cyan-600 dark:text-cyan-400">
                                                ₱{Number(Math.abs(selectedPreOrder.total_amount - (selectedPreOrder.down_payment ?? 0))).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Method */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Payment Method
                                    </label>
                                    <select
                                        value={orderForm.payment_method}
                                        onChange={(e) => setOrderForm(prev => ({ ...prev, payment_method: e.target.value as 'Cash' | 'GCash' }))}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="GCash">GCash</option>
                                    </select>
                                </div>

                                {/* Submit Button */}
                                <button
                                    onClick={completePreOrderCheckout}
                                    disabled={isPreOrderCheckoutProcessing}
                                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isPreOrderCheckoutProcessing ? 'Processing...' : 'Complete Checkout'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <GCashProofModal
                open={showGCashModal}
                order={gCashOrderData}
                onClose={() => {
                    setShowGCashModal(false);
                    setGCashOrderData(null);
                    setShowOrderModal(false);
                }}
                onDone={handleGCashDone}
            />

            <CodProofModal
                open={showCodModal}
                order={codOrderData}
                onClose={() => {
                    setShowCodModal(false);
                    setCodOrderData(null);
                    setShowOrderModal(false);
                }}
                onDone={handleCodDone}
            />

            <OrderSuccessModal
                open={showSuccessModal}
                onClose={() => {
                    setShowSuccessModal(false);
                    window.location.reload();
                }}
            />

            <ConfirmModal {...confirmModalProps} />

            {/* GCash Rejected Notification — was an inline banner further down
                the page (easy to miss if scrolled past); now centered like the
                app's other pop-ups. */}
            {showGCashRejectedModal && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
                    onClick={dismissGCashRejectedModal}
                >
                    <div
                        className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 max-w-sm w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3 mb-6">
                            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-red-700 dark:text-red-400">GCash Payment Rejected</p>
                                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                                    One or more of your GCash payments were rejected. Please check your orders below and resubmit a new screenshot.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={dismissGCashRejectedModal}
                            className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}

            {/* Resubmit GCash Proof Modal */}
            {showResubmitModal && resubmitOrder && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Resubmit Payment Proof</h2>
                                {!resubmitUploading && (
                                    <button
                                        onClick={() => { setShowResubmitModal(false); setResubmitOrder(null); setResubmitScreenshot(null); setResubmitDone(false); }}
                                        aria-label="Close"
                                        className="p-2.5 -m-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                                    >
                                        <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                                    </button>
                                )}
                            </div>

                            {!resubmitDone ? (
                                <div className="space-y-4">
                                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                        <p className="text-sm text-red-700 dark:text-red-400">
                                            <strong>Order #{resubmitOrder.order_id}</strong> — Your previous GCash proof was rejected.
                                            Please upload a new, clear screenshot of your payment receipt.
                                        </p>
                                    </div>

                                    <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-3 flex justify-between items-center">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Amount to Pay</span>
                                        <span className="font-bold text-cyan-600 dark:text-cyan-400">₱{Number(resubmitOrder.total_amount).toFixed(2)}</span>
                                    </div>

                                    <label className="block cursor-pointer">
                                        <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors ${
                                            resubmitScreenshot
                                                ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20'
                                                : 'border-gray-300 dark:border-gray-600 hover:border-cyan-400'
                                        }`}>
                                            {resubmitScreenshot ? (
                                                <div>
                                                    <img
                                                        src={URL.createObjectURL(resubmitScreenshot)}
                                                        alt="Receipt preview"
                                                        className="max-h-40 mx-auto rounded-lg object-contain mb-2"
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{resubmitScreenshot.name}</p>
                                                    <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">Tap to change</p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">Tap to select screenshot</p>
                                                    <p className="text-xs text-gray-400 mt-1">JPG, PNG — max 5MB</p>
                                                </div>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/jpg"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    if (file.size > 5 * 1024 * 1024) {
                                                        alert('File is too large. Maximum size is 5MB.');
                                                        return;
                                                    }
                                                    setResubmitScreenshot(file);
                                                }
                                            }}
                                        />
                                    </label>

                                    <button
                                        disabled={!resubmitScreenshot || resubmitUploading}
                                        onClick={async () => {
                                            if (!resubmitScreenshot || !resubmitOrder) return;
                                            setResubmitUploading(true);
                                            try {
                                                const result = await uploadGcashResubmitProof(resubmitOrder.order_id, resubmitScreenshot);
                                                if (result.ok) {
                                                    setResubmitDone(true);
                                                } else {
                                                    alert(result.message);
                                                }
                                            } finally {
                                                setResubmitUploading(false);
                                            }
                                        }}
                                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {resubmitUploading ? 'Uploading...' : 'Submit New Proof'}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center space-y-4 py-2">
                                    <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                                        <CheckCircle className="w-8 h-8 text-green-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">Proof Resubmitted!</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Your new payment screenshot is now <span className="font-semibold text-amber-500">Awaiting Verification</span>.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowResubmitModal(false);
                                            setResubmitOrder(null);
                                            setResubmitScreenshot(null);
                                            setResubmitDone(false);
                                            window.location.reload();
                                        }}
                                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all"
                                    >
                                        Done
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
