import { useState, useEffect, useRef, useCallback } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    Package,
    Clock,
    CheckCircle,
    AlertTriangle,
    Search,
    Eye,
    AlertCircle,
    PackageOpen,
    ChevronDown,
    XCircle,
} from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';
import { getCsrfHeaders } from '@/lib/csrf';
import PullToRefresh from '@/components/pull-to-refresh';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirmModal } from '@/hooks/useConfirmModal';
import { calculateRefundPreview, isFullPaymentRefund } from '@/hooks/useRefundPreview';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
    product_name: string;
    quantity: number | string;
    unit_price: number | string;
    subtotal?: number | string;
    image?: string;
}

interface DeliveredOrder {
    order_id: number;
    total_amount: number;
    status: string;
    order_date: string;
    order_type: string;
    payment_status?: string;
    items?: OrderItem[];
}

interface PreOrderItem {
    quantity: number | string;
    unit_price: number | string;
    subtotal: number | string;
    product?: {
        product_name: string;
        image?: string | null;
    };
}

interface PreOrder {
    order_id: number;
    total_amount: number;
    status: string;
    order_date: string;
    order_type: string;
    payment_method?: string;
    payment_status?: string;
    down_payment?: number;
    gcash_screenshot?: string | null;
    refund_status?: 'none' | 'requested' | 'completed';
    refund_amount?: number;
    refund_completed_at?: string | null;
    order_items?: PreOrderItem[];
    delivery?: {
        delivery_status: string;
        rider?: {
            full_name: string;
            contact_number?: string;
        } | null;
    } | null;
}

interface MyOrdersProps {
    deliveredOrders: DeliveredOrder[];
}

// ─── Report types shown on delivered orders ───────────────────────────────────

