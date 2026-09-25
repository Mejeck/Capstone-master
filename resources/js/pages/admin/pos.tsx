import { Head, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';
import { getCsrfHeaders } from '@/lib/csrf';
import { showToast } from '@/lib/toast';
import { VOID_SALE_REASONS, OTHER_VOID_REASON } from '@/constants/voidSaleReasons';
import {
    ShoppingCart,
    Plus,
    Minus,
    X,
    Search,
    Package,
    Receipt,
    Printer,
    CreditCard,
    Banknote,
    User,
    Clock,
    CheckCircle,
    History,
    Trash2,
    Keyboard,
    Ban,
    TrendingUp
} from 'lucide-react';
import { TAX_CONSTANTS, formatCurrency } from '@/constants/tax';

function Kbd({ children }: { children: React.ReactNode }) {
    return (
        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded border border-current/30 bg-black/5 dark:bg-white/10 text-[10px] font-mono font-semibold leading-none">
            {children}
        </span>
    );
}

interface Product {
    product_id: number;
    product_name: string;
    price: number;
    price_per_case?: number;
    price_per_case_cold?: number;
    price_per_bottle?: number;
    current_quantity: number;
    unit: string;
    category: string;
    unit_type: 'bottle' | 'case' | 'kilos';
}

interface CartItem {
    product: Product;
    quantity: number;
    unit_type: 'bottle' | 'case' | 'kilos';
    subtotal: number;
    // Only meaningful when unit_type === 'case': the chilled case option is
    // priced higher via product.price_per_case_cold and is never offered by
    // the bottle.
    is_cold?: boolean;
}

// All-time POS totals shown on the register screen, so the admin can see
// overall sales without opening Sales History. Voided sales are excluded
// server-side (POSController::overallSalesSummary).
interface OverallSales {
    total_sales: number;
    total_transactions: number;
    today_sales: number;
}

interface PaymentMethod {
    id: string;
    name: string;
    icon: React.ComponentType<any>;
}

// Empty: the top nav/sidebar already shows which page is active, and
// the page has its own heading below, so a "Dashboard > X" trail here was
// just repeating both without adding a real path back anywhere new.
const breadcrumbs: BreadcrumbItem[] = [];

// If a submit ever comes back with an expired session (see
// handleSessionExpired below), the in-progress cart is stashed here so a
// page reload doesn't throw away an order in progress.
const CART_BACKUP_KEY = 'admin_pos_cart_backup';

// How often to quietly ping the server while this screen sits idle between
// sales, so it doesn't outlast the session lifetime and log itself out.
const KEEP_ALIVE_INTERVAL_MS = 10 * 60 * 1000;

// A sane ceiling for a walk-in cash payment, not the decimal(10,2) column's
// actual max (99,999,999.99) — nobody hands a cashier ₱100M in cash, so this
// catches a fat-fingered or pasted-in amount far earlier. The backend still
// enforces the column's real limit as a hard backstop.
const MAX_CASH_RECEIVED = 1_000_000;

export default function POS({ overall_sales }: { overall_sales?: OverallSales }) {
    const cartRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const cashInputRef = useRef<HTMLInputElement>(null);
    const gcashInputRef = useRef<HTMLInputElement>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [overallSales, setOverallSales] = useState<OverallSales>(
        overall_sales ?? { total_sales: 0, total_transactions: 0, today_sales: 0 }
    );
    // Restores a cart stashed by handleSessionExpired just before a reload,
    // so an order in progress survives having to log back in.
    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            const backup = localStorage.getItem(CART_BACKUP_KEY);
            if (backup) {
                localStorage.removeItem(CART_BACKUP_KEY);
                return JSON.parse(backup);
            }
        } catch {
            // Corrupt or inaccessible storage: fall through to an empty cart.
        }
        return [];
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('cash');
    const [cashReceived, setCashReceived] = useState<string>('');
    const [showReceipt, setShowReceipt] = useState(false);
    const [currentSale, setCurrentSale] = useState<any>(null);
    // Lets the receipt screen offer a one-click void for a mistake caught
    // right away, instead of making the admin go find it in Sales History.
    // Reset whenever a new sale completes.
    const [currentSaleVoided, setCurrentSaleVoided] = useState(false);
    // Replaces the native window.prompt() for the void reason — a native
    // dialog isn't centered on the page and can't be styled to match the
    // rest of the checkout flow.
    const [voidReasonModalOpen, setVoidReasonModalOpen] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    // Which dropdown option is picked — a preset reason (used verbatim as
    // voidReason) or OTHER_VOID_REASON, which instead reveals a free-text
    // box for whatever isn't already covered by a preset.
    const [voidReasonPreset, setVoidReasonPreset] = useState('');
    const [voiding, setVoiding] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showGcashModal, setShowGcashModal] = useState(false);
    const [gcashPaymentProof, setGcashPaymentProof] = useState<string>('');
    const [gcashTransactionId, setGcashTransactionId] = useState<string>('');
    const [gcashProofType, setGcashProofType] = useState<'screenshot' | 'transaction_id'>('screenshot');

    const paymentMethods: PaymentMethod[] = [
        { id: 'cash', name: 'Cash', icon: Banknote },
        { id: 'gcash', name: 'GCash', icon: CreditCard },
    ];

    useEffect(() => {
        fetchProducts();
    }, []);

    // Quiet background ping so this screen left open between sales doesn't
    // outlast the session lifetime and silently log itself out. Reuses
    // fetchProducts rather than a dedicated ping endpoint since it's already
    // a cheap, authenticated GET, with the side benefit of keeping stock
    // levels current too.
    useEffect(() => {
        const interval = setInterval(fetchProducts, KEEP_ALIVE_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    // A sale can fail with a 419 if this screen sat idle long enough for the
    // session to actually expire (as opposed to the CSRF token merely
    // drifting, which getCsrfHeaders() already avoids). At that point the
    // user is logged out server-side and there's no way to recover without a
    // fresh login, so stash the cart and send them to do that rather than
    // showing a raw "CSRF token mismatch" error and losing the sale.
    const handleSessionExpired = () => {
        try {
            localStorage.setItem(CART_BACKUP_KEY, JSON.stringify(cart));
        } catch {
            // Storage full/unavailable: nothing more we can do to save the
            // cart, but the user still needs to be told and re-routed.
        }
        alert('Your session has expired. Please log in again — this cart has been saved and will be waiting for you.');
        window.location.href = '/login';
    };

    const fetchProducts = async () => {
        try {
            const response = await fetch('/admin/api/products', {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setProducts(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load POS products:', error);
            setProducts([]);
        }
    };

    // Re-read the overall totals after anything that changes them (a
    // completed sale, a void), so the header stays correct without a reload.
    const fetchOverallSales = async () => {
        try {
            const response = await fetch('/admin/api/pos/summary', {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            setOverallSales(await response.json());
        } catch (error) {
            console.error('Failed to load overall sales:', error);
        }
    };

    const filteredProducts = Array.isArray(products) ? products.filter(product =>
        product.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    // The backend deducts inventory per product_id regardless of unit_type
    // (bottle/case/kilos all draw from the same current_quantity pool), so
    // the cap has to look at every cart line for that product, not just one.
    // Mirrors the same guard on the cashier POS page.
    const getCartQuantityForProduct = (productId: number, excludeItem?: CartItem) => {
        return cart.reduce((total, cartItem) => {
            if (cartItem.product.product_id !== productId || cartItem === excludeItem) return total;
            return total + cartItem.quantity;
        }, 0);
    };

    const addToCart = (product: Product, unitType: 'bottle' | 'case' | 'kilos', isCold: boolean = false) => {
        const existingItem = cart.find(item =>
            item.product.product_id === product.product_id &&
            item.unit_type === unitType &&
            !!item.is_cold === isCold
        );

        if (existingItem) {
            updateQuantity(existingItem, existingItem.quantity + 1);
        } else {
            if (getCartQuantityForProduct(product.product_id) + 1 > product.current_quantity) {
                alert(`Not enough stock. Only ${product.current_quantity} ${product.unit} of ${product.product_name} available.`);
                return;
            }

            let price: number;
            if (unitType === 'case') {
                // Use the chilled case price when requested and available,
                // otherwise the regular case price, otherwise calculate from bottle price
                price = parseFloat(String((isCold && product.price_per_case_cold) || product.price_per_case || (product.price_per_bottle || product.price) * 24));
            } else if (unitType === 'kilos') {
                price = parseFloat(String(product.price));
            } else {
                price = parseFloat(String(product.price_per_bottle || product.price));
            }

            const newItem: CartItem = {
                product,
                quantity: 1,
                unit_type: unitType,
                subtotal: price,
                is_cold: unitType === 'case' ? isCold : undefined,
            };
            setCart([...cart, newItem]);
        }
    };

    const updateQuantity = (item: CartItem, newQuantity: number) => {
        if (newQuantity <= 0) {
            removeFromCart(item);
            return;
        }

        const otherLinesQuantity = getCartQuantityForProduct(item.product.product_id, item);
        if (otherLinesQuantity + newQuantity > item.product.current_quantity) {
            alert(`Not enough stock. Only ${item.product.current_quantity} ${item.product.unit} of ${item.product.product_name} available.`);
            return;
        }

        let price: number;
        if (item.unit_type === 'case') {
            // Use the chilled case price when this line is the cold option,
            // otherwise the regular case price, otherwise calculate from bottle price
            price = parseFloat(String((item.is_cold && item.product.price_per_case_cold) || item.product.price_per_case || (item.product.price_per_bottle || item.product.price) * 24));
        } else if (item.unit_type === 'kilos') {
            price = parseFloat(String(item.product.price));
        } else {
            price = parseFloat(String(item.product.price_per_bottle || item.product.price));
        }

        setCart(cart.map(cartItem => 
            cartItem === item 
                ? { ...cartItem, quantity: newQuantity, subtotal: price * newQuantity }
                : cartItem
        ));
    };

    const removeFromCart = (item: CartItem) => {
        setCart(cart.filter(cartItem => cartItem !== item));
    };

    const clearCart = () => {
        if (cart.length === 0) return;
        if (window.confirm('Clear all items from the cart?')) {
            setCart([]);
            setCashReceived('');
        }
    };

    const getTotal = () => {
        return cart.reduce((total, item) => total + parseFloat(String(item.subtotal)), 0);
    };

    const getSubtotalWithoutVAT = () => {
        return cart.reduce((total, item) => {
            const itemPrice = parseFloat(String(item.subtotal));
            return total + TAX_CONSTANTS.calculateBasePrice(itemPrice);
        }, 0);
    };

    const getVATAmount = () => {
        return cart.reduce((total, item) => {
            const itemPrice = parseFloat(String(item.subtotal));
            return total + TAX_CONSTANTS.calculateVAT(itemPrice);
        }, 0);
    };

    const getChange = () => {
        const cash = parseFloat(cashReceived) || 0;
        return Math.max(0, cash - getTotal());
    };

    const processSale = async () => {
        if (cart.length === 0) return;

        if (selectedPaymentMethod === 'gcash') {
            setShowGcashModal(true);
            return;
        }

        // The Complete Sale button already disables itself for these same
        // conditions, but the F9 shortcut calls processSale() directly and
        // skips that check — letting a blank/short cash amount reach the
        // backend as a null total_cash_received and crash the sale insert.
        if (!cashReceived || parseFloat(cashReceived) < getTotal()) {
            alert('Please enter a cash amount that covers the total before completing the sale.');
            cashInputRef.current?.focus();
            return;
        }
        if (parseFloat(cashReceived) > MAX_CASH_RECEIVED) {
            alert(`Cash amount is too large. Please enter an amount up to ${formatCurrency(MAX_CASH_RECEIVED)}.`);
            cashInputRef.current?.focus();
            return;
        }

        setLoading(true);
        try {
            const saleData = {
                items: cart.map(item => ({
                    product_id: item.product.product_id,
                    quantity: item.quantity,
                    unit_type: item.unit_type,
                    price: item.unit_type === 'case' ?
                        ((item.is_cold && item.product.price_per_case_cold) || item.product.price_per_case || item.product.price * 24) :
                        (item.product.price_per_bottle || item.product.price),
                    subtotal: item.subtotal
                })),
                payment_method: selectedPaymentMethod,
                cash_received: selectedPaymentMethod === 'cash' ? parseFloat(cashReceived) : null,
                total_amount: getTotal(),
                customer_type: 'walk_in'
            };

            const response = await fetch('/admin/api/pos/sale', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...getCsrfHeaders()
                },
                body: JSON.stringify(saleData)
            });

            if (response.status === 419) {
                handleSessionExpired();
                return;
            }

            const result = await response.json();

            if (response.ok) {
                setCurrentSale(result.sale);
                setCurrentSaleVoided(false);
                setShowReceipt(true);
                setCart([]);
                setCashReceived('');
                fetchOverallSales();
            } else {
                alert('Error processing sale: ' + result.message);
            }
        } catch (error) {
            console.error('Cash sale failed:', error);
            alert('Error processing sale');
        } finally {
            setLoading(false);
        }
    };

    const processGcashSale = async () => {
        if (!gcashPaymentProof && !gcashTransactionId) {
            alert('Please provide either a screenshot or transaction ID as payment proof');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('items', JSON.stringify(cart.map(item => ({
                product_id: item.product.product_id,
                quantity: item.quantity,
                unit_type: item.unit_type,
                price: item.unit_type === 'case' ?
                    ((item.is_cold && item.product.price_per_case_cold) || item.product.price_per_case || item.product.price * 24) :
                    (item.product.price_per_bottle || item.product.price),
                subtotal: item.subtotal
            }))));
            formData.append('payment_method', 'gcash');
            formData.append('total_amount', getTotal().toString());
            formData.append('customer_type', 'walk_in');
            formData.append('payment_proof_type', gcashProofType);
            
            if (gcashProofType === 'screenshot' && gcashPaymentProof) {
                formData.append('payment_proof', gcashPaymentProof);
            } else if (gcashProofType === 'transaction_id' && gcashTransactionId) {
                formData.append('transaction_id', gcashTransactionId);
            }

            const response = await fetch('/admin/api/pos/sale', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders()
                },
                body: formData
            });

            if (response.status === 419) {
                handleSessionExpired();
                return;
            }

            const result = await response.json();

            if (response.ok) {
                setCurrentSale(result.sale);
                setCurrentSaleVoided(false);
                setShowReceipt(true);
                setShowGcashModal(false);
                setCart([]);
                setCashReceived('');
                setGcashPaymentProof('');
                setGcashTransactionId('');
                fetchOverallSales();
            } else {
                alert('Error processing sale: ' + result.message);
            }
        } catch (error) {
            console.error('GCash sale failed:', error);
            alert('Error processing sale');
        } finally {
            setLoading(false);
        }
    };

    const printReceipt = () => {
        window.print();
    };

    // Quick undo for a mistake caught right on the receipt screen — reuses
    // the same void endpoint as Sales History, so there's only the one
    // place (CashierController::voidSale) that actually reverses stock.
    const voidCurrentSale = () => {
        if (!currentSale?.sale_id || currentSaleVoided) return;
        setVoidReason('');
        setVoidReasonPreset('');
        setVoidReasonModalOpen(true);
    };

    const confirmVoidCurrentSale = async () => {
        if (!currentSale?.sale_id || !voidReason.trim()) return;

        setVoiding(true);
        try {
            const response = await fetch(`/cashier/sales-history/${currentSale.sale_id}/void`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...getCsrfHeaders()
                },
                body: JSON.stringify({ reason: voidReason.trim() })
            });

            const result = await response.json();

            if (response.ok) {
                setCurrentSaleVoided(true);
                setVoidReasonModalOpen(false);
                setVoidReason('');
                setVoidReasonPreset('');
                fetchProducts();
                fetchOverallSales();
                showToast('success', 'Sale voided. Stock has been restored.');
            } else {
                showToast('error', result.message || 'Could not void this sale.');
            }
        } catch (error) {
            console.error('Error voiding sale:', error);
            showToast('error', 'Could not void this sale.');
        } finally {
            setVoiding(false);
        }
    };

    // Grocery-style register shortcuts: F2/F3 pick a payment method, F4 jumps to the cash
    // field, F8 clears the cart, F9 completes the sale, "/" jumps to search, Esc backs out
    // of whichever modal is open. Mirrors the same shortcuts on the cashier POS page.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (voidReasonModalOpen) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    if (voiding) return;
                    setVoidReasonModalOpen(false);
                    setVoidReason('');
                    setVoidReasonPreset('');
                }
                return;
            }

            if (showReceipt) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowReceipt(false);
                } else if (e.key === 'F9') {
                    e.preventDefault();
                    printReceipt();
                }
                return;
            }

            if (showGcashModal) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowGcashModal(false);
                    setGcashPaymentProof('');
                    setGcashTransactionId('');
                } else if (e.key === 'F9') {
                    e.preventDefault();
                    processGcashSale();
                }
                return;
            }

            if (e.key === '/' && document.activeElement !== searchInputRef.current) {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === 'F2') {
                e.preventDefault();
                setSelectedPaymentMethod('cash');
            } else if (e.key === 'F3') {
                e.preventDefault();
                setSelectedPaymentMethod('gcash');
            } else if (e.key === 'F4') {
                e.preventDefault();
                cashInputRef.current?.focus();
            } else if (e.key === 'F8') {
                e.preventDefault();
                clearCart();
            } else if (e.key === 'F9') {
                e.preventDefault();
                processSale();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [voidReasonModalOpen, voiding, showReceipt, showGcashModal, cart, selectedPaymentMethod, cashReceived, gcashPaymentProof, gcashTransactionId, loading]);

    // Jump straight into the reference-number field once the GCash modal opens
    // in transaction-ID mode, so the admin can type it in without reaching for
    // the mouse.
    useEffect(() => {
        if (showGcashModal && gcashProofType === 'transaction_id') {
            gcashInputRef.current?.focus();
        }
    }, [showGcashModal, gcashProofType]);

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="POS - Mejeck Ice Plant" />
            <style>{`
                @media print {
                    @page {
                        size: 80mm auto;
                        margin: 2mm;
                    }

                    body * {
                        visibility: hidden;
                    }

                    .fixed.inset-0.bg-transparent,
                    .fixed.inset-0.bg-transparent * {
                        visibility: visible;
                    }

                    .fixed.inset-0.bg-transparent {
                        position: absolute;
                        left: 0;
                        top: 0;
                        background: none !important;
                        backdrop-filter: none !important;
                        width: 100%;
                    }

                    .fixed.inset-0.bg-transparent > div {
                        box-shadow: none !important;
                        border: none !important;
                        width: 80mm;
                        margin: 0 auto;
                        padding: 5mm;
                        font-family: 'Courier New', monospace;
                        font-size: 10px;
                        line-height: 1.2;
                        background: white !important;
                        max-height: none !important;
                        overflow: visible !important;
                    }

                    .fixed.inset-0.bg-transparent > div > div:last-child {
                        display: none !important;
                    }

                    /* The on-screen item list scrolls in its own box so a long
                       order doesn't push the totals/buttons off screen; on
                       paper there's no such limit, so let it print in full. */
                    .receipt-items-scroll {
                        overflow: visible !important;
                        max-height: none !important;
                        flex: none !important;
                    }

                    .text-lg {
                        font-size: 14px !important;
                    }

                    .text-xs {
                        font-size: 8px !important;
                    }

                    .text-sm {
                        font-size: 9px !important;
                    }

                    .text-base {
                        font-size: 11px !important;
                    }

                    .py-2 {
                        padding-top: 2mm !important;
                        padding-bottom: 2mm !important;
                    }

                    .py-3 {
                        padding-top: 3mm !important;
                        padding-bottom: 3mm !important;
                    }

                    .pt-2 {
                        padding-top: 2mm !important;
                    }

                    .pt-3 {
                        padding-top: 3mm !important;
                    }

                    .mt-1, .mt-2, .mt-4 {
                        margin-top: 1mm !important;
                    }

                    .mb-1, .mb-2, .mb-3, .mb-4, .mb-6 {
                        margin-bottom: 1mm !important;
                    }

                    .space-y-1 > * + * {
                        margin-top: 1mm !important;
                    }

                    .space-y-2 > * + * {
                        margin-top: 2mm !important;
                    }

                    .w-16 {
                        width: 16mm !important;
                    }

                    .h-16 {
                        height: 16mm !important;
                    }
                }
            `}</style>
            <div className="p-3 sm:p-6">
                <div className="mb-6">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <ShoppingCart className="w-6 h-6" />
                                Point of Sale
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">Walk-in Customer Sales</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.visit('/admin/pos/history')}
                                title="Access to all historical data"
                                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                            >
                                <History className="w-4 h-4" />
                                Sales History
                            </button>
                            {/* Hidden on small screens: the phone's own status bar already shows
                                the current time right above this, so repeating it here is redundant.
                                Mirrors the same widget on the cashier POS page. */}
                            <div className="hidden text-right sm:block">
                                <div className="text-sm text-gray-600 dark:text-gray-400">Current Time</div>
                                <div className="text-lg font-semibold">{new Date().toLocaleTimeString()}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Overall take, so the admin doesn't have to open Sales History just to
                    see where total sales stand. Same hero treatment as the Total Sales
                    banner on the cashier dashboard, with today's figure and the
                    transaction count broken out beside it. */}
                <div className="mb-6 flex flex-col gap-4 rounded-2xl border-2 border-cyan-700/50 bg-gradient-to-br from-cyan-600 to-cyan-800 p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-cyan-800 dark:from-cyan-700 dark:to-cyan-950">
                    <div>
                        <p className="flex items-center gap-1.5 text-sm font-medium text-cyan-100">
                            <TrendingUp className="w-4 h-4" /> Overall Sales
                        </p>
                        <p className="mt-1 text-3xl font-bold sm:text-4xl">{formatCurrency(overallSales.total_sales)}</p>
                    </div>
                    <div className="flex items-center gap-6 sm:gap-8">
                        <div className="sm:text-right">
                            <p className="text-xs font-medium text-cyan-100 sm:text-sm">Today</p>
                            <p className="mt-1 text-xl font-semibold sm:text-2xl">{formatCurrency(overallSales.today_sales)}</p>
                        </div>
                        <div className="h-10 w-px bg-white/25" aria-hidden="true" />
                        <div className="sm:text-right">
                            <p className="text-xs font-medium text-cyan-100 sm:text-sm">Transactions</p>
                            <p className="mt-1 text-xl font-semibold sm:text-2xl">{overallSales.total_transactions.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Products Section */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Search products..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-16 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                    />
                                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-500 bg-gray-50 dark:bg-slate-600 text-gray-400 dark:text-gray-300 text-[10px] font-mono">/</kbd>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500">
                                    <Keyboard className="w-3 h-3" />
                                    <span className="flex items-center">Cash<Kbd>F2</Kbd></span>
                                    <span className="flex items-center">GCash<Kbd>F3</Kbd></span>
                                    <span className="flex items-center">Amount<Kbd>F4</Kbd></span>
                                    <span className="flex items-center">Clear Cart<Kbd>F8</Kbd></span>
                                    <span className="flex items-center">Complete Sale<Kbd>F9</Kbd></span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                                    {filteredProducts.map((product) => {
                                    const isIceTube = product.product_name.toLowerCase().includes('ice tube');
                                    const unitLabel = isIceTube ? 'kilos' : 'bottle';
                                    const priceDisplay = isIceTube ? 
                                        formatCurrency(product.price) + '/kg' : 
                                        formatCurrency(product.price_per_bottle || product.price) + '/bottle';
                                    
                                    // Calculate case price if not explicitly set
                                    const casePrice = product.price_per_case || (product.price_per_bottle || product.price) * 24;
                                    
                                    return (
                                        <div
                                            key={product.product_id}
                                            onClick={() => {
                                                if (product.current_quantity <= 0) return;
                                                addToCart(product, isIceTube ? 'kilos' : 'bottle');
                                            }}
                                            className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow ${product.current_quantity > 0 ? 'cursor-pointer' : ''}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    {isIceTube && (
                                                        // Every ice tube card shares the same name and category, so the
                                                        // package size (1kg, 3kg, ...) is the only thing telling cards
                                                        // apart — it was buried in the small "Stock: 64.00 1kg" line
                                                        // below, easy to miss when scanning a grid of near-identical
                                                        // cards. Called out here as the first thing the eye lands on.
                                                        <span className="inline-block mb-1 px-2.5 py-1 rounded-md bg-cyan-600 text-white text-sm font-bold tracking-wide">
                                                            {product.unit.toUpperCase()}
                                                        </span>
                                                    )}
                                                    <h3 className="font-semibold text-gray-900 dark:text-white">{product.product_name}</h3>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">{product.category}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-cyan-600 dark:text-cyan-400">
                                                        {priceDisplay}
                                                    </p>
                                                    {!isIceTube && (
                                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                                            {formatCurrency(casePrice) + '/case'}
                                                        </p>
                                                    )}
                                                    {!isIceTube && product.price_per_case_cold && (
                                                        <p className="text-xs text-sky-600 dark:text-sky-400">
                                                            {formatCurrency(product.price_per_case_cold) + '/case (cold)'}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">per {unitLabel}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                                    Stock: {product.current_quantity} {product.unit}
                                                </span>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            addToCart(product, isIceTube ? 'kilos' : 'bottle');
                                                        }}
                                                        className="px-3 py-1 bg-cyan-500 text-white text-sm rounded hover:bg-cyan-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                                        disabled={product.current_quantity <= 0}
                                                    >
                                                        {unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)}
                                                    </button>
                                                    {!isIceTube && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                addToCart(product, 'case');
                                                            }}
                                                            className="px-3 py-1 bg-amber-500 text-white text-sm rounded hover:bg-amber-600 transition-colors"
                                                        >
                                                            Case
                                                        </button>
                                                    )}
                                                    {!isIceTube && product.price_per_case_cold && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                addToCart(product, 'case', true);
                                                            }}
                                                            className="px-3 py-1 bg-sky-500 text-white text-sm rounded hover:bg-sky-600 transition-colors"
                                                            title={`Cold case: ${formatCurrency(product.price_per_case_cold)}`}
                                                        >
                                                            Case (Cold)
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cart Section */}
                    <div className="lg:col-span-1" ref={cartRef}>
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <ShoppingCart className="w-5 h-5" />
                                    Cart ({cart.length})
                                </h2>
                                <button
                                    onClick={clearCart}
                                    disabled={cart.length === 0}
                                    className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Clear
                                    <Kbd>F8</Kbd>
                                </button>
                            </div>
                            <div className="p-4">
                                <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                                    {cart.map((item, index) => (
                                        <div key={index} className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-gray-900 dark:text-white">{item.product.product_name}</h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {item.unit_type}{item.is_cold ? ' (cold)' : ''} × {item.quantity}
                                                </p>
                                                <p className="text-xs text-cyan-600 dark:text-cyan-400">
                                                    {formatCurrency(item.subtotal / item.quantity)} / {item.unit_type}{item.is_cold ? ' (cold)' : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => updateQuantity(item, item.quantity - 1)}
                                                    className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="w-8 text-center font-medium">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item, item.quantity + 1)}
                                                    className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => removeFromCart(item)}
                                                    className="w-6 h-6 rounded-full bg-red-200 dark:bg-red-900 flex items-center justify-center hover:bg-red-300 dark:hover:bg-red-800"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {cart.length > 0 && (
                                    <>
                                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600 dark:text-gray-400">Subtotal (VAT excluded):</span>
                                                    <span className="font-medium">{formatCurrency(getSubtotalWithoutVAT())}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600 dark:text-gray-400">VAT (12%):</span>
                                                    <span className="font-medium">{formatCurrency(getVATAmount())}</span>
                                                </div>
                                                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                                                    <span>Total (VAT included):</span>
                                                    <span className="text-cyan-600 dark:text-cyan-400">{formatCurrency(getTotal())}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Payment Method
                                                </label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {paymentMethods.map((method) => (
                                                        <button
                                                            key={method.id}
                                                            onClick={() => setSelectedPaymentMethod(method.id)}
                                                            className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${
                                                                selectedPaymentMethod === method.id
                                                                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400'
                                                                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                            }`}
                                                        >
                                                            <method.icon className="w-4 h-4" />
                                                            <span className="text-sm font-medium">{method.name}</span>
                                                            <Kbd>{method.id === 'cash' ? 'F2' : 'F3'}</Kbd>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {selectedPaymentMethod === 'cash' && (
                                                <div className="mb-4">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        Cash Received
                                                    </label>
                                                    <input
                                                        ref={cashInputRef}
                                                        type="number"
                                                        placeholder="0.00"
                                                        max={MAX_CASH_RECEIVED}
                                                        value={cashReceived}
                                                        onChange={(e) => setCashReceived(e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                                    />
                                                    {parseFloat(cashReceived) > MAX_CASH_RECEIVED ? (
                                                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                                            Amount is too large. Enter up to {formatCurrency(MAX_CASH_RECEIVED)}.
                                                        </p>
                                                    ) : parseFloat(cashReceived) > getTotal() && (
                                                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                                            Change: {formatCurrency(getChange())}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            <button
                                                onClick={processSale}
                                                disabled={loading || cart.length === 0 || (selectedPaymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < getTotal() || parseFloat(cashReceived) > MAX_CASH_RECEIVED))}
                                                className="w-full py-3 bg-cyan-500 text-white font-medium rounded-lg hover:bg-cyan-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                                            >
                                                {loading ? 'Processing...' : (
                                                    <span className="flex items-center">
                                                        Complete Sale
                                                        <Kbd>F9</Kbd>
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>


                {/* GCash Payment Modal */}
                {showGcashModal && (
                    <>
                        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-4 text-center">GCash Payment</h3>
                            
                            <div className="text-center mb-6">
                                <img
                                    src="/images/gcash-qr.png"
                                    alt="GCash QR Code"
                                    className="w-48 h-48 mx-auto mb-4 border-2 border-gray-300 rounded-lg"
                                />
                                <p className="text-sm text-gray-600 mb-2">Scan the QR code above to pay</p>
                                <p className="font-bold text-lg">Total Amount: {formatCurrency(getTotal())}</p>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Payment Proof Type
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setGcashProofType('screenshot')}
                                        className={`px-3 py-2 rounded-lg border transition-colors ${
                                            gcashProofType === 'screenshot'
                                                ? 'border-cyan-500 bg-cyan-50 text-cyan-600'
                                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        Screenshot
                                    </button>
                                    <button
                                        onClick={() => setGcashProofType('transaction_id')}
                                        className={`px-3 py-2 rounded-lg border transition-colors ${
                                            gcashProofType === 'transaction_id'
                                                ? 'border-cyan-500 bg-cyan-50 text-cyan-600'
                                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        Transaction ID
                                    </button>
                                </div>
                            </div>

                            {gcashProofType === 'screenshot' ? (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Upload Payment Screenshot
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setGcashPaymentProof(reader.result as string);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                    {gcashPaymentProof && (
                                        <div className="mt-2">
                                            <img 
                                                src={gcashPaymentProof} 
                                                alt="Payment proof" 
                                                className="w-full h-32 object-cover rounded-lg border"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Transaction ID
                                    </label>
                                    <input
                                        ref={gcashInputRef}
                                        type="text"
                                        placeholder="Enter GCash transaction ID"
                                        value={gcashTransactionId}
                                        onChange={(e) => setGcashTransactionId(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowGcashModal(false);
                                        setGcashPaymentProof('');
                                        setGcashTransactionId('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={processGcashSale}
                                    disabled={loading || (!gcashPaymentProof && !gcashTransactionId)}
                                    className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Processing...' : 'Confirm Payment'}
                                </button>
                            </div>
                        </div>
                    </div>
                    </>
                )}

                {/* Receipt Modal */}
                {showReceipt && currentSale && (
                    <div className="fixed inset-0 bg-transparent backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-4 max-w-sm w-full font-mono text-sm text-black max-h-[90vh] overflow-y-auto">
                            <div className="text-center mb-6">
                                <div className="flex justify-center mb-3">
                                    <img 
                                        src="/images/LOGO.jpg" 
                                        alt="Mejeck Ice Plant Logo" 
                                        className="w-16 h-16 object-contain"
                                        onError={(e) => {
                                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9ImJsYWNrIi8+Cjx0ZXh0IHg9IjMyIiB5PSIzOCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk1JPC90ZXh0Pgo8L3N2Zz4=';
                                        }}
                                    />
                                </div>
                                <div className="border-t border-b border-black py-2 mb-2">
                                    <h2 className="text-lg font-bold">SALES RECEIPT</h2>
                                </div>
                                <p className="font-bold">MEJECK ICE PLANT</p>
                                <p className="text-xs">Lacuna St. Pob. 2 Penaranda, Nueva Ecija</p>
                                <p className="text-xs">Tel: +63 (968) 600-1910</p>
                            </div>
                            
                            <div className="border-t border-b border-dashed border-black py-3 mb-3">
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span>Receipt #:</span>
                                        <span>{currentSale.receipt_number}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Date:</span>
                                        <span>{new Date(currentSale.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Time:</span>
                                        <span>{new Date(currentSale.created_at).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Customer:</span>
                                        <span>WALK-IN</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Payment:</span>
                                        <span>{currentSale.payment_method.toUpperCase()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Scrolls on its own instead of stretching the whole
                                receipt card — a long order shouldn't push the
                                totals and Print/Close/Void buttons off screen. */}
                            <div className="mb-3 max-h-72 overflow-y-auto receipt-items-scroll">
                                <div className="space-y-1">
                                    {currentSale.items.map((item: any, index: number) => (
                                        <div key={index} className="border-b border-dashed border-gray-300 pb-1 mb-1">
                                            <div className="flex justify-between">
                                                <span className="font-semibold">{item.product_name.toUpperCase()}</span>
                                                <span>{formatCurrency(item.subtotal)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span>{item.quantity} {item.unit_type.toUpperCase()}{item.is_cold ? ' (COLD)' : ''} @ {formatCurrency(item.subtotal / item.quantity)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-b border-black pt-2 pb-3">
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span>SUBTOTAL:</span>
                                        <span>{formatCurrency(currentSale.subtotal_without_vat || (currentSale.total_amount / 1.12))}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>VAT (12%):</span>
                                        <span>{formatCurrency(currentSale.vat_amount || (currentSale.total_amount - (currentSale.total_amount / 1.12)))}</span>
                                    </div>
                                    <div className="border-t border-dashed border-black pt-1 mt-1">
                                        <div className="flex justify-between font-bold text-base">
                                            <span>TOTAL:</span>
                                            <span>{formatCurrency(currentSale.total_amount)}</span>
                                        </div>
                                    </div>
                                    {currentSale.cash_received && (
                                        <>
                                            <div className="flex justify-between">
                                                <span>CASH:</span>
                                                <span>{formatCurrency(currentSale.cash_received)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>CHANGE:</span>
                                                <span>{formatCurrency(currentSale.change)}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="text-center mt-4 pt-3 border-t border-dashed border-black">
                                <p className="text-xs font-bold">THANK YOU FOR YOUR PURCHASE!</p>
                                <p className="text-xs mt-1">PLEASE COME AGAIN</p>
                                <p className="text-xs mt-2">*** THIS IS YOUR OFFICIAL RECEIPT ***</p>
                            </div>

                            {/* This whole block is the last child of the receipt card, which
                                the @media print rule above hides so none of these controls
                                (print/close, or the void option) end up on the paper receipt. */}
                            <div>
                                <div className="mt-4 text-center flex gap-2">
                                    <button
                                        onClick={printReceipt}
                                        className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Printer className="w-4 h-4" />
                                        PRINT RECEIPT
                                    </button>
                                    <button
                                        onClick={() => setShowReceipt(false)}
                                        className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
                                    >
                                        CLOSE
                                    </button>
                                </div>

                                {/* Quick undo for a mistake caught right here — no need to go
                                    find this sale in Sales History for something this fresh. */}
                                <div className="mt-2 text-center">
                                    {currentSaleVoided ? (
                                        <p className="text-sm font-semibold text-red-600">
                                            THIS SALE HAS BEEN VOIDED
                                        </p>
                                    ) : (
                                        <button
                                            onClick={voidCurrentSale}
                                            className="w-full px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors flex items-center justify-center gap-2 text-sm"
                                        >
                                            <Ban className="w-4 h-4" />
                                            VOID
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Void Reason Modal — replaces window.prompt() so it's
                    centered like the rest of the app's modals instead of
                    wherever the browser puts a native dialog. z-[60] (not
                    z-50) since it opens on top of the receipt modal, which
                    is also z-50 — same stacking order for same-z-index
                    elements would otherwise put the receipt (later in the
                    DOM) above this one. */}
                {voidReasonModalOpen && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[60] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Ban className="w-5 h-5 text-red-600" />
                                        Void This Sale
                                    </h2>
                                    <button
                                        onClick={() => { setVoidReasonModalOpen(false); setVoidReason(''); setVoidReasonPreset(''); }}
                                        disabled={voiding}
                                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>

                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Reason for voiding
                                </label>
                                <select
                                    value={voidReasonPreset}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setVoidReasonPreset(value);
                                        setVoidReason(value === OTHER_VOID_REASON ? '' : value);
                                    }}
                                    autoFocus
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                >
                                    <option value="">Select a reason...</option>
                                    {VOID_SALE_REASONS.map((reason) => (
                                        <option key={reason} value={reason}>{reason}</option>
                                    ))}
                                    <option value={OTHER_VOID_REASON}>Others (please specify)</option>
                                </select>
                                {voidReasonPreset === OTHER_VOID_REASON && (
                                    <textarea
                                        value={voidReason}
                                        onChange={(e) => setVoidReason(e.target.value)}
                                        rows={3}
                                        placeholder="Enter your own reason..."
                                        autoFocus
                                        className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    />
                                )}

                                <div className="mt-6 flex justify-end gap-3">
                                    <button
                                        onClick={() => { setVoidReasonModalOpen(false); setVoidReason(''); setVoidReasonPreset(''); }}
                                        disabled={voiding}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmVoidCurrentSale}
                                        disabled={!voidReason.trim() || voiding}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {voiding ? 'Voiding...' : 'Void Sale'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppSidebarLayout>
    );
}
