import { Head, Link, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import {
    ShoppingCart,
    Package,
    X,
    Trash2,
    MapPin,
    ArrowLeft,
    ShoppingBag,
} from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';
import { type SharedData } from '@/types';
import { getCartStorageKey } from '@/lib/cart';
import { computeOrderTotal, useOrderTotals } from '@/hooks/useOrderTotals';
import { useOrderForm } from '@/hooks/useOrderForm';
import { usePreOrders } from '@/hooks/usePreOrders';
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

interface Product {
    product_id: number;
    product_name: string;
    category: string;
    unit: string;
    price: number;
    price_per_case: number | null;
    price_per_case_cold: number | null;
    price_per_bottle: number | null;
    image: string | null;
    current_quantity: number;
    is_low_stock: boolean;
}

interface CartItem {
    productId: number;
    quantity: number;
    kiloAmount?: number;
    orderType?: 'kilo' | 'bottle' | 'case';
    isCold?: boolean;
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

interface CartPageProps {
    products: Product[];
    addresses?: UserAddress[];
    deliveryFeeSettings?: {
        in_town_fee: number;
        out_of_town_fee: number;
        in_town_municipality: string;
    };
}

export default function CartPage({ products, addresses = [], deliveryFeeSettings }: CartPageProps) {
    const { auth } = usePage<SharedData>().props;
    const cartStorageKey = getCartStorageKey(auth.user?.id);

    // ── Cart state (persisted in localStorage) ──────────────────────────────
    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            const saved = localStorage.getItem(cartStorageKey);
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    useEffect(() => {
        localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    }, [cart, cartStorageKey]);

    // ── Pre-orders (nav button) ──────────────────────────────────────────────
    const { preOrders, showPreOrdersModal, setShowPreOrdersModal, fetchPreOrders } = usePreOrders();

    // ── Order modal ──────────────────────────────────────────────────────────
    const [showOrderModal, setShowOrderModal] = useState(false);
    const {
        orderForm,
        setOrderForm,
        selectedAddressId,
        handleAddressSelectChange,
        resetOrderForm,
    } = useOrderForm(addresses, { prefillWhen: showOrderModal });

    // ── GCash modal ──────────────────────────────────────────────────────────
    const [showGCashModal, setShowGCashModal] = useState(false);
    const [gCashOrderData, setGCashOrderData] = useState<any>(null);

    // ── COD modal ────────────────────────────────────────────────────────────
    const [showCodModal, setShowCodModal] = useState(false);
    const [codOrderData, setCodOrderData] = useState<any>(null);

    // ── Order success modal (Cash + dine-in, i.e. no proof-upload step) ───────
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // ── Centered confirm() replacement, shared by every confirmation prompt
    //    on this page (currently just "place this order?") ───────────────────
    const { confirm, confirmModalProps } = useConfirmModal();

    // Esc closes whichever modal is currently on top, respecting the same
    // guards as their X buttons (e.g. mid-upload steps can't be dismissed).
    useEffect(() => {
        const anyModalOpen = showPreOrdersModal || showOrderModal || showGCashModal || showCodModal || showSuccessModal || confirmModalProps.open;
        if (!anyModalOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (confirmModalProps.open) {
                confirmModalProps.onCancel();
            } else if (showSuccessModal) {
                setShowSuccessModal(false);
                window.location.reload();
            } else if (showCodModal) {
                setShowCodModal(false);
                setCodOrderData(null);
                setShowOrderModal(false);
            } else if (showGCashModal) {
                // GCashProofModal owns its own Esc handling (it blocks closing
                // while its internal step is 'upload') — this branch only
                // needs to consume the keypress so it doesn't fall through.
            } else if (showOrderModal) {
                setShowOrderModal(false);
            } else if (showPreOrdersModal) {
                setShowPreOrdersModal(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showPreOrdersModal, showOrderModal, showGCashModal, showCodModal, showSuccessModal, confirmModalProps.open]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const cartTotal = computeOrderTotal(cart, products);
    const {
        subtotalExclVAT: cartSubtotalExclVAT,
        vatAmount: cartVATAmount,
        deliveryFee: cartDeliveryFee,
        grandTotal: cartGrandTotal,
    } = useOrderTotals(cart, products, orderForm, deliveryFeeSettings);

    const updateCartQuantity = (productId: number, quantity: number, orderType?: string, kiloAmount?: number, isCold?: boolean) => {
        if (quantity <= 0) {
            removeFromCart(productId, orderType, kiloAmount, isCold);
        } else {
            setCart(prev => prev.map(item =>
                item.productId === productId &&
                (kiloAmount !== undefined ? item.kiloAmount === kiloAmount : item.orderType === orderType && !!item.isCold === !!isCold)
                    ? { ...item, quantity }
                    : item
            ));
        }
    };

    const removeFromCart = (productId: number, orderType?: string, kiloAmount?: number, isCold?: boolean) => {
        if (kiloAmount !== undefined) {
            setCart(prev => prev.filter(item => item.productId !== productId || item.kiloAmount !== kiloAmount));
        } else if (orderType !== undefined) {
            setCart(prev => prev.filter(item => !(item.productId === productId && item.orderType === orderType && !!item.isCold === !!isCold)));
        } else {
            setCart(prev => prev.filter(item => item.productId !== productId));
        }
    };

    const { submitOrder, isPlacingOrder } = useSubmitOrder({
        items: cart,
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
            setShowOrderModal(false);
            resetOrderForm();
            setShowSuccessModal(true);
        },
        confirmPlaceOrder: confirm,
    });

    // "Done" on the GCash/COD proof modals — unchanged behavior: clear the
    // cart, close the order modal, and reload.
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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
            <Head title="My Cart" />
            <CustomerNav currentPage="cart" />

            {/* ── Main Content ── */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
                {/* Back link */}
                <Link
                    href="/customer/dashboard"
                    className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Products
                </Link>

                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                    <ShoppingCart className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
                    My Cart
                    {cart.length > 0 && (
                        <span className="bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 text-sm font-semibold rounded-full px-3 py-0.5">
                            {cart.length} {cart.length === 1 ? 'item' : 'items'}
                        </span>
                    )}
                </h2>

                {cart.length === 0 ? (
                    /* Empty state */
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-16 text-center">
                        <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Your cart is empty</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Browse our products and add items to your cart.</p>
                        <Link
                            href="/customer/dashboard"
                            className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Shop Now
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Cart items */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
                            {cart.map(item => {
                                const product = products.find(p => p.product_id === item.productId);
                                if (!product) return null;
                                const isBeverage = !!(product.price_per_case || product.price_per_bottle);
                                let price = product.price;
                                if (item.orderType === 'bottle') price = product.price_per_bottle || product.price || 0;
                                else if (item.orderType === 'case') price = (item.isCold && product.price_per_case_cold) || product.price_per_case || product.price || 0;
                                else if (item.kiloAmount && !isBeverage) {
                                    const variant = products.find(p =>
                                        p.product_name === product.product_name && p.unit === `${item.kiloAmount}kg`
                                    );
                                    price = variant?.price || product.price || 0;
                                }
                                const unitLabel = item.orderType === 'bottle' ? 'per bottle'
                                    : item.orderType === 'case' ? (item.isCold ? 'per case (cold)' : 'per case')
                                    : item.kiloAmount ? `${item.kiloAmount}kg`
                                    : product.unit;
                                const uniqueKey = `${item.productId}-${item.orderType ?? ''}-${item.kiloAmount ?? ''}-${item.isCold ?? ''}`;

                                return (
                                    <div key={uniqueKey} className="flex items-center gap-4 p-4 sm:p-5">
                                        {/* Product image */}
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 flex-shrink-0 overflow-hidden">
                                            {product.image ? (
                                                <img src={`/${product.image}`} alt={product.product_name} loading="lazy" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package className="w-8 h-8 text-cyan-300 dark:text-cyan-600" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Product info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                                {product.product_name}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{unitLabel} · ₱{Number(price).toFixed(2)} each</p>
                                            <p className="text-base font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
                                                ₱{Number(price * item.quantity).toFixed(2)}
                                            </p>
                                            {(() => {
                                                const lineStock = toStockCount(product.current_quantity);
                                                return (
                                                    <p className={`text-xs mt-0.5 ${
                                                        lineStock === 0
                                                            ? 'text-red-500 dark:text-red-400'
                                                            : product.is_low_stock
                                                            ? 'text-amber-600 dark:text-amber-400'
                                                            : 'text-gray-400 dark:text-gray-500'
                                                    }`}>
                                                        {lineStock === 0 ? 'Out of stock' : `${lineStock} ${lineStock === 1 ? 'unit' : 'units'} available`}
                                                    </p>
                                                );
                                            })()}
                                        </div>

                                        {/* Quantity controls */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <QuantityInput
                                                value={item.quantity}
                                                onChange={(val) => updateCartQuantity(item.productId, val, item.orderType, item.kiloAmount, item.isCold)}
                                                min={0}
                                                max={product.current_quantity}
                                                size="sm"
                                                className="w-28"
                                                inputClassName="text-sm"
                                            />
                                            <button
                                                onClick={() => removeFromCart(item.productId, item.orderType, item.kiloAmount, item.isCold)}
                                                className="w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors ml-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Order summary + Place Order */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-lg">Order Summary</h3>
                            <div className="space-y-2 mb-4">
                                {cart.map(item => {
                                    const product = products.find(p => p.product_id === item.productId);
                                    if (!product) return null;
                                    let price = product.price;
                                    if (item.orderType === 'bottle') price = product.price_per_bottle || product.price || 0;
                                    else if (item.orderType === 'case') price = (item.isCold && product.price_per_case_cold) || product.price_per_case || product.price || 0;
                                    else if (item.kiloAmount) {
                                        const v = products.find(p => p.product_name === product.product_name && p.unit === `${item.kiloAmount}kg`);
                                        price = v?.price || product.price || 0;
                                    }
                                    return (
                                        <div key={`summary-${item.productId}-${item.orderType ?? ''}-${item.kiloAmount ?? ''}-${item.isCold ?? ''}`} className="flex justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">
                                                {product.product_name}
                                                {item.orderType === 'bottle' ? ' (Bottle)' : item.orderType === 'case' ? (item.isCold ? ' (Case - Cold)' : ' (Case)') : item.kiloAmount ? ` (${item.kiloAmount}kg)` : ''} × {item.quantity}
                                            </span>
                                            <span className="font-medium text-gray-900 dark:text-white">₱{Number(price * item.quantity).toFixed(2)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="border-t border-gray-100 dark:border-slate-700 pt-4 mb-5 space-y-1.5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Subtotal (VAT excluded):</span>
                                    <span className="font-medium text-gray-900 dark:text-white">₱{cartSubtotalExclVAT.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">VAT (12%):</span>
                                    <span className="font-medium text-gray-900 dark:text-white">₱{cartVATAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-slate-700">
                                    <span className="text-lg font-semibold text-gray-900 dark:text-white">Total (VAT included)</span>
                                    <span className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">₱{Number(cartTotal).toFixed(2)}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowOrderModal(true)}
                                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white py-3.5 rounded-xl font-semibold text-base transition-all shadow-md hover:shadow-lg"
                            >
                                Place Order
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <PreOrdersModal
                open={showPreOrdersModal}
                onClose={() => setShowPreOrdersModal(false)}
                preOrders={preOrders}
            />

            {/* ── Order / Checkout Modal ── */}
            {showOrderModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 pb-8">
                            <div className="flex items-center justify-between gap-3 mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Complete Your Order</h2>
                                <button onClick={() => setShowOrderModal(false)} aria-label="Close" className="p-2.5 -m-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0">
                                    <X className="w-7 h-7 text-gray-600 dark:text-gray-300" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <OrderTypeSelector orderForm={orderForm} setOrderForm={setOrderForm} />

                                <DownPaymentNotice orderForm={orderForm} total={cartTotal} />

                                <PaymentMethodSelector orderForm={orderForm} setOrderForm={setOrderForm} total={cartTotal} />

                                {/* Delivery address */}
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
                                    mapId="cart-pickup-store-map"
                                    windowKey="cartPickupMap"
                                    directionsLabel="Open in Google Maps"
                                    directionsIcon={MapPin}
                                />

                                <DownPaymentNotice orderForm={orderForm} total={cartTotal} />

                                <OrderSummaryList
                                    items={cart}
                                    products={products}
                                    subtotalExclVAT={cartSubtotalExclVAT}
                                    vatAmount={cartVATAmount}
                                    total={cartTotal}
                                    deliveryFee={cartDeliveryFee}
                                    grandTotal={cartGrandTotal}
                                    showDeliveryFee={orderForm.order_type === 'delivery'}
                                />

                                {/* Confirm button */}
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
        </div>
    );
}