const reportTypes = [
    { type: 'damaged_beverages',  title: 'Damaged Beverages',  icon: AlertTriangle, color: 'red' },
    { type: 'wrong_product',      title: 'Wrong Product',      icon: PackageOpen,   color: 'orange' },
    { type: 'delivery_boy_issue', title: 'Delivery Boy Issue', icon: AlertCircle,   color: 'yellow' },
    { type: 'other',              title: 'Other Issue',        icon: AlertCircle,   color: 'gray' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function MyOrders({ deliveredOrders: initialDeliveredOrders }: MyOrdersProps) {
    const [activeTab, setActiveTab] = useState<'preorders' | 'delivered' | 'cancelled'>('preorders');
    const [preOrders, setPreOrders] = useState<PreOrder[]>([]);
    const [preOrdersLoading, setPreOrdersLoading] = useState(false);
    const [deliveredOrders, setDeliveredOrders] = useState<DeliveredOrder[]>(initialDeliveredOrders);
    const [cancelledOrders, setCancelledOrders] = useState<PreOrder[]>([]);
    const [justDelivered, setJustDelivered] = useState<PreOrder[]>([]);
    const [deliveredPopup, setDeliveredPopup] = useState<PreOrder | null>(null);
    // Centered confirm() replacement, used for "Cancel this order?" below.
    const { confirm, confirmModalProps } = useConfirmModal();

    // Esc dismisses the "Order Delivered" popup (same as its Close button)
    useEffect(() => {
        if (!deliveredPopup) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            setJustDelivered(prev => prev.filter(o => o.order_id !== deliveredPopup.order_id));
            setDeliveredPopup(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [deliveredPopup]);

    // Esc cancels the confirm() replacement, same as its Cancel button.
    useEffect(() => {
        if (!confirmModalProps.open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            confirmModalProps.onCancel();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [confirmModalProps.open]);
    const prevActiveIdsRef = useRef<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

    const toggleExpand = (orderId: number) => {
        setExpandedOrders(prev => {
            const next = new Set(prev);
            next.has(orderId) ? next.delete(orderId) : next.add(orderId);
            return next;
        });
    };

    const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);

    const handleCancelOrder = async (order: PreOrder) => {
        // Preview only — the server independently recomputes and persists the
        // authoritative amount (RefundService::requestForCancellation), based
        // on whether the payment was actually confirmed received, not just
        // sent. This is just what to show in the confirmation prompt.
        const refundAmount = calculateRefundPreview(order);
        const message = refundAmount > 0
            ? `You paid ₱${refundAmount.toFixed(2)} ${isFullPaymentRefund(order) ? 'in full' : 'as a down payment'} via GCash for this order. Cancelling will create a refund request for ₱${refundAmount.toFixed(2)} — our team will send it back manually. Continue?`
            : 'Cancel this order? This cannot be undone.';
        if (!(await confirm({ message, title: 'Cancel Order?', danger: true }))) return;
        setCancellingOrderId(order.order_id);
        router.post(`/customer/pre-orders/${order.order_id}/cancel`, {}, {
            preserveScroll: true,
            preserveState: true,
            // No manual showToast here — the backend already sets flash.success
            // with the specific message (including refund amount when
            // applicable), which FlashToaster picks up automatically on this
            // same Inertia visit.
            onSuccess: () => setPreOrders(prev => prev.filter(o => o.order_id !== order.order_id)),
            onFinish: () => setCancellingOrderId(null),
        });
    };

    // Extracted so both the background poll below and the pull-to-refresh
    // gesture can trigger the exact same fetch/merge logic.
    const isMountedRef = useRef(true);
    const fetchOrders = useCallback(async (isFirst = false) => {
        if (isFirst) setPreOrdersLoading(true);
        try {
            const res = await fetch('/customer/orders', {
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json', ...getCsrfHeaders() },
            });
            if (res.ok && isMountedRef.current) {
                const data: PreOrder[] = await res.json();
                const activeOrders = data.filter(o =>
                    ['preorder', 'delivery'].includes(o.order_type) &&
                    ['Pending', 'Processing', 'Ready to Deliver'].includes(o.status)
                );
                setPreOrders(activeOrders);

                // Detect orders that just transitioned to Delivered
                const allDelivered = data.filter(o =>
                    ['preorder', 'delivery'].includes(o.order_type) &&
                    ['Delivered', 'Completed'].includes(o.status)
                );
                const newActiveIds = new Set(activeOrders.map(o => o.order_id));
                const brandNew = allDelivered.filter(o =>
                    prevActiveIdsRef.current.has(o.order_id) && !newActiveIds.has(o.order_id)
                );
                if (brandNew.length > 0) {
                    setJustDelivered(prev => {
                        const ids = new Set(prev.map(o => o.order_id));
                        return [...prev, ...brandNew.filter(o => !ids.has(o.order_id))];
                    });
                    setDeliveredPopup(brandNew[0]);
                }
                prevActiveIdsRef.current = newActiveIds;

                // Sync delivered orders tab
                if (allDelivered.length > 0) {
                    setDeliveredOrders(prev => {
                        const existingIds = new Set(prev.map(o => o.order_id));
                        const toAdd = allDelivered.filter(o => !existingIds.has(o.order_id));
                        return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
                    });
                }

                // Sync cancelled orders tab
                const allCancelled = data.filter(o =>
                    ['preorder', 'delivery'].includes(o.order_type) &&
                    o.status === 'Cancelled'
                );
                setCancelledOrders(allCancelled);
            }
        } catch { /* silent */ }
        if (isFirst && isMountedRef.current) setPreOrdersLoading(false);
    }, []);

    // Poll /customer/orders every 10 seconds — updates both Active Orders and Delivered Orders
    useEffect(() => {
        isMountedRef.current = true;
        fetchOrders(true);
        const interval = setInterval(() => fetchOrders(false), 10000);

        return () => {
            isMountedRef.current = false;
            clearInterval(interval);
        };
    }, [fetchOrders]);

    // ── Helpers ────────────────────────────────────────────────────────────────

    const getDisplayStatus = (order: PreOrder): string => {
        if (order.delivery?.delivery_status === 'Out for Delivery') return 'Out for Delivery';
        if (order.delivery?.delivery_status === 'Pending') return 'Processing';
        if (order.status === 'Ready to Deliver') return 'Processing';
        return order.status;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed':         return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300';
            case 'Delivered':         return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
            case 'Out for Delivery':  return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300';
            case 'Processing':        return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
            case 'Pending':           return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300';
            case 'Cancelled':         return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
            default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200';
        }
    };

    const getOrderStep = (order: PreOrder) => {
        if (order.status === 'Delivered') return 3;
        if (order.delivery?.delivery_status === 'Out for Delivery') return 2;
        if (order.delivery) return 1; // rider assigned but not started yet
        if (order.status === 'Processing' || order.status === 'Ready to Deliver') return 1;
        return 0;
    };

    const stepLabels = ['Pending', 'Processing', 'Out for Delivery', 'Delivered'];

    // ── Filtered delivered orders ──────────────────────────────────────────────

    const filteredDelivered = deliveredOrders.filter(order => {
        if (!searchQuery) return true;
        return (
            order.order_id.toString().includes(searchQuery) ||
            order.order_type.toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
            <Head title="My Orders" />
            <CustomerNav currentPage="orders" />

            <PullToRefresh onRefresh={() => fetchOrders(false)}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
                {/* Page heading */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Orders</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Track your active orders and review delivered items.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl mb-6 w-fit">
                    <button
                        onClick={() => setActiveTab('preorders')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'preorders'
                                ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <Clock className="w-4 h-4" />
                        Active Orders
                        {preOrders.length > 0 && (
                            <span className="bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 text-xs font-semibold rounded-full px-2 py-0.5">
                                {preOrders.length}
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-green-500 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            LIVE
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('delivered')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'delivered'
                                ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <CheckCircle className="w-4 h-4" />
                        Delivered Orders
                        {deliveredOrders.length > 0 && (
                            <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-semibold rounded-full px-2 py-0.5">
                                {deliveredOrders.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('cancelled')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'cancelled'
                                ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        <AlertCircle className="w-4 h-4" />
                        Cancelled Orders
                        {cancelledOrders.length > 0 && (
                            <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-semibold rounded-full px-2 py-0.5">
                                {cancelledOrders.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* ── DELIVERED POPUP ── */}
                {deliveredPopup && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-bounce-once">
                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-12 h-12 text-green-500 dark:text-green-400" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Order Delivered!</h2>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
                                Order <span className="font-semibold text-gray-700 dark:text-gray-300">#{deliveredPopup.order_id}</span> has been successfully delivered.
                            </p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mb-6">
                                ₱{Number(deliveredPopup.total_amount).toFixed(2)}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setJustDelivered(prev => prev.filter(o => o.order_id !== deliveredPopup!.order_id));
                                        setDeliveredPopup(null);
                                    }}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        setJustDelivered(prev => prev.filter(o => o.order_id !== deliveredPopup!.order_id));
                                        setDeliveredPopup(null);
                                        setActiveTab('delivered');
                                    }}
                                    className="flex-1 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors"
                                >
                                    View Receipt
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── PRE-ORDERS TAB ── */}
                {activeTab === 'preorders' && (
                    <div>
                        {preOrdersLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500" />
                            </div>
                        ) : preOrders.length === 0 && justDelivered.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                                <Package className="w-14 h-14 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Active Orders</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                                    You have no active orders at the moment.
                                </p>
                                <Link
                                    href="/customer/dashboard"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium"
                                >
                                    Browse Products
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Just-delivered orders shown briefly with all steps completed */}
                                {justDelivered.map(order => (
                                    <div key={`delivered-${order.order_id}`} className="bg-white dark:bg-slate-800 rounded-xl border-2 border-green-400 dark:border-green-600 shadow-md overflow-hidden">
                                        <div className="bg-green-50 dark:bg-green-900/30 px-5 py-3 flex items-center gap-2">
                                            <CheckCircle className="w-5 h-5 text-green-500" />
                                            <span className="text-sm font-semibold text-green-700 dark:text-green-400">Your order has been delivered!</span>
                                        </div>
                                        <div className="px-5 py-4 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">Order #{order.order_id}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(order.order_date).toLocaleString()}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Delivered</span>
                                                <span className="font-bold text-gray-900 dark:text-white">₱{Number(order.total_amount).toFixed(2)}</span>
                                            </div>
                                        </div>
                                        {/* Full 4-step tracker with all steps completed */}
                                        <div className="px-5 pb-4">
                                            <div className="flex items-start justify-between relative">
                                                <div className="absolute top-4 left-0 right-0 h-0.5 bg-cyan-500 z-0" />
                                                {['Pending', 'Processing', 'Out for Delivery', 'Delivered'].map((label) => (
                                                    <div key={label} className="flex flex-col items-center z-10 flex-1">
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 bg-cyan-500 border-cyan-500 text-white">
                                                            <CheckCircle className="w-4 h-4" />
                                                        </div>
                                                        <span className="mt-1.5 text-[11px] text-center font-medium leading-tight max-w-[60px] text-cyan-600 dark:text-cyan-400">{label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="px-5 pb-4 flex justify-end gap-2">
                                            <button
                                                onClick={() => setJustDelivered(prev => prev.filter(o => o.order_id !== order.order_id))}
                                                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                            >
                                                Dismiss
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setJustDelivered(prev => prev.filter(o => o.order_id !== order.order_id));
                                                    setActiveTab('delivered');
                                                }}
                                                className="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline transition-colors"
                                            >
                                                View in Delivered Orders →
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {preOrders.map(order => {
                                    const isExpanded = expandedOrders.has(order.order_id);
                                    const downPayment = order.down_payment ?? 0;
                                    const items = order.order_items ?? [];
                                    return (
                                        <div
                                            key={order.order_id}
                                            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden"
                                        >
                                            {/* ── Clickable Header ── */}
                                            <div
                                                onClick={() => toggleExpand(order.order_id)}
                                                className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 text-left cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
                                                        <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900 dark:text-white">
                                                            Order #{order.order_id}
                                                        </p>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            {new Date(order.order_date).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(getDisplayStatus(order))}`}>
                                                        {getDisplayStatus(order)}
                                                    </span>
                                                    {order.payment_method && (
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                                                            {order.payment_method}
                                                        </span>
                                                    )}
                                                    <span className="font-bold text-gray-900 dark:text-white">
                                                        ₱{Number(order.total_amount).toFixed(2)}
                                                    </span>
                                                    {['Pending', 'Processing'].includes(order.status) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCancelOrder(order);
                                                            }}
                                                            disabled={cancellingOrderId === order.order_id}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                            {cancellingOrderId === order.order_id ? 'Cancelling…' : 'Cancel'}
                                                        </button>
                                                    )}
                                                    <ChevronDown
                                                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                                    />
                                                </div>
                                            </div>

                                            {/* ── Order Progress Tracker ── */}
                                            {(() => {
                                                const currentStep = getOrderStep(order);
                                                return (
                                                    <div className="px-5 pb-4">
                                                        <div className="flex items-start justify-between relative">
                                                            {/* grey track */}
                                                            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 dark:bg-slate-600 z-0" />
                                                            {/* cyan fill */}
                                                            <div
                                                                className="absolute top-4 left-0 h-0.5 bg-cyan-500 z-0 transition-all duration-700"
                                                                style={{ width: `${(currentStep / (stepLabels.length - 1)) * 100}%` }}
                                                            />
                                                            {stepLabels.map((label, index) => {
                                                                const done = index <= currentStep;
                                                                return (
                                                                    <div key={label} className="flex flex-col items-center z-10 flex-1">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                                                                            done
                                                                                ? 'bg-cyan-500 border-cyan-500 text-white'
                                                                                : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-400'
                                                                        }`}>
                                                                            {done
                                                                                ? <CheckCircle className="w-4 h-4" />
                                                                                : <Clock className="w-4 h-4" />
                                                                            }
                                                                        </div>
                                                                        <span className={`mt-1.5 text-[11px] text-center font-medium leading-tight max-w-[60px] ${
                                                                            done ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-400 dark:text-gray-500'
                                                                        }`}>
                                                                            {label}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* ── Expandable Order Summary ── */}
                                            {isExpanded && (
                                                <div className="border-t border-gray-100 dark:border-slate-700 px-5 pb-5 pt-4">
                                                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
                                                        Order Summary
                                                    </p>

                                                    {items.length === 0 ? (
                                                        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                                                            No item details available.
                                                        </p>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            {items.map((item, idx) => (
                                                                <div key={idx} className="flex items-center gap-3">
                                                                    <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                                        {item.product?.image ? (
                                                                            <img
                                                                                src={`/${item.product.image}`}
                                                                                alt={item.product.product_name}
                                                                                className="w-full h-full object-cover"
                                                                            />
                                                                        ) : (
                                                                            <Package className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                                                                            {item.product?.product_name ?? '—'}
                                                                        </p>
                                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                            ₱{Number(item.unit_price).toFixed(2)} · Qty: {Math.round(Number(item.quantity))}
                                                                        </p>
                                                                    </div>
                                                                    <p className="text-base font-bold text-gray-900 dark:text-white flex-shrink-0">
                                                                        ₱{Number(item.subtotal).toFixed(2)}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Rider info */}
                                                    {order.delivery?.rider && (
                                                        <div className="border-t border-gray-100 dark:border-slate-700 mt-4 pt-3">
                                                            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Delivery Rider</p>
                                                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                                <span className="font-medium">{order.delivery.rider.full_name}</span>
                                                                {order.delivery.rider.contact_number && (
                                                                    <span className="text-gray-400 dark:text-gray-500">· {order.delivery.rider.contact_number}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Totals */}
                                                    <div className="border-t border-gray-100 dark:border-slate-700 mt-4 pt-3 space-y-1.5">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-gray-500 dark:text-gray-400">Total</span>
                                                            <span className="font-bold text-cyan-600 dark:text-cyan-400">
                                                                ₱{Number(order.total_amount).toFixed(2)}
                                                            </span>
                                                        </div>
                                                        {downPayment > 0 && (
                                                            <>
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-gray-500 dark:text-gray-400">Down Payment</span>
                                                                    <span className="font-medium text-green-600 dark:text-green-400">
                                                                        −₱{Number(downPayment).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="font-semibold text-gray-900 dark:text-white">Remaining Balance</span>
                                                                    <span className="font-bold text-orange-600 dark:text-orange-400">
                                                                        ₱{(Number(order.total_amount) - Number(downPayment)).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── DELIVERED ORDERS TAB ── */}
                {activeTab === 'delivered' && (
                    <div>
                        {/* Search */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 mb-5 shadow-sm">
                            <div className="relative max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search by order ID or type…"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors"
                                />
                            </div>
                        </div>

                        {filteredDelivered.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                                <CheckCircle className="w-14 h-14 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Delivered Orders</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                    {searchQuery ? 'No orders match your search.' : 'Your delivered orders will appear here.'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredDelivered.map(order => (
                                    <div
                                        key={order.order_id}
                                        className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm"
                                    >
                                        {/* Order header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                        Order #{order.order_id}
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        {new Date(order.order_date).toLocaleDateString()} ·{' '}
                                                        <span className="capitalize">{order.order_type}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(getDisplayStatus(order))}`}>
                                                    {getDisplayStatus(order)}
                                                </span>
                                                {order.payment_status && (
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                                                        {order.payment_status}
                                                    </span>
                                                )}
                                                <span className="font-bold text-gray-900 dark:text-white">
                                                    ₱{Number(order.total_amount).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Order items */}
                                        {order.items && order.items.length > 0 && (
                                            <div className="border-t border-gray-100 dark:border-slate-700 pt-3 mb-4">
                                                <div className="space-y-3">
                                                    {order.items.map((item, idx) => (
                                                        <div key={idx} className="flex items-center gap-3">
                                                            <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                                                {item.image ? (
                                                                    <img
                                                                        src={`/${item.image}`}
                                                                        alt={item.product_name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <Package className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                                                                    {item.product_name}
                                                                </p>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    ₱{Number(item.unit_price).toFixed(2)} · Qty: {Math.round(Number(item.quantity))}
                                                                </p>
                                                            </div>
                                                            <p className="text-base font-bold text-gray-900 dark:text-white flex-shrink-0">
                                                                ₱{Number(item.subtotal ?? Number(item.unit_price) * Math.round(Number(item.quantity))).toFixed(2)}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <Link
                                                href={route('customer.orders.show', order.order_id)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-700 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                View Details
                                            </Link>
                                            {reportTypes.map(rt => (
                                                <Link
                                                    key={rt.type}
                                                    href={`${route('customer.reports.create', order.order_id)}?report_type=${rt.type}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    <rt.icon className="w-3.5 h-3.5" />
                                                    Report: {rt.title}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── CANCELLED ORDERS TAB ── */}
                {activeTab === 'cancelled' && (
                    <div>
                        {cancelledOrders.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                                <AlertCircle className="w-14 h-14 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Cancelled Orders</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                    Orders that get rejected or cancelled will appear here.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {cancelledOrders.map(order => (
                                    <div
                                        key={order.order_id}
                                        className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                        Order #{order.order_id}
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        {new Date(order.order_date).toLocaleDateString()} ·{' '}
                                                        <span className="capitalize">{order.order_type}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                                                    Cancelled
                                                </span>
                                                <span className="font-bold text-gray-900 dark:text-white">
                                                    ₱{Number(order.total_amount).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>

                                        {order.refund_status === 'requested' && (
                                            <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 rounded-lg mb-3">
                                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                                Refund requested: ₱{Number(order.refund_amount).toFixed(2)} — our team will send this back to you manually.
                                            </div>
                                        )}
                                        {order.refund_status === 'completed' && (
                                            <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 rounded-lg mb-3">
                                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                                Refunded: ₱{Number(order.refund_amount).toFixed(2)}
                                                {order.refund_completed_at && ` on ${new Date(order.refund_completed_at).toLocaleDateString()}`}
                                            </div>
                                        )}

                                        {order.order_items && order.order_items.length > 0 && (
                                            <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                                                <div className="space-y-2">
                                                    {order.order_items.map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-sm">
                                                            <span className="text-gray-600 dark:text-gray-300">
                                                                {item.product?.product_name ?? 'Product'} × {Math.round(Number(item.quantity))}
                                                            </span>
                                                            <span className="font-medium text-gray-900 dark:text-white">
                                                                ₱{Number(item.subtotal).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            </PullToRefresh>

            <ConfirmModal {...confirmModalProps} />
        </div>
    );
}
