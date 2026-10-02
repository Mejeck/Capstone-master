import { Head } from '@inertiajs/react';
import AppHeaderLayout from '@/layouts/app/app-header-layout';
import { type BreadcrumbItem } from '@/types';
import { useState, useEffect, type ReactNode } from 'react';
import { showToast } from '@/lib/toast';
import { PAYMENT_PROOF_REJECTION_REASONS, OTHER_REJECTION_REASON } from '@/constants/rejectionReasons';
import { notifyPendingPaymentsUpdated } from '@/lib/cashier-events';
import { storageUrl } from '@/lib/storage-url';
import { getCsrfHeaders } from '@/lib/csrf';
import {
    Package,
    Clock,
    CheckCircle,
    XCircle,
    Truck,
    User,
    Eye,
    CreditCard,
    MapPin,
    Phone,
    Mail,
    ZoomIn,
    X,
    RefreshCw,
    ClipboardList,
    UserCheck,
    Wallet,
    Flag,
    Ban,
    ShieldCheck,
    AlertCircle,
    Store,
    ChevronRight,
    Search,
    ArrowDown,
    ArrowUp,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PendingOrderItem {
    product_name: string;
    quantity: number;
}

interface GcashItem {
    order_id: number;
    user_id: number;
    customer_name: string;
    order_type: string;
    total_amount: number;
    order_date: string;
    gcash_screenshot: string | null;
    gcash_resubmit_count: number;
    gcash_rejected_count: number;
    gcash_flagged: boolean;
    customer_is_blocked: boolean;
    contact_number: string | null;
    delivery_address: string | null;
    order_items: PendingOrderItem[];
}

interface CodItem {
    order_id: number;
    user_id: number;
    customer_name: string;
    total_amount: number;
    down_payment: number;
    order_date: string;
    proof_image: string | null;
    contact_number: string | null;
    delivery_address: string | null;
    order_items: PendingOrderItem[];
}

interface Order {
    order_id: number;
    user_id: number;
    customer_id?: number;
    total_amount: number;
    status: string;
    payment_method: string;
    payment_status: string;
    approval_status: string;
    order_type: string;
    delivery_address?: string;
    order_date: string;
    notes?: string;
    gcash_screenshot?: string | null;
    refund_status?: 'none' | 'requested' | 'completed';
    refund_amount?: number;
    refund_completed_at?: string | null;
    refund_note?: string | null;
    customer?: {
        full_name: string;
        email: string;
        contact_number: string;
    };
    user?: {
        full_name: string;
        email: string;
    };
    orderItems: Array<{
        product_id: number;
        quantity: number;
        unit_price: number;
        subtotal: number;
        product: {
            product_name: string;
            inventory?: {
                current_quantity: number;
            };
        };
    }>;
    delivery?: {
        rider: {
            full_name: string;
        };
        delivery_status: string;
    };
}

interface DeliveryBoy {
    id: number;
    full_name: string;
    email: string;
    contact_number: string;
}

// ─── Breadcrumbs ─────────────────────────────────────────────────────────────

// Empty: the top nav/sidebar already shows which page is active, and
// the page has its own heading below, so a "Dashboard > X" trail here was
// just repeating both without adding a real path back anywhere new.
const breadcrumbs: BreadcrumbItem[] = [];

// ─── Component ───────────────────────────────────────────────────────────────

export default function CashierOrders() {
    const [activeTab, setActiveTab] = useState<
        'processing' | 'toPrepare' | 'assignRider' | 'outForDelivery' | 'completed' | 'rejected'
    >('processing');

    // Verification data (GCash + COD)
    const [gcashPending, setGcashPending] = useState<GcashItem[]>([]);
    const [codPending, setCodPending] = useState<CodItem[]>([]);
    const [verificationLoading, setVerificationLoading] = useState(false);
    const [hasLoadedVerification, setHasLoadedVerification] = useState(false);

    // Processing & Completed
    const [processingOrders, setProcessingOrders] = useState<Order[]>([]);
    const [processingLoading, setProcessingLoading] = useState(false);
    const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
    const [hasLoadedCompleted, setHasLoadedCompleted] = useState(false);
    const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);

    // Per-order inline rider selection
    const [inlineRider, setInlineRider] = useState<Record<number, string>>({});

    // Shared action state
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [selectedRider, setSelectedRider] = useState('');
    const [markPaidModal, setMarkPaidModal] = useState<{ orderId: number; customerName: string } | null>(null);
    const [markReadyModal, setMarkReadyModal] = useState<{ orderId: number; orderLabel: string } | null>(null);
    const [markReadyRider, setMarkReadyRider] = useState('');
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Verification modal — one modal per item (GCash or COD) with the proof,
    // customer info, rejection reason, and both Confirm/Reject actions
    // together, instead of the old expand-then-open-a-separate-popup flow.
    const [verificationModal, setVerificationModal] = useState<
        { type: 'gcash'; item: GcashItem } | { type: 'cod'; item: CodItem } | null
    >(null);
    const [verificationReason, setVerificationReason] = useState('');
    // Which dropdown option is picked — a preset reason (used verbatim as
    // verificationReason) or OTHER_REJECTION_REASON, which instead reveals a
    // free-text box for whatever isn't already covered by a preset.
    const [verificationReasonPreset, setVerificationReasonPreset] = useState('');
    const [verificationSubmitting, setVerificationSubmitting] = useState(false);
    const [blockModal, setBlockModal] = useState<{ userId: number; name: string } | null>(null);
    const [blockReason, setBlockReason] = useState('');
    const [unblockModal, setUnblockModal] = useState<{ userId: number; name: string } | null>(null);
    // A cancelled order with a confirmed payment gets a refund request
    // (RefundService, triggered on cancel/reject) — cashier handles all other
    // GCash money movement in this app, so they can mark it sent back too,
    // same action admin's Pre-Orders page already exposes.
    const [completingRefundId, setCompletingRefundId] = useState<number | null>(null);
    const [refundNote, setRefundNote] = useState('');

    // Search + sort — shared across tabs, same as admin's Pre-Orders page
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    // ─── Fetch helpers ────────────────────────────────────────────────────────

    const fetchVerification = async () => {
        setVerificationLoading(true);
        try {
            const [gcashRes, codRes] = await Promise.all([
                fetch('/cashier/api/gcash-pending'),
                fetch('/cashier/api/cod-pending'),
            ]);
            setGcashPending(gcashRes.ok ? await gcashRes.json() : []);
            setCodPending(codRes.ok ? await codRes.json() : []);
        } catch {
            console.error('Error fetching verification data');
        } finally {
            setVerificationLoading(false);
            setHasLoadedVerification(true);
        }
    };

    const fetchProcessingOrders = async () => {
        setProcessingLoading(true);
        try {
            const res = await fetch('/cashier/api/orders/processing');
            setProcessingOrders(res.ok ? await res.json() : []);
        } catch {
            console.error('Error fetching processing orders');
        } finally {
            setProcessingLoading(false);
        }
    };

    const fetchCompletedOrders = async () => {
        try {
            const res = await fetch('/cashier/api/orders/completed');
            setCompletedOrders(res.ok ? await res.json() : []);
        } catch {
            setCompletedOrders([]);
        }
    };

    const fetchDeliveryBoys = async () => {
        try {
            const res = await fetch('/cashier/api/delivery-boys');
            setDeliveryBoys(res.ok ? await res.json() : []);
        } catch {
            console.error('Error fetching delivery boys');
        }
    };

    const refreshAll = () => {
        fetchVerification();
        fetchProcessingOrders();
    };

    useEffect(() => {
        fetchVerification();
        fetchProcessingOrders();
        fetchDeliveryBoys();

        // Auto-refresh processing orders every 15 seconds
        // so cashier sees when rider starts/completes delivery without manual refresh
        const interval = setInterval(() => {
            fetchProcessingOrders();
            fetchVerification();
        }, 15000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if ((activeTab === 'completed' || activeTab === 'rejected') && !hasLoadedCompleted) {
            fetchCompletedOrders();
            setHasLoadedCompleted(true);
        }
    }, [activeTab, hasLoadedCompleted]);

    // Esc closes whichever modal is topmost: the GCash proof lightbox first
    // (it can open from either Order Details or Payment Verification), then
    // the Assign Rider modal (nested inside Order Details), then whichever
    // of Order Details / Payment Verification is actually open.
    useEffect(() => {
        if (!selectedOrder && !verificationModal && !lightboxImage && !showDeliveryModal) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (lightboxImage) {
                setLightboxImage(null);
            } else if (showDeliveryModal) {
                setShowDeliveryModal(false);
                setSelectedRider('');
            } else if (verificationModal) {
                if (verificationSubmitting) return;
                closeVerificationModal();
            } else if (selectedOrder) {
                setSelectedOrder(null);
                setRefundNote('');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedOrder, verificationModal, lightboxImage, showDeliveryModal, verificationSubmitting]);

    // ─── Verification handlers ────────────────────────────────────────────────

    // Shared by the GCash/COD confirm+reject calls below. A bare "Action
    // failed" alert used to fire for every non-2xx response and every thrown
    // error alike, which hid the real cause (an expired session's stale CSRF
    // token, another cashier already having processed the order, an actual
    // validation error, ...) from whoever was staring at the popup. This
    // gives each of those a distinct, actionable message instead.
    const postVerificationAction = async (url: string, reason?: string): Promise<'ok' | 'stop'> => {
        const body = reason ? JSON.stringify({ reason }) : undefined;
        let res: Response;
        try {
            res = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    ...getCsrfHeaders(),
                    ...(body ? { 'Content-Type': 'application/json' } : {}),
                },
                body,
            });
        } catch {
            alert('Could not reach the server. Please check your connection and try again.');
            return 'stop';
        }

        if (res.ok) return 'ok';

        if (res.status === 419) {
            // The CSRF token embedded in the page went stale — almost
            // always because this tab was left open past the session's
            // lifetime. Reloading fetches a fresh token and session.
            alert('Your session has expired. The page will reload — please try the action again after it does.');
            window.location.reload();
            return 'stop';
        }

        if (res.status === 404) {
            // firstOrFail() in the controller: the order is no longer in
            // "Awaiting Verification" — most likely another cashier (or
            // this same tab, via a double click) already actioned it.
            alert('This order was already processed. Refreshing the list.');
            fetchVerification();
            return 'stop';
        }

        let message = 'Action failed. Please try again.';
        try {
            const data = await res.json();
            const firstValidationError = data?.errors && Object.values(data.errors)[0];
            message = (Array.isArray(firstValidationError) ? firstValidationError[0] : null) || data?.message || message;
        } catch {
            // Response wasn't JSON — keep the generic message.
        }
        alert(message);
        return 'stop';
    };

    const handleGcashAction = async (orderId: number, action: 'confirm' | 'reject', reason?: string) => {
        const outcome = await postVerificationAction(`/cashier/api/gcash/${orderId}/${action}`, reason);
        if (outcome === 'ok') {
            fetchVerification();
            if (action === 'confirm') fetchProcessingOrders();
            notifyPendingPaymentsUpdated();
            showToast(action === 'confirm' ? 'success' : 'warning', action === 'confirm' ? 'GCash payment confirmed.' : 'GCash payment rejected.');
        }
        return outcome === 'ok';
    };

    const handleCodAction = async (orderId: number, action: 'confirm' | 'reject', reason?: string) => {
        const outcome = await postVerificationAction(`/cashier/api/cod/${orderId}/${action}`, reason);
        if (outcome === 'ok') {
            fetchVerification();
            if (action === 'confirm') fetchProcessingOrders();
            notifyPendingPaymentsUpdated();
            showToast(action === 'confirm' ? 'success' : 'warning', action === 'confirm' ? 'COD payment confirmed.' : 'COD payment rejected.');
        }
        return outcome === 'ok';
    };

    const closeVerificationModal = () => {
        setVerificationModal(null);
        setVerificationReason('');
        setVerificationReasonPreset('');
    };

    const submitVerification = async (action: 'confirm' | 'reject') => {
        if (!verificationModal) return;
        if (action === 'reject' && !verificationReason.trim()) {
            alert('Please select or enter a rejection reason.');
            return;
        }
        setVerificationSubmitting(true);
        const reason = action === 'reject' ? verificationReason.trim() : undefined;
        const ok = verificationModal.type === 'gcash'
            ? await handleGcashAction(verificationModal.item.order_id, action, reason)
            : await handleCodAction(verificationModal.item.order_id, action, reason);
        setVerificationSubmitting(false);
        if (ok) closeVerificationModal();
    };

    const handleBlockCustomer = async (userId: number, reason: string) => {
        try {
            const res = await fetch(`/cashier/api/customers/${userId}/block`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
                body: JSON.stringify({ reason }),
            });
            if (res.ok) {
                setBlockModal(null);
                setBlockReason('');
                fetchVerification();
                showToast('success', 'Customer blocked.');
            } else {
                alert('Failed to block customer.');
            }
        } catch {
            alert('Failed to block customer.');
        }
    };

    const handleUnblockCustomer = async (userId: number) => {
        try {
            const res = await fetch(`/cashier/api/customers/${userId}/unblock`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { ...getCsrfHeaders() },
            });
            if (res.ok) {
                setUnblockModal(null);
                fetchVerification();
                showToast('success', 'Customer unblocked.');
            } else {
                alert('Failed to unblock customer.');
            }
        } catch {
            alert('Failed to unblock customer.');
        }
    };

    const handleCompleteRefund = async (orderId: number, note?: string) => {
        setCompletingRefundId(orderId);
        try {
            const res = await fetch(`/cashier/api/orders/${orderId}/complete-refund`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
                body: JSON.stringify({ note: note || undefined }),
            });
            if (res.ok) {
                const data = await res.json();
                setCompletedOrders(prev => prev.map(o => o.order_id === orderId ? data.order : o));
                setSelectedOrder(prev => prev && prev.order_id === orderId ? data.order : prev);
                setRefundNote('');
                showToast('success', 'Refund marked as completed.');
            } else {
                alert('Failed to mark refund as completed.');
            }
        } catch {
            alert('Failed to mark refund as completed.');
        } finally {
            setCompletingRefundId(null);
        }
    };

    // ─── Order handlers ───────────────────────────────────────────────────────

    const markReadyAndAssign = async () => {
        if (!markReadyModal || !markReadyRider) return;
        setLoading(true);
        try {
            const readyRes = await fetch(`/cashier/api/orders/${markReadyModal.orderId}/mark-ready`, {
                method: 'POST',
                headers: { ...getCsrfHeaders() },
            });
            if (!readyRes.ok) {
                const err = await readyRes.json().catch(() => ({}));
                alert(err.error || 'Failed to mark order as ready');
                return;
            }
            const assignRes = await fetch(`/cashier/api/orders/${markReadyModal.orderId}/assign-delivery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getCsrfHeaders() },
                body: JSON.stringify({ rider_id: markReadyRider }),
            });
            if (assignRes.ok) {
                setMarkReadyModal(null);
                setMarkReadyRider('');
                await fetchProcessingOrders();
                showToast('success', 'Order marked ready and rider assigned.');
            } else {
                const err = await assignRes.json().catch(() => ({}));
                alert(err.error || 'Failed to assign delivery');
            }
        } catch {
            alert('Failed to process order');
        } finally {
            setLoading(false);
        }
    };

    const assignDelivery = async (orderId: number, riderId?: string) => {
        const rider = riderId ?? selectedRider;
        if (!rider) {
            alert('Please select a delivery rider');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/cashier/api/orders/${orderId}/assign-delivery`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getCsrfHeaders(),
                },
                body: JSON.stringify({ rider_id: rider }),
            });
            if (res.ok) {
                await fetchProcessingOrders();
                setShowDeliveryModal(false);
                setSelectedRider('');
                setSelectedOrder(null);
                setInlineRider((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
                showToast('success', 'Rider assigned.');
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to assign delivery');
            }
        } catch {
            alert('Failed to assign delivery');
        } finally {
            setLoading(false);
        }
    };

    const markAsPaid = async (orderId: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/cashier/api/orders/${orderId}/mark-paid`, {
                method: 'POST',
                headers: { ...getCsrfHeaders() },
            });
            if (res.ok) {
                setMarkPaidModal(null);
                await fetchProcessingOrders();
                setSelectedOrder(null);
                showToast('success', 'Order marked as paid.');
            } else {
                const err = await res.json();
                alert(err.message || 'Failed to mark as paid');
            }
        } catch {
            alert('Failed to mark as paid');
        } finally {
            setLoading(false);
        }
    };

    // ─── Utilities ────────────────────────────────────────────────────────────

    const formatCurrency = (amount: number | string) => {
        const n = typeof amount === 'string' ? parseFloat(amount) : amount;
        return `₱${n.toFixed(2)}`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
            case 'Processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            case 'Ready to Deliver': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
            case 'Ready for Pickup': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
            case 'Out for Delivery': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
            case 'Completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
            case 'Delivered': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
            case 'Cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
        }
    };

    const customerName = (order: Order) =>
        order.order_type === 'pos' ? 'Walk-in Customer' : (order.customer?.full_name || order.user?.full_name || 'Unknown');

    // Walk-in sales have no account to attribute — only show the account
    // email for orders actually placed online (delivery/pickup/preorder).
    const customerEmail = (order: Order) =>
        order.order_type === 'pos' ? null : (order.customer?.email || order.user?.email || null);

    // Raw order_type values are internal terms (e.g. "pos") that don't mean
    // much to a cashier at a glance — map each to a plain-language label and
    // icon instead of just capitalizing the DB value.
    const orderTypeMeta = (order: Order) => {
        switch (order.order_type) {
            case 'delivery': return { label: 'Delivery', icon: Truck };
            case 'pickup': return { label: 'Pickup', icon: Package };
            case 'preorder': return { label: 'Pre-order', icon: Clock };
            case 'pos':
            case 'walkin':
                return { label: 'Walk-in', icon: Store };
            default:
                return { label: order.order_type, icon: Store };
        }
    };

    // ─── Processing sub-sections ─────────────────────────────────────────────
    const outForDelivery = processingOrders.filter(
        (o) => o.delivery?.delivery_status === 'Out for Delivery',
    );
    const toPrepare = processingOrders.filter(
        (o) => o.status === 'Processing' && o.delivery?.delivery_status !== 'Out for Delivery',
    );
    const toAssignRider = processingOrders.filter(
        (o) => o.status === 'Ready to Deliver' && o.delivery?.delivery_status !== 'Out for Delivery',
    );

    const verificationCount = gcashPending.length + codPending.length;

    // ─── Completed sub-sections ──────────────────────────────────────────────
    // Goods already left the store (status stays 'Completed'/'Delivered'), but
    // a rejected/unconfirmed payment shouldn't be buried in the same list as
    // orders that were actually paid — split it into its own section.
    const unpaidCompleted = completedOrders.filter((o) => o.payment_status === 'Unpaid');
    const paidCompleted = completedOrders.filter((o) => o.payment_status !== 'Unpaid');

    // ─── Search + sort ────────────────────────────────────────────────────────
    // Same "search by order number or customer name" + date-sort behavior as
    // admin's Pre-Orders page, applied to whichever tab is active.
    const matchesSearch = (orderId: number, name: string) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        return String(orderId).includes(q) || name.toLowerCase().includes(q);
    };

    const sortByDate = <T,>(items: T[], getDate: (item: T) => string) =>
        [...items].sort((a, b) => {
            const diff = new Date(getDate(a)).getTime() - new Date(getDate(b)).getTime();
            return sortOrder === 'desc' ? -diff : diff;
        });

    const visibleGcashPending = sortByDate(
        gcashPending.filter((item) => matchesSearch(item.order_id, item.customer_name)),
        (item) => item.order_date,
    );
    const visibleCodPending = sortByDate(
        codPending.filter((item) => matchesSearch(item.order_id, item.customer_name)),
        (item) => item.order_date,
    );
    const visibleToPrepare = sortByDate(
        toPrepare.filter((o) => matchesSearch(o.order_id, customerName(o))),
        (o) => o.order_date,
    );
    const visibleToAssignRider = sortByDate(
        toAssignRider.filter((o) => matchesSearch(o.order_id, customerName(o))),
        (o) => o.order_date,
    );
    const visibleOutForDelivery = sortByDate(
        outForDelivery.filter((o) => matchesSearch(o.order_id, customerName(o))),
        (o) => o.order_date,
    );
    const visiblePaidCompleted = sortByDate(
        paidCompleted.filter((o) => matchesSearch(o.order_id, customerName(o))),
        (o) => o.order_date,
    );
    const visibleUnpaidCompleted = sortByDate(
        unpaidCompleted.filter((o) => matchesSearch(o.order_id, customerName(o))),
        (o) => o.order_date,
    );

    // Shared card chrome for every tab's list — same rounded-xl / border-2 /
    // header row (order # + date on the left, payment method + total on the
    // right) as admin's Pre-Orders renderOrderCard, so both screens read the
    // same way even though each tab below fills in different body content.
    const OrderCard = ({
        order,
        accent,
        onClick,
        children,
    }: {
        order: Order;
        accent: string;
        onClick?: () => void;
        children: ReactNode;
    }) => (
        <div
            className={`bg-white dark:bg-slate-800 rounded-xl p-4 border-2 ${accent} shadow-sm ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Order #{order.order_id}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{new Date(order.order_date).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{order.payment_method}</span>
                    <span className="font-bold text-lg text-slate-800 dark:text-slate-100">{formatCurrency(order.total_amount)}</span>
                </div>
            </div>
            {children}
        </div>
    );

    const renderCompletedCard = (order: Order, accent: string) => {
        const { label, icon: TypeIcon } = orderTypeMeta(order);
        return (
            <OrderCard key={order.order_id} order={order} accent={accent}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-3">
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 font-medium">
                        <User className="w-4 h-4 text-slate-400" />
                        {customerName(order)}
                    </div>
                    {customerEmail(order) && (
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                            <Mail className="w-4 h-4 text-slate-400" />
                            {customerEmail(order)}
                        </div>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        <TypeIcon className="w-3 h-3" />
                        {label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        order.payment_status === 'Paid'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : order.payment_status === 'Partial'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>{order.payment_status}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(order.status)}`}>{order.status}</span>
                </div>

                {order.refund_status === 'requested' && (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1.5 rounded mb-3">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        Refund owed: {formatCurrency(order.refund_amount ?? 0)}
                    </div>
                )}
                {order.refund_status === 'completed' && (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded mb-3">
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        Refunded {formatCurrency(order.refund_amount ?? 0)}
                    </div>
                )}

                <button
                    onClick={() => setSelectedOrder(order)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border border-cyan-400 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                >
                    <Eye className="w-3.5 h-3.5" /> View
                </button>
            </OrderCard>
        );
    };

    const renderToPrepareCard = (order: Order) => (
        <OrderCard key={order.order_id} order={order} accent="border-blue-200 dark:border-blue-800">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-3">
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 font-medium">
                    <User className="w-4 h-4 text-slate-400" />
                    {customerName(order)}
                </div>
                {(order.customer?.email || order.user?.email) && (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Mail className="w-4 h-4 text-slate-400" />
                        {order.customer?.email || order.user?.email}
                    </div>
                )}
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize">
                    {order.order_type === 'walkin' ? 'Walk-in' : order.order_type}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    order.payment_status === 'Paid'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : order.payment_status === 'Partial'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}>{order.payment_status}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
                <button
                    onClick={() => setSelectedOrder(order)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border border-cyan-400 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                >
                    <Eye className="w-3.5 h-3.5" /> View
                </button>
                {order.payment_status === 'Partial' && (
                    <button
                        onClick={() => setMarkPaidModal({ orderId: order.order_id, customerName: customerName(order) })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
                    >
                        <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
                    </button>
                )}
                <button
                    onClick={() => setMarkReadyModal({ orderId: order.order_id, orderLabel: `#${order.order_id}` })}
                    disabled={loading}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                    <CheckCircle className="w-3.5 h-3.5" /> Mark as Ready
                </button>
            </div>
        </OrderCard>
    );

    const renderAssignRiderCard = (order: Order) => (
        <OrderCard key={order.order_id} order={order} accent="border-violet-200 dark:border-violet-800">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-3">
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 font-medium">
                    <User className="w-4 h-4 text-slate-400" />
                    {customerName(order)}
                </div>
                {(order.customer?.contact_number || order.customer?.email || order.user?.email) && (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Phone className="w-4 h-4 text-slate-400" />
                        {order.customer?.contact_number || order.customer?.email || order.user?.email}
                    </div>
                )}
                {order.delivery_address && (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="max-w-[220px] truncate">{order.delivery_address}</span>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={() => setSelectedOrder(order)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border border-cyan-400 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors flex-shrink-0"
                >
                    <Eye className="w-3.5 h-3.5" /> View
                </button>
                {order.delivery?.rider ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
                        <Truck className="w-3.5 h-3.5" /> {order.delivery.rider.full_name}
                    </span>
                ) : (
                    <>
                        <select
                            value={inlineRider[order.order_id] ?? ''}
                            onChange={(e) => setInlineRider((prev) => ({ ...prev, [order.order_id]: e.target.value }))}
                            className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-violet-500 min-w-[130px]"
                        >
                            <option value="">Select rider...</option>
                            {deliveryBoys.map((boy) => (
                                <option key={boy.id} value={boy.id}>{boy.full_name}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => assignDelivery(order.order_id, inlineRider[order.order_id])}
                            disabled={loading || !inlineRider[order.order_id]}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-40 transition-colors flex-shrink-0"
                        >
                            <Truck className="w-3.5 h-3.5" /> Assign
                        </button>
                    </>
                )}
            </div>
        </OrderCard>
    );

    const renderOutForDeliveryCard = (order: Order) => (
        <OrderCard key={order.order_id} order={order} accent="border-indigo-200 dark:border-indigo-800">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-3">
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 font-medium">
                    <User className="w-4 h-4 text-slate-400" />
                    {customerName(order)}
                </div>
                {order.delivery_address && (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="max-w-[220px] truncate">{order.delivery_address}</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Truck className="w-4 h-4 text-indigo-500" />
                    <span className="font-medium">{order.delivery?.rider?.full_name ?? '—'}</span>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusColor(order.delivery?.delivery_status ?? order.status)}`}>
                    {order.delivery?.delivery_status ?? order.status}
                </span>
            </div>
            <button
                onClick={() => setSelectedOrder(order)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border border-cyan-400 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
            >
                <Eye className="w-3.5 h-3.5" /> View
            </button>
        </OrderCard>
    );

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <AppHeaderLayout breadcrumbs={breadcrumbs}>
            <Head title="Order Management - Mejeck Ice Plant" />
            <div className="p-6">

                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Package className="w-6 h-6" />
                        Order Management
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                        Verify payments, manage processing orders, and view order history.
                    </p>
                </div>

                {/* Tabs — filled pills matching admin's Pre-Orders page, sized to
                    always fit in a single row (6 tabs vs. admin's 5, with longer
                    labels) instead of wrapping or scrolling sideways. */}
                <div className="bg-white dark:bg-gradient-to-br dark:from-slate-900/40 dark:to-slate-800/40 rounded-xl shadow-sm border border-slate-200 dark:border-slate-500/50 mb-6">
                    <div className="flex flex-nowrap gap-2 sm:gap-3 p-3 sm:p-4">
                        <button
                            onClick={() => setActiveTab('processing')}
                            className={`relative flex items-center justify-center gap-2 min-w-0 flex-1 px-2 sm:px-5 py-3 rounded-lg font-medium transition-all text-xs sm:text-base ${
                                activeTab === 'processing'
                                    ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            <Clock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            <span className="truncate">Processing</span>
                            {verificationCount > 0 && (
                                <span className={`shrink-0 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${
                                    activeTab === 'processing' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                                }`}>
                                    {verificationCount}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => setActiveTab('toPrepare')}
                            className={`flex items-center justify-center gap-2 min-w-0 flex-1 px-2 sm:px-5 py-3 rounded-lg font-medium transition-all text-xs sm:text-base ${
                                activeTab === 'toPrepare'
                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            <span className="truncate">To Prepare ({toPrepare.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('assignRider')}
                            className={`flex items-center justify-center gap-2 min-w-0 flex-1 px-2 sm:px-5 py-3 rounded-lg font-medium transition-all text-xs sm:text-base ${
                                activeTab === 'assignRider'
                                    ? 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-200'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            <Truck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            <span className="truncate">Assign Rider ({toAssignRider.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('outForDelivery')}
                            className={`flex items-center justify-center gap-2 min-w-0 flex-1 px-2 sm:px-5 py-3 rounded-lg font-medium transition-all text-xs sm:text-base ${
                                activeTab === 'outForDelivery'
                                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            <span className="truncate">Out for Delivery ({outForDelivery.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('completed')}
                            className={`flex items-center justify-center gap-2 min-w-0 flex-1 px-2 sm:px-5 py-3 rounded-lg font-medium transition-all text-xs sm:text-base ${
                                activeTab === 'completed'
                                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            <span className="truncate">Completed ({paidCompleted.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('rejected')}
                            className={`relative flex items-center justify-center gap-2 min-w-0 flex-[1.3] px-2 sm:px-5 py-3 rounded-lg font-medium transition-all text-xs sm:text-base ${
                                activeTab === 'rejected'
                                    ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            <span className="truncate">Rejected/Unpaid</span>
                            {unpaidCompleted.length > 0 && (
                                <span className={`shrink-0 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${
                                    activeTab === 'rejected' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                }`}>
                                    {unpaidCompleted.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Search + sort */}
                <div className="flex gap-2 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by order number or customer name..."
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                    </div>
                    <button
                        onClick={() => setSortOrder((prev) => prev === 'desc' ? 'asc' : 'desc')}
                        title={`Order date is currently sorted ${sortOrder === 'desc' ? 'descending (newest at top)' : 'ascending (oldest at top)'} — click to flip it`}
                        className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                    >
                        {sortOrder === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                        Sort: {sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                    </button>
                </div>

                {/* ── Tab 1: Processing ────────────────────────────────────────── */}
                {activeTab === 'processing' && (
                    <div>
                        <div className="flex items-center justify-between mb-5">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {verificationCount > 0
                                    ? `${verificationCount} payment${verificationCount !== 1 ? 's' : ''} need verification`
                                    : 'No pending payment verifications'}
                            </p>
                            <button
                                onClick={refreshAll}
                                disabled={processingLoading || verificationLoading}
                                title="Auto-refreshes every 15 seconds"
                                className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${(processingLoading || verificationLoading) ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>

                        {verificationLoading && !hasLoadedVerification ? (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
                        ) : verificationCount === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-600 dark:text-gray-400 font-medium">No pending payment verifications</p>
                                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">GCash and COD proofs awaiting review will appear here.</p>
                            </div>
                        ) : visibleGcashPending.length === 0 && visibleCodPending.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-600 dark:text-gray-400 font-medium">No matching orders</p>
                                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Try a different order number or customer name.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">

                                {/* GCash rows — click opens the unified verification modal below
                                    (proof, customer info, reason, and both actions together),
                                    instead of expanding inline then opening a second popup. */}
                                {visibleGcashPending.map((item) => (
                                    <button
                                        key={`gcash-${item.order_id}`}
                                        onClick={() => setVerificationModal({ type: 'gcash', item })}
                                        className={`w-full flex items-center justify-between gap-3 p-3 text-left bg-white dark:bg-slate-800 rounded-xl border-2 transition-colors ${
                                            item.gcash_flagged
                                                ? 'border-red-400 dark:border-red-600 hover:bg-red-50/50 dark:hover:bg-red-900/10'
                                                : 'border-cyan-200 dark:border-cyan-800 hover:bg-cyan-50/50 dark:hover:bg-cyan-900/10'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                item.gcash_flagged ? 'bg-red-100 dark:bg-red-900/30' : 'bg-cyan-100 dark:bg-cyan-900/30'
                                            }`}>
                                                <CreditCard className={`w-4 h-4 ${item.gcash_flagged ? 'text-red-600 dark:text-red-400' : 'text-cyan-600 dark:text-cyan-400'}`} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                    Order #{item.order_id} · {item.customer_name}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    GCash · {new Date(item.order_date).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {item.gcash_flagged && (
                                                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                                                    <Flag className="w-3 h-3" /> FLAGGED
                                                </span>
                                            )}
                                            {item.customer_is_blocked && (
                                                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold bg-gray-700 text-white px-2 py-0.5 rounded-full">
                                                    <Ban className="w-3 h-3" /> BLOCKED
                                                </span>
                                            )}
                                            <span className="font-bold text-cyan-600 dark:text-cyan-400 whitespace-nowrap">{formatCurrency(item.total_amount)}</span>
                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </button>
                                ))}

                                {/* COD rows */}
                                {visibleCodPending.map((item) => (
                                    <button
                                        key={`cod-${item.order_id}`}
                                        onClick={() => setVerificationModal({ type: 'cod', item })}
                                        className="w-full flex items-center justify-between gap-3 p-3 text-left bg-white dark:bg-slate-800 rounded-xl border-2 border-amber-200 dark:border-amber-800 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                                                <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                    Order #{item.order_id} · {item.customer_name}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    COD Down Payment · {new Date(item.order_date).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">{formatCurrency(item.down_payment)}</span>
                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </button>
                                ))}
                                        </div>
                                    )}
                    </div>
                )}

                {/* ── Tab 2: To Prepare ────────────────────────────────────────── */}
                {activeTab === 'toPrepare' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {toPrepare.length > 0 ? `${toPrepare.length} order${toPrepare.length !== 1 ? 's' : ''} to prepare` : 'No orders to prepare right now'}
                            </p>
                            <button
                                onClick={refreshAll}
                                disabled={processingLoading}
                                title="Auto-refreshes every 15 seconds"
                                className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${processingLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                                {toPrepare.length === 0 ? (
                                    <div className="text-center py-8 rounded-xl border border-dashed border-blue-200 dark:border-blue-800 text-sm text-gray-500 dark:text-gray-400">
                                        No orders to prepare right now
                                    </div>
                                ) : visibleToPrepare.length === 0 ? (
                                    <div className="text-center py-8 rounded-xl border border-dashed border-blue-200 dark:border-blue-800 text-sm text-gray-500 dark:text-gray-400">
                                        No matching orders — try a different order number or customer name.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {visibleToPrepare.map(renderToPrepareCard)}
                                    </div>
                                )}
                    </div>
                )}

                {/* ── Tab 3: Assign Rider ──────────────────────────────────────── */}
                {activeTab === 'assignRider' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {toAssignRider.length > 0 ? `${toAssignRider.length} order${toAssignRider.length !== 1 ? 's' : ''} waiting for a rider` : 'No orders waiting for a rider'}
                            </p>
                            <button
                                onClick={refreshAll}
                                disabled={processingLoading}
                                title="Auto-refreshes every 15 seconds"
                                className="inline-flex items-center gap-1.5 text-sm text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${processingLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                                {toAssignRider.length === 0 ? (
                                    <div className="text-center py-8 rounded-xl border border-dashed border-violet-200 dark:border-violet-800 text-sm text-gray-500 dark:text-gray-400">
                                        No orders waiting for a rider
                                    </div>
                                ) : visibleToAssignRider.length === 0 ? (
                                    <div className="text-center py-8 rounded-xl border border-dashed border-violet-200 dark:border-violet-800 text-sm text-gray-500 dark:text-gray-400">
                                        No matching orders — try a different order number or customer name.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {visibleToAssignRider.map(renderAssignRiderCard)}
                                    </div>
                                )}
                    </div>
                )}

                {/* ── Tab 4: Out for Delivery ──────────────────────────────────── */}
                {activeTab === 'outForDelivery' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {outForDelivery.length > 0 ? `${outForDelivery.length} order${outForDelivery.length !== 1 ? 's' : ''} out for delivery` : 'No orders currently out for delivery'}
                            </p>
                            <button
                                onClick={refreshAll}
                                disabled={processingLoading}
                                title="Auto-refreshes every 15 seconds"
                                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${processingLoading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>
                                {outForDelivery.length === 0 ? (
                                    <div className="text-center py-8 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 text-sm text-gray-500 dark:text-gray-400">
                                        No orders currently out for delivery
                                    </div>
                                ) : visibleOutForDelivery.length === 0 ? (
                                    <div className="text-center py-8 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 text-sm text-gray-500 dark:text-gray-400">
                                        No matching orders — try a different order number or customer name.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {visibleOutForDelivery.map(renderOutForDeliveryCard)}
                                    </div>
                                )}
                            </div>

                )}

                {/* ── Tab 5: Completed ─────────────────────────────────────────── */}
                {activeTab === 'completed' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Completed, delivered, and cancelled orders — read only.
                            </p>
                            <button
                                onClick={() => fetchCompletedOrders()}
                                className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 hover:underline"
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Refresh
                            </button>
                        </div>
                        {paidCompleted.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <CheckCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-600 dark:text-gray-400 font-medium">No completed orders found</p>
                                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Completed, delivered, and cancelled orders will appear here.</p>
                            </div>
                        ) : visiblePaidCompleted.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-600 dark:text-gray-400 font-medium">No matching orders</p>
                                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Try a different order number or customer name.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {visiblePaidCompleted.map((order) => renderCompletedCard(order, 'border-green-200 dark:border-green-800'))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Tab 3: Rejected / Unpaid ─────────────────────────────────── */}
                {activeTab === 'rejected' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Goods were already handed over, but the payment proof for these was rejected or never confirmed.
                            </p>
                            <button
                                onClick={() => fetchCompletedOrders()}
                                className="inline-flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:underline"
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Refresh
                            </button>
                        </div>
                        {unpaidCompleted.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-600 dark:text-gray-400 font-medium">No rejected or unpaid orders</p>
                                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Orders with a rejected or unconfirmed payment will appear here.</p>
                            </div>
                        ) : visibleUnpaidCompleted.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-600 dark:text-gray-400 font-medium">No matching orders</p>
                                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Try a different order number or customer name.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {visibleUnpaidCompleted.map((order) => renderCompletedCard(order, 'border-red-200 dark:border-red-800'))}
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    MODALS
                    ══════════════════════════════════════════════════════════════ */}

                {/* Image Lightbox */}
                {lightboxImage && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onClick={() => setLightboxImage(null)}>
                        <div className="relative max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                            <img src={lightboxImage} alt="Payment proof" className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl" />
                            <button onClick={() => setLightboxImage(null)} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Payment Verification Modal — one modal per item (GCash or COD)
                    combining the proof, customer info, and rejection reason with
                    both Confirm and Reject actions, mirroring the admin Pre-Orders
                    "Order Details" modal instead of the old expand-card-then-open-
                    a-separate-popup-per-action flow. */}
                {verificationModal && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4">
                        {/* Same chrome as the admin Order Details modal: rounded card,
                            scrolling on an inner wrapper so the scrollbar doesn't square
                            off the rounded corner, and phone-friendly gutters/height. */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-500/50 flex flex-col">
                        <div className="overflow-y-auto min-h-0">
                            <div className="p-4 sm:p-5">
                            <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
                                <div className="min-w-0">
                                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        {verificationModal.type === 'gcash' ? (
                                            <CreditCard className="w-5 h-5 shrink-0 text-cyan-500" />
                                        ) : (
                                            <Wallet className="w-5 h-5 shrink-0 text-amber-500" />
                                        )}
                                        {verificationModal.type === 'gcash' ? 'GCash Payment' : 'COD Down Payment'}
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                        Order #{verificationModal.item.order_id} — {verificationModal.item.customer_name}
                                    </p>
                                </div>
                                <button
                                    onClick={closeVerificationModal}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                                    title="Close"
                                >
                                    <XCircle className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400">
                                            {verificationModal.type === 'gcash' ? 'Amount:' : 'Down Payment:'}
                                        </span>
                                        <span className="ml-2 font-bold text-cyan-600 dark:text-cyan-400">
                                            {formatCurrency(verificationModal.type === 'gcash' ? verificationModal.item.total_amount : verificationModal.item.down_payment)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400">Payment:</span>
                                        <span className="ml-2 text-gray-900 dark:text-white">
                                            {verificationModal.type === 'gcash' ? 'GCash' : 'Cash on Delivery'}
                                        </span>
                                    </div>
                                    {verificationModal.type === 'cod' && (
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">Total Order:</span>
                                            <span className="ml-2 text-gray-900 dark:text-white">{formatCurrency(verificationModal.item.total_amount)}</span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400">Date:</span>
                                        <span className="ml-2 text-gray-900 dark:text-white">
                                            {new Date(verificationModal.item.order_date).toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {verificationModal.type === 'gcash' && (
                                    <div className="flex flex-wrap gap-1.5">
                                        <span className="text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                                            Awaiting Verification
                                        </span>
                                        {verificationModal.item.gcash_flagged && (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                                                <Flag className="w-3 h-3" /> FLAGGED
                                            </span>
                                        )}
                                        {verificationModal.item.gcash_rejected_count > 0 && (
                                            <span className="text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">
                                                Rejected {verificationModal.item.gcash_rejected_count}×
                                            </span>
                                        )}
                                        {verificationModal.item.gcash_resubmit_count > 0 && (
                                            <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                                Resubmit {verificationModal.item.gcash_resubmit_count}/3
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Customer on the left, proof thumbnail on the right —
                                    same side-by-side block as the admin modal, instead of
                                    a full-width proof image pushing the actions off-screen. */}
                                <div className="border-t border-gray-100 dark:border-slate-700 pt-3 flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Customer</h3>
                                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                                            <p className="flex items-center gap-2">
                                                <User className="w-4 h-4 shrink-0 text-gray-400" />
                                                {verificationModal.item.customer_name}
                                            </p>
                                            {verificationModal.item.contact_number && (
                                                <p className="flex items-center gap-2">
                                                    <Phone className="w-4 h-4 shrink-0 text-gray-400" />
                                                    {verificationModal.item.contact_number}
                                                </p>
                                            )}
                                            {verificationModal.item.delivery_address && (
                                                <p className="flex items-start gap-2">
                                                    <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                                                    <span>{verificationModal.item.delivery_address}</span>
                                                </p>
                                            )}
                                        </div>
                                        {verificationModal.type === 'gcash' && (
                                            <div className="mt-2">
                                                {verificationModal.item.customer_is_blocked ? (
                                                    <button
                                                        onClick={() => setUnblockModal({ userId: verificationModal.item.user_id, name: verificationModal.item.customer_name })}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                    >
                                                        <ShieldCheck className="w-3.5 h-3.5" /> Unblock Customer
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setBlockModal({ userId: verificationModal.item.user_id, name: verificationModal.item.customer_name })}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 dark:bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-900 transition-colors"
                                                    >
                                                        <Ban className="w-3.5 h-3.5" /> Block Customer
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="shrink-0">
                                        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Payment Proof</h3>
                                        {(() => {
                                            const proof = storageUrl(verificationModal.type === 'gcash' ? verificationModal.item.gcash_screenshot : verificationModal.item.proof_image);
                                            return proof ? (
                                                <button
                                                    onClick={() => setLightboxImage(proof)}
                                                    className="relative group focus:outline-none"
                                                    title="Click to view full size"
                                                >
                                                    <img
                                                        src={proof}
                                                        alt="Payment proof"
                                                        className="h-28 sm:h-24 w-auto rounded-lg border border-gray-200 dark:border-gray-600 object-contain group-hover:opacity-70 transition-opacity"
                                                    />
                                                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                                                    </span>
                                                </button>
                                            ) : (
                                                <div className="h-28 sm:h-24 w-24 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
                                                    <span className="text-xs text-gray-400 dark:text-gray-500">No proof</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {verificationModal.item.order_items?.length > 0 && (
                                    <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                                        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Items Ordered</h3>
                                        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                                            {verificationModal.item.order_items.map((item, idx) => (
                                                <li key={idx} className="flex items-center gap-2">
                                                    <Package className="w-4 h-4 shrink-0 text-gray-400" />
                                                    {item.product_name}
                                                    <span className="text-gray-400 dark:text-gray-500">× {item.quantity}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Rejection Reason <span className="text-gray-400 font-normal">(if rejecting)</span>
                                    </label>
                                    <select
                                        value={verificationReasonPreset}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setVerificationReasonPreset(value);
                                            setVerificationReason(value === OTHER_REJECTION_REASON ? '' : value);
                                        }}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    >
                                        <option value="">Select a reason...</option>
                                        {PAYMENT_PROOF_REJECTION_REASONS.map((reason) => (
                                            <option key={reason} value={reason}>{reason}</option>
                                        ))}
                                        <option value={OTHER_REJECTION_REASON}>Others (please specify)</option>
                                    </select>
                                    {verificationReasonPreset === OTHER_REJECTION_REASON && (
                                        <textarea
                                            value={verificationReason}
                                            onChange={(e) => setVerificationReason(e.target.value)}
                                            className="w-full mt-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                            rows={3}
                                            placeholder="Enter your own reason..."
                                            autoFocus
                                        />
                                    )}
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">The customer will need to resubmit their proof if rejected.</p>
                                </div>

                                {/* Full-width action pair, same as the admin modal's
                                    Approve/Reject — no separate Cancel button, the X in
                                    the header already closes this. */}
                                <div className="border-t border-gray-100 dark:border-slate-700 pt-3 flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={() => submitVerification('confirm')}
                                        disabled={verificationSubmitting}
                                        className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        <CheckCircle className="w-5 h-5 mr-2" />
                                        {verificationSubmitting ? 'Please wait…' : 'Confirm Payment'}
                                    </button>
                                    <button
                                        onClick={() => submitVerification('reject')}
                                        disabled={verificationSubmitting}
                                        className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        <XCircle className="w-5 h-5 mr-2" />
                                        {verificationSubmitting ? 'Please wait…' : 'Reject'}
                                    </button>
                                </div>
                            </div>
                            </div>
                        </div>
                        </div>
                    </div>
                )}

                {/* Block Customer Modal */}
                {blockModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full shadow-xl">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Ban className="w-5 h-5 text-red-500" /> Block Customer
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    Blocking <strong>{blockModal.name}</strong> will prevent them from placing new orders.
                                </p>
                            </div>
                            <div className="p-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reason <span className="text-red-500">*</span></label>
                                <textarea
                                    value={blockReason}
                                    onChange={(e) => setBlockReason(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-slate-700 dark:text-white"
                                    rows={3}
                                    placeholder="e.g. Repeated fraudulent GCash payment proofs"
                                />
                            </div>
                            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                                <button onClick={() => { setBlockModal(null); setBlockReason(''); }} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
                                <button
                                    onClick={() => {
                                        if (!blockReason.trim()) { alert('Please enter a reason for blocking.'); return; }
                                        handleBlockCustomer(blockModal.userId, blockReason.trim());
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                                >
                                    Block Customer
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Unblock Customer Modal */}
                {unblockModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full shadow-xl">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-green-500" /> Unblock Customer
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                    Unblock <strong>{unblockModal.name}</strong>? They will be able to place new orders again.
                                </p>
                            </div>
                            <div className="p-6 flex justify-end gap-3">
                                <button onClick={() => setUnblockModal(null)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
                                <button onClick={() => handleUnblockCustomer(unblockModal.userId)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold">Unblock</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Order Details Modal */}
                {selectedOrder && !showDeliveryModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex items-start gap-4">
                                    <button
                                        onClick={() => { setSelectedOrder(null); setRefundNote(''); }}
                                        aria-label="Close"
                                        className="p-3 -m-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
                                    >
                                        <X className="w-7 h-7" />
                                    </button>
                                    <div className="flex-1 flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                Order Details — <span className="text-cyan-600 dark:text-cyan-400">#{selectedOrder.order_id}</span>
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{new Date(selectedOrder.order_date).toLocaleString()}</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusColor(selectedOrder.status)}`}>{selectedOrder.status}</span>
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                                                selectedOrder.payment_status === 'Paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                : selectedOrder.payment_status === 'Partial' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                            }`}>{selectedOrder.payment_status}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Customer</h4>
                                        <p className="font-semibold text-gray-900 dark:text-white">{selectedOrder.customer?.full_name || selectedOrder.user?.full_name}</p>
                                        {(selectedOrder.customer?.email || selectedOrder.user?.email) && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-1"><Mail className="w-3.5 h-3.5 flex-shrink-0" />{selectedOrder.customer?.email || selectedOrder.user?.email}</p>
                                        )}
                                        {selectedOrder.customer?.contact_number && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-1"><Phone className="w-3.5 h-3.5 flex-shrink-0" />{selectedOrder.customer.contact_number}</p>
                                        )}
                                    </div>
                                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Payment</h4>
                                        <div className="space-y-1.5 text-sm">
                                            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Method</span><span className="font-medium text-gray-900 dark:text-white">{selectedOrder.payment_method}</span></div>
                                            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Type</span><span className="font-medium capitalize text-gray-900 dark:text-white">{selectedOrder.order_type === 'walkin' ? 'Walk-in' : selectedOrder.order_type}</span></div>
                                            <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-1.5 mt-1.5"><span className="font-semibold text-gray-700 dark:text-gray-300">Total</span><span className="font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(selectedOrder.total_amount)}</span></div>
                                        </div>
                                    </div>
                                </div>
                                {selectedOrder.gcash_screenshot && (
                                    <>
                                        <hr className="border-gray-200 dark:border-gray-700" />
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-cyan-500" /> GCash Proof</h4>
                                            <button onClick={() => setLightboxImage(storageUrl(selectedOrder.gcash_screenshot)!)} className="relative group focus:outline-none">
                                                <img src={storageUrl(selectedOrder.gcash_screenshot)!} alt="GCash receipt" className="h-32 w-auto rounded-lg border border-gray-200 dark:border-gray-600 object-contain group-hover:opacity-70 transition-opacity" />
                                                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ZoomIn className="w-7 h-7 text-white drop-shadow" /></span>
                                            </button>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click to view full size</p>
                                        </div>
                                    </>
                                )}
                                {selectedOrder.delivery_address && (
                                    <>
                                        <hr className="border-gray-200 dark:border-gray-700" />
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Delivery Address</h4>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-700/50 rounded-lg px-4 py-3">{selectedOrder.delivery_address}</p>
                                        </div>
                                    </>
                                )}
                                {selectedOrder.orderItems?.length > 0 && (
                                    <>
                                        <hr className="border-gray-200 dark:border-gray-700" />
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Order Items</h4>
                                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 dark:bg-slate-700/60">
                                                        <tr>
                                                            <th className="text-left py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Product</th>
                                                            <th className="text-center py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Qty</th>
                                                            <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Unit</th>
                                                            <th className="text-right py-2 px-3 font-semibold text-gray-600 dark:text-gray-300">Subtotal</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedOrder.orderItems.map((item, idx) => (
                                                            <tr key={item.product_id} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50/50 dark:bg-slate-700/20'}>
                                                                <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{item.product.product_name}</td>
                                                                <td className="py-2.5 px-3 text-center text-gray-700 dark:text-gray-300">{item.quantity}</td>
                                                                <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(item.unit_price)}</td>
                                                                <td className="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(item.subtotal)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="bg-gray-50 dark:bg-slate-700/60 border-t border-gray-200 dark:border-gray-700">
                                                        <tr>
                                                            <td colSpan={3} className="py-2.5 px-3 text-right font-semibold text-gray-700 dark:text-gray-300">Total</td>
                                                            <td className="py-2.5 px-3 text-right font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(selectedOrder.total_amount)}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {selectedOrder.delivery && (
                                    <>
                                        <hr className="border-gray-200 dark:border-gray-700" />
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Delivery</h4>
                                            <div className="flex items-center justify-between text-sm bg-gray-50 dark:bg-slate-700/50 rounded-lg px-4 py-3">
                                                <span className="text-gray-600 dark:text-gray-400">Rider: <strong className="text-gray-900 dark:text-white">{selectedOrder.delivery.rider?.full_name}</strong></span>
                                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getStatusColor(selectedOrder.delivery.delivery_status)}`}>{selectedOrder.delivery.delivery_status}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {selectedOrder.notes && (
                                    <>
                                        <hr className="border-gray-200 dark:border-gray-700" />
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Notes</h4>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg px-4 py-3">{selectedOrder.notes}</p>
                                        </div>
                                    </>
                                )}
                                {selectedOrder.refund_status === 'requested' && (
                                    <>
                                        <hr className="border-gray-200 dark:border-gray-700" />
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-red-500" /> Refund Owed</h4>
                                            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 space-y-3">
                                                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                                                    ₱{Number(selectedOrder.refund_amount).toFixed(2)} — customer paid before this order was cancelled.
                                                </p>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="GCash reference # (optional)"
                                                        value={refundNote}
                                                        onChange={(e) => setRefundNote(e.target.value)}
                                                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                                    />
                                                    <button
                                                        onClick={() => handleCompleteRefund(selectedOrder.order_id, refundNote)}
                                                        disabled={completingRefundId === selectedOrder.order_id}
                                                        className="shrink-0 px-3 py-1.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                                    >
                                                        {completingRefundId === selectedOrder.order_id ? 'Saving…' : 'Mark Refund Completed'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {selectedOrder.refund_status === 'completed' && (
                                    <>
                                        <hr className="border-gray-200 dark:border-gray-700" />
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-green-500" /> Refund</h4>
                                            <p className="text-sm font-semibold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                                                Refunded ₱{Number(selectedOrder.refund_amount).toFixed(2)}
                                                {selectedOrder.refund_completed_at && ` on ${new Date(selectedOrder.refund_completed_at).toLocaleDateString()}`}
                                                {selectedOrder.refund_note && ` — ${selectedOrder.refund_note}`}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                    {activeTab === 'processing' && selectedOrder.payment_status === 'Partial' && (
                                        <button
                                            onClick={() => setMarkPaidModal({ orderId: selectedOrder.order_id, customerName: customerName(selectedOrder) })}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-semibold transition-colors"
                                        >
                                            <CheckCircle className="w-4 h-4" /> Mark as Paid
                                        </button>
                                    )}
                                    {activeTab === 'processing' && selectedOrder.order_type !== 'pickup' && !selectedOrder.delivery && (
                                        <button
                                            onClick={() => setShowDeliveryModal(true)}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 text-sm font-semibold transition-colors"
                                        >
                                            <Truck className="w-4 h-4" /> Assign Rider
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mark as Paid Modal */}
                {markPaidModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full shadow-xl">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> Mark Order as Paid</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Confirm that <strong>{markPaidModal.customerName}</strong> has paid the remaining balance for <strong>Order #{markPaidModal.orderId}</strong>?</p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Payment status will be updated from <span className="font-semibold text-yellow-600 dark:text-yellow-400">Partial</span> to <span className="font-semibold text-green-600 dark:text-green-400">Paid</span>.</p>
                            </div>
                            <div className="p-6 flex justify-end gap-3">
                                <button onClick={() => setMarkPaidModal(null)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
                                <button onClick={() => markAsPaid(markPaidModal.orderId)} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold">{loading ? 'Updating...' : 'Confirm Payment'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mark as Ready + Assign Rider Modal */}
                {markReadyModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-slate-800 rounded-xl max-w-sm w-full shadow-xl">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Truck className="w-5 h-5 text-violet-500" /> Assign Delivery — Order {markReadyModal.orderLabel}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                    Piliin kung sino ang magdedeliver ng order na ito.
                                </p>
                            </div>
                            <div className="p-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Delivery Boy / Rider</label>
                                <select
                                    value={markReadyRider}
                                    onChange={(e) => setMarkReadyRider(e.target.value)}
                                    className="w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-violet-500"
                                >
                                    <option value="">Pumili ng rider...</option>
                                    {deliveryBoys.map((boy) => (
                                        <option key={boy.id} value={boy.id}>{boy.full_name}{boy.contact_number ? ` — ${boy.contact_number}` : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="px-6 pb-6 flex justify-end gap-3">
                                <button
                                    onClick={() => { setMarkReadyModal(null); setMarkReadyRider(''); }}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={markReadyAndAssign}
                                    disabled={loading || !markReadyRider}
                                    className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 font-semibold"
                                >
                                    {loading ? 'Processing...' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Assign Rider Modal */}
                {showDeliveryModal && selectedOrder && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
                        <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full shadow-xl">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assign Rider — #{selectedOrder.order_id}</h3>
                            </div>
                            <div className="p-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Delivery Rider</label>
                                <select value={selectedRider} onChange={(e) => setSelectedRider(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-violet-500 dark:bg-slate-700 dark:text-white">
                                    <option value="">Select a rider...</option>
                                    {deliveryBoys.map((boy) => (<option key={boy.id} value={boy.id}>{boy.full_name} — {boy.contact_number}</option>))}
                                </select>
                            </div>
                            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                                <button onClick={() => { setShowDeliveryModal(false); setSelectedRider(''); }} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
                                <button onClick={() => assignDelivery(selectedOrder.order_id)} disabled={loading} className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-50 font-semibold">{loading ? 'Assigning...' : 'Assign Rider'}</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </AppHeaderLayout>
    );
}
