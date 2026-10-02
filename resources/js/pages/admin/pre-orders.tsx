import { Head, usePage } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import { Package, CheckCircle, XCircle, MapPin, DollarSign, User, Clock, Truck, AlertCircle, ShoppingCart, Phone, Search, ArrowDown, ArrowUp, ZoomIn, X } from 'lucide-react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirmModal } from '@/hooks/useConfirmModal';
import { showToast } from '@/lib/toast';
import { PAYMENT_PROOF_REJECTION_REASONS, OTHER_REJECTION_REASON } from '@/constants/rejectionReasons';
import { storageUrl } from '@/lib/storage-url';
import { getCsrfHeaders } from '@/lib/csrf';

interface OrderItem {
    order_item_id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
    subtotal: number;
    product: {
        product_id: number;
        product_name: string;
        inventory?: {
            current_quantity: number;
            minimum_quantity: number;
        } | null;
    };
}

interface Customer {
    customer_id: number;
    first_name: string;
    last_name: string;
    phone?: string | null;
}

interface UserInfo {
    id: number;
    full_name: string;
    email: string;
    contact_number?: string | null;
}

interface Delivery {
    delivery_id: number;
    rider_id: number | null;
    rider: {
        id: number;
        full_name: string;
    } | null;
    delivery_status: string;
}

interface Order {
    order_id: number;
    customer_id: number | null;
    user_id: number;
    order_date: string;
    total_amount: number;
    status: string;
    payment_method: string;
    payment_status: string;
    down_payment: number;
    gcash_screenshot: string | null;
    approval_status: string;
    order_type: string;
    notes: string | null;
    refund_status: 'none' | 'requested' | 'completed';
    refund_amount: number;
    refund_requested_at: string | null;
    refund_completed_at: string | null;
    refund_note: string | null;
    delivery_address: string;
    delivery_barangay: string;
    delivery_purok: string;
    delivery_city: string;
    delivery_province: string;
    delivery_postal_code: string;
    delivery_latitude: number | null;
    delivery_longitude: number | null;
    customer: Customer | null;
    user: UserInfo | null;
    order_items: OrderItem[] | null;
    delivery: Delivery | null;
}

interface DeliveryBoy {
    id: number;
    full_name: string;
    email: string;
    contact_number: string | null;
}

// Empty: the top nav/sidebar already shows which page is active, and
// the page has its own heading below, so a "Dashboard > X" trail here was
// just repeating both without adding a real path back anywhere new.
const breadcrumbs: BreadcrumbItem[] = [];

export default function PreOrders() {
    // Inertia reuses this component instance (no remount) when navigating
    // here via router.visit — e.g. the sidebar header's notification bell —
    // if the admin was already on this page. `url` still updates on every
    // such visit though, so the deep-link effect below keys off it instead
    // of a one-time "have we ever handled a link" ref, which used to go
    // stale and silently do nothing on a second bell click.
    const { url } = usePage();
    const [activeTab, setActiveTab] = useState<'pending' | 'processing' | 'delivered' | 'completed' | 'cancelled' | 'verifyPayments'>('pending');
    const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
    const [processingOrders, setProcessingOrders] = useState<Order[]>([]);
    const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([]);
    const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
    const [cancelledOrders, setCancelledOrders] = useState<Order[]>([]);
    // Surfaced as a badge on the tab itself — a note buried inside a card is too easy
    // to miss if nobody happens to open Cancelled that day.
    const refundNeededCount = cancelledOrders.filter((o) => o.refund_status === 'requested').length;
    const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState<number | null>(null);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    // Centered confirm() replacement, shared by every confirmation prompt below.
    const { confirm, confirmModalProps } = useConfirmModal();
    const [rejectReason, setRejectReason] = useState('');
    // Which dropdown option is picked — a preset reason (used verbatim as
    // rejectReason) or OTHER_REJECTION_REASON, which instead reveals a
    // free-text box for whatever isn't already covered by a preset.
    const [rejectReasonPreset, setRejectReasonPreset] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    // Newest-first by default (matches what the backend already returns), but a
    // long list (e.g. 9+ cancelled orders) can bury the one an admin is looking
    // for — letting them flip to oldest-first makes scanning either end quick.
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    // Paginate the active tab's orders so a busy status (e.g. 50+ pending orders)
    // never turns into one long unbroken scroll of cards.
    const ORDERS_PER_PAGE = 9;
    const [currentPage, setCurrentPage] = useState(1);
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchTerm, sortOrder]);

    // Close the order details modal with the Escape key — the payment-proof
    // lightbox first, since it can open on top of it.
    useEffect(() => {
        if (!selectedOrder && !lightboxImage) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (lightboxImage) {
                setLightboxImage(null);
            } else if (selectedOrder) {
                setSelectedOrder(null);
                setSelectedDeliveryBoy(null);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [selectedOrder, lightboxImage]);

    const ordersForTab =
        activeTab === 'pending' ? pendingOrders :
        activeTab === 'processing' ? processingOrders :
        activeTab === 'delivered' ? deliveredOrders :
        activeTab === 'completed' ? completedOrders :
        cancelledOrders;
    const activeOrders = ordersForTab.filter((order) => {
        if (!searchTerm.trim()) return true;
        const query = searchTerm.toLowerCase();
        const customerName = order.customer
            ? `${order.customer.first_name} ${order.customer.last_name}`
            : order.user?.full_name || '';
        return (
            order.order_id.toString().includes(query) ||
            customerName.toLowerCase().includes(query)
        );
    }).sort((a, b) => {
        const diff = new Date(a.order_date).getTime() - new Date(b.order_date).getTime();
        return sortOrder === 'asc' ? diff : -diff;
    });
    const totalPages = Math.max(1, Math.ceil(activeOrders.length / ORDERS_PER_PAGE));
    const paginatedOrders = activeOrders.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE);

    useEffect(() => {
        fetchPendingOrders();
        fetchProcessingOrders();
        fetchDeliveredOrders();
        fetchCompletedOrders();
        fetchCancelledOrders();
        fetchDeliveryBoys();

        // Auto-refresh every 15 seconds (same cadence as the cashier's
        // orders page) so a new incoming order shows up here on its own —
        // this page previously only ever fetched once on load, so an admin
        // had to manually reload the browser to see anything new.
        const interval = setInterval(() => {
            fetchPendingOrders();
            fetchProcessingOrders();
            fetchDeliveredOrders();
            fetchCompletedOrders();
            fetchCancelledOrders();
        }, 15000);

        return () => clearInterval(interval);
    }, []);

    // Deep link from the sidebar header's notification bell (?order=43) —
    // once that order shows up in whichever tab's list it belongs to, jump
    // to that tab and open its detail modal instead of leaving the admin to
    // hunt for it themselves. Keyed off `url` (not a one-time ref) so a
    // second bell click while already on this page — which Inertia handles
    // by re-rendering this same component instance rather than remounting
    // it — still opens the newly-clicked order instead of being a no-op.
    const lastOpenedOrderId = useRef<number | null>(null);
    useEffect(() => {
        const orderIdParam = new URLSearchParams(url.split('?')[1] ?? '').get('order');
        if (!orderIdParam) return;
        const orderId = Number(orderIdParam);
        if (lastOpenedOrderId.current === orderId) return;

        const tabs: Array<['pending' | 'processing' | 'delivered' | 'completed' | 'cancelled', Order[]]> = [
            ['pending', pendingOrders],
            ['processing', processingOrders],
            ['delivered', deliveredOrders],
            ['completed', completedOrders],
            ['cancelled', cancelledOrders],
        ];
        for (const [tab, list] of tabs) {
            const found = list.find((o) => o.order_id === orderId);
            if (found) {
                setActiveTab(tab);
                setSelectedOrder(found);
                lastOpenedOrderId.current = orderId;
                return;
            }
        }
    }, [url, pendingOrders, processingOrders, deliveredOrders, completedOrders, cancelledOrders]);

    const fetchPendingOrders = async () => {
        try {
            const response = await fetch('/admin/api/orders/pending', {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Debug - Pending Orders Data:', data);
                // Log the first order's debug info if available
                if (data.length > 0 && data[0].debug_info) {
                    console.log('Debug - First Order Info:', data[0].debug_info);
                }
                setPendingOrders(data);
            }
        } catch (error) {
            console.error('Error fetching pending orders:', error);
        }
    };

    const fetchProcessingOrders = async () => {
        try {
            const response = await fetch('/admin/api/orders/processing', {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
            });
            if (response.ok) {
                const data = await response.json();
                setProcessingOrders(data);
            }
        } catch (error) {
            console.error('Error fetching processing orders:', error);
        }
    };

    const fetchDeliveredOrders = async () => {
        try {
            const response = await fetch('/admin/api/orders/delivered', {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
            });
            if (response.ok) {
                const data = await response.json();
                setDeliveredOrders(data);
            }
        } catch (error) {
            console.error('Error fetching delivered orders:', error);
        }
    };

    const fetchCompletedOrders = async () => {
        try {
            const response = await fetch('/admin/api/orders/completed', {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
            });
            if (response.ok) {
                const data = await response.json();
                setCompletedOrders(data);
            }
        } catch (error) {
            console.error('Error fetching completed orders:', error);
        }
    };

    const fetchCancelledOrders = async () => {
        try {
            const response = await fetch('/admin/api/orders/cancelled', {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
            });
            if (response.ok) {
                const data = await response.json();
                setCancelledOrders(data);
            }
        } catch (error) {
            console.error('Error fetching cancelled orders:', error);
        }
    };

    const [completingRefundId, setCompletingRefundId] = useState<number | null>(null);
    // Optional "GCash reference #" note typed per-order before completing its refund.
    const [refundNotes, setRefundNotes] = useState<Record<number, string>>({});

    const handleCompleteRefund = async (orderId: number, note?: string) => {
        setCompletingRefundId(orderId);
        try {
            const response = await fetch(`/admin/api/orders/${orderId}/complete-refund`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
                body: JSON.stringify({ note: note || undefined }),
            });
            if (response.ok) {
                const data = await response.json();
                setCancelledOrders(prev => prev.map(o => o.order_id === orderId ? data.order : o));
                setRefundNotes(prev => { const next = { ...prev }; delete next[orderId]; return next; });
            } else {
                alert('Failed to mark refund as completed');
            }
        } catch (error) {
            console.error('Error completing refund:', error);
            alert('Failed to mark refund as completed');
        } finally {
            setCompletingRefundId(null);
        }
    };

    const fetchDeliveryBoys = async () => {
        try {
            const response = await fetch('/admin/api/delivery-boys', {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
            });
            if (response.ok) {
                const data = await response.json();
                setDeliveryBoys(data);
            }
        } catch (error) {
            console.error('Error fetching delivery boys:', error);
        }
    };

    const acceptOrder = async (orderId: number) => {
        if (!(await confirm('Are you sure you want to approve this order?'))) return;

        setLoading(true);
        try {
            const response = await fetch(`/admin/api/orders/${orderId}/approve`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
            });

            if (response.ok) {
                fetchPendingOrders();
                fetchProcessingOrders();
                setSelectedOrder(null);
                showToast('success', `Order #${orderId} approved successfully.`);
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to approve order');
            }
        } catch (error) {
            console.error('Error approving order:', error);
            alert('Failed to approve order');
        } finally {
            setLoading(false);
        }
    };

    const rejectOrder = async (orderId: number) => {
        if (!(await confirm({ message: 'Are you sure you want to reject this order?', danger: true }))) return;

        setLoading(true);
        try {
            const response = await fetch(`/admin/api/orders/${orderId}/reject`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
                body: JSON.stringify({ rejection_reason: rejectReason }),
            });

            if (response.ok) {
                fetchPendingOrders();
                fetchCancelledOrders();
                setSelectedOrder(null);
                setRejectReason('');
                setRejectReasonPreset('');
                showToast('warning', `Order #${orderId} rejected.`);
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to reject order');
            }
        } catch (error) {
            console.error('Error rejecting order:', error);
            alert('Failed to reject order');
        } finally {
            setLoading(false);
        }
    };

    const assignDelivery = async (orderId: number) => {
        if (!selectedDeliveryBoy) {
            alert('Please select a delivery boy');
            return;
        }

        if (!(await confirm('Are you sure you want to assign this delivery to the selected delivery boy?'))) return;

        setLoading(true);
        try {
            const response = await fetch(`/admin/api/orders/${orderId}/assign-delivery`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
                body: JSON.stringify({ rider_id: selectedDeliveryBoy }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Delivery Assignment Debug:', data.debug);
                fetchProcessingOrders();
                setSelectedOrder(null);
                setSelectedDeliveryBoy(null);
                showToast('success', 'Delivery assigned.');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to assign delivery');
            }
        } catch (error) {
            console.error('Error assigning delivery:', error);
            alert('Failed to assign delivery');
        } finally {
            setLoading(false);
        }
    };

    const confirmSuccessfulDelivery = async (orderId: number) => {
        if (!(await confirm('Are you sure you want to confirm this order as successfully delivered?'))) return;

        setLoading(true);
        try {
            const response = await fetch(`/admin/api/orders/${orderId}/confirm-success`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
            });

            if (response.ok) {
                fetchDeliveredOrders();
                fetchCompletedOrders();
                fetchProcessingOrders();
                setSelectedOrder(null);
                showToast('success', 'Delivery confirmed as successful.');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to confirm delivery');
            }
        } catch (error) {
            console.error('Error confirming delivery:', error);
            alert('Failed to confirm delivery');
        } finally {
            setLoading(false);
        }
    };

    const confirmPayment = async (orderId: number, paymentStatus: string) => {
        if (!(await confirm(`Are you sure you want to confirm payment status as "${paymentStatus}"?`))) return;

        setLoading(true);
        try {
            const response = await fetch(`/admin/api/orders/${orderId}/confirm-payment`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
                body: JSON.stringify({ payment_status: paymentStatus }),
            });

            if (response.ok) {
                fetchDeliveredOrders();
                fetchCompletedOrders();
                fetchProcessingOrders();
                setSelectedOrder(null);
                showToast('success', `Payment confirmed as "${paymentStatus}".`);
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to confirm payment');
            }
        } catch (error) {
            console.error('Error confirming payment:', error);
            alert('Failed to confirm payment');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-200';
            case 'Processing': return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200';
            case 'Delivered': return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200';
            case 'Completed': return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200';
            case 'Ready to Deliver': return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-200';
            case 'Cancelled': return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200';
            default: return 'bg-gray-100 dark:bg-gray-700/40 text-gray-700 dark:text-gray-200';
        }
    };

    // Now that the status pill is gone from the card, the border color is the only
    // at-a-glance signal for where an order stands — mirrors getStatusColor's palette.
    const getStatusBorderColor = (status: string) => {
        switch (status) {
            case 'Pending': return 'border-yellow-300 dark:border-yellow-700';
            case 'Processing': return 'border-blue-300 dark:border-blue-700';
            case 'Delivered': return 'border-green-300 dark:border-green-700';
            case 'Completed': return 'border-indigo-300 dark:border-indigo-700';
            case 'Ready to Deliver': return 'border-purple-300 dark:border-purple-700';
            case 'Cancelled': return 'border-red-300 dark:border-red-700';
            default: return 'border-gray-100 dark:border-slate-700';
        }
    };

    const renderOrderCard = (order: Order) => (
        <div
            key={order.order_id}
            className={`bg-white dark:bg-slate-800 rounded-xl p-4 border-2 ${getStatusBorderColor(order.status)} shadow-sm cursor-pointer`}
            onClick={() => setSelectedOrder(order)}
        >
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Order #{order.order_id}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {new Date(order.order_date).toLocaleString()}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{order.payment_method}</span>
                    <span className="font-bold text-lg text-slate-800 dark:text-slate-100">
                        ₱{Number(order.total_amount).toFixed(2)}
                    </span>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-3">
                <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 font-medium">
                    <User className="w-4 h-4 text-slate-400" />
                    {order.customer ? (
                        <>{order.customer.first_name} {order.customer.last_name}</>
                    ) : (
                        <>{order.user?.full_name || 'Unknown Customer'}</>
                    )}
                </div>
                {(order.customer?.phone || order.user?.contact_number) && (
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Phone className="w-4 h-4 text-slate-400" />
                        {order.customer?.phone || order.user?.contact_number}
                    </div>
                )}
                {order.approval_status === 'rejected' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200">
                        Rejected
                    </span>
                )}
            </div>

            <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <Package className="w-4 h-4" />
                {order.order_items?.length || 0} item(s)
            </div>

            {order.status === 'Processing' && !order.delivery && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-400">
                    <Truck className="w-3.5 h-3.5" />
                    No rider assigned yet
                </div>
            )}

            {order.refund_status === 'requested' && (
                <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1.5 rounded">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        Refund owed: ₱{Number(order.refund_amount).toFixed(2)} — customer paid before cancelling
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="GCash reference # (optional)"
                            value={refundNotes[order.order_id] ?? ''}
                            onChange={(e) => setRefundNotes(prev => ({ ...prev, [order.order_id]: e.target.value }))}
                            className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        />
                        <button
                            onClick={() => handleCompleteRefund(order.order_id, refundNotes[order.order_id])}
                            disabled={completingRefundId === order.order_id}
                            className="shrink-0 px-2.5 py-1 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {completingRefundId === order.order_id ? 'Saving…' : 'Mark Refund Completed'}
                        </button>
                    </div>
                </div>
            )}
            {order.refund_status === 'completed' && (
                <div className="flex items-center gap-1.5 mt-2 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Refunded ₱{Number(order.refund_amount).toFixed(2)}
                    {order.refund_completed_at && ` on ${new Date(order.refund_completed_at).toLocaleDateString()}`}
                </div>
            )}
        </div>
    );

    const renderOrderModal = () => {
        if (!selectedOrder) return null;

        const customerName = selectedOrder.customer
            ? `${selectedOrder.customer.first_name} ${selectedOrder.customer.last_name}`
            : selectedOrder.user?.full_name || 'Unknown Customer';
        // Barangay and purok used to take a line each, and the city line was
        // printed unconditionally — which rendered as a lone "," on the orders
        // that have no city/province/postal saved.
        const localityLine = [
            selectedOrder.delivery_barangay && `Brgy. ${selectedOrder.delivery_barangay}`,
            selectedOrder.delivery_purok && `Purok ${selectedOrder.delivery_purok}`,
        ].filter(Boolean).join(' · ');
        const cityLine = [
            [selectedOrder.delivery_city, selectedOrder.delivery_province].filter(Boolean).join(', '),
            selectedOrder.delivery_postal_code,
        ].filter(Boolean).join(' ');
        const proofUrl = storageUrl(selectedOrder.gcash_screenshot);

        // Tighter gutters and more of the screen height on a phone, where 16px
        // margins on both sides and a 90vh cap wasted space the small screen
        // doesn't have. The bottom padding honours the home-bar safe area, same
        // as the cashier POS modals.
        return (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4">
                <div className="bg-white dark:bg-gradient-to-br dark:from-slate-900/40 dark:to-slate-800/40 rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-500/50 flex flex-col">
                    {/* Scrolling lives on this inner wrapper, not the rounded
                        card itself — a scrollbar on the same element as
                        rounded corners squares off the corner it sits
                        against, so the header looked like it was spilling
                        past the card's edge once content got tall enough
                        to scroll. */}
                    <div className="overflow-y-auto min-h-0">
                    <div className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Order Details #{selectedOrder.order_id}</h2>
                            <button
                                onClick={() => {
                                    setSelectedOrder(null);
                                    setSelectedDeliveryBoy(null);
                                }}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                title="Close"
                            >
                                <XCircle className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                            </button>
                        </div>

                        <div className="space-y-4 overflow-x-auto">
                            {/* Order Info — label/value pairs in a tight 2-up grid
                                instead of one roomy row each. */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">Status:</span>
                                    <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                                        {selectedOrder.status}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">Payment:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">{selectedOrder.payment_method}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">Date:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">
                                        {new Date(selectedOrder.order_date).toLocaleString()}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500 dark:text-gray-400">Total:</span>
                                    <span className="ml-2 text-cyan-600 dark:text-cyan-400 font-bold">
                                        ₱{Number(selectedOrder.total_amount).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Customer and the payment proof sit side by side —
                                stacked, they left the whole right half of the
                                modal empty and pushed everything else below the
                                fold. */}
                            <div className="border-t border-gray-100 dark:border-slate-700 pt-3 flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Customer</h3>
                                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                                        <p className="flex items-center gap-2">
                                            <User className="w-4 h-4 shrink-0 text-gray-400" />
                                            {customerName}
                                        </p>
                                        <p className="flex items-start gap-2">
                                            <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                                            <span>
                                                {selectedOrder.delivery_address}
                                                {localityLine && <><br />{localityLine}</>}
                                                {cityLine && <><br />{cityLine}</>}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                {proofUrl && (
                                    <div className="shrink-0">
                                        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Payment Proof</h3>
                                        <button
                                            onClick={() => setLightboxImage(proofUrl)}
                                            className="relative group focus:outline-none"
                                            title="Click to view full size"
                                        >
                                            <img
                                                src={proofUrl}
                                                alt="Payment proof"
                                                className="h-28 sm:h-24 w-auto rounded-lg border border-gray-200 dark:border-gray-600 object-contain group-hover:opacity-70 transition-opacity"
                                            />
                                            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Order Items */}
                            <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                                    Order Items {selectedOrder.order_items && selectedOrder.order_items.length > 0 && `(${selectedOrder.order_items.length})`}
                                </h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                                        selectedOrder.order_items.map((item) => {
                                            const currentStock = item.product?.inventory?.current_quantity ?? 0;
                                            const isLowStock = currentStock < item.quantity;
                                            return (
                                                <div key={item.order_item_id} className="flex justify-between items-baseline gap-3 text-sm">
                                                    {/* Name, stock and the warning badge on one wrapping
                                                        line — the stock used to sit on its own line under
                                                        every single item. */}
                                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                                                        <span className="text-gray-600 dark:text-gray-300">
                                                            {item.product?.product_name || 'Product Name Missing'} x {item.quantity}
                                                        </span>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                                            Stock: {currentStock}
                                                        </span>
                                                        {isLowStock && (
                                                            <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-200 px-2 py-0.5 rounded">
                                                                Insufficient
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="font-medium text-gray-900 dark:text-white shrink-0">
                                                        ₱{Number(item.subtotal).toFixed(2)}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <span className="text-gray-500 dark:text-gray-400">No items</span>
                                    )}
                                </div>
                            </div>

                            {/* Actions based on approval status */}
                            {selectedOrder.approval_status === 'pending' && (
                                <div className="space-y-3 border-t border-gray-100 dark:border-slate-700 pt-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            Rejection Reason (if rejecting)
                                        </label>
                                        <select
                                            value={rejectReasonPreset}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setRejectReasonPreset(value);
                                                setRejectReason(value === OTHER_REJECTION_REASON ? '' : value);
                                            }}
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        >
                                            <option value="">Select a reason...</option>
                                            {PAYMENT_PROOF_REJECTION_REASONS.map((reason) => (
                                                <option key={reason} value={reason}>{reason}</option>
                                            ))}
                                            <option value={OTHER_REJECTION_REASON}>Others (please specify)</option>
                                        </select>
                                        {rejectReasonPreset === OTHER_REJECTION_REASON && (
                                            <textarea
                                                value={rejectReason}
                                                onChange={(e) => setRejectReason(e.target.value)}
                                                placeholder="Enter reason for rejection..."
                                                className="w-full mt-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                                rows={3}
                                            />
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button
                                            onClick={() => acceptOrder(selectedOrder.order_id)}
                                            disabled={loading}
                                            className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                            <CheckCircle className="w-5 h-5 mr-2" />
                                            {loading ? 'Processing...' : 'Approve Order'}
                                        </button>
                                        <button
                                            onClick={() => rejectOrder(selectedOrder.order_id)}
                                            disabled={loading || !rejectReason}
                                            className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                            <XCircle className="w-5 h-5 mr-2" />
                                            {loading ? 'Processing...' : 'Reject Order'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedOrder.status === 'Processing' && selectedOrder.approval_status === 'approved' && (
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Assign Delivery Boy</h3>
                                    {selectedOrder.delivery ? (
                                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
                                            <p className="text-sm text-green-700 dark:text-green-300">
                                                Delivery assigned to: {selectedOrder.delivery.rider?.full_name || 'Unknown'}
                                            </p>
                                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                Status: {selectedOrder.delivery.delivery_status}
                                            </p>
                                        </div>
                                    ) : deliveryBoys.length === 0 ? (
                                        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                                No delivery boys available. Please add delivery boys to the system first.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <select
                                                value={selectedDeliveryBoy || ''}
                                                onChange={(e) => setSelectedDeliveryBoy(Number(e.target.value))}
                                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                            >
                                                <option value="">Select a delivery boy</option>
                                                {deliveryBoys.map(boy => (
                                                    <option key={boy.id} value={boy.id}>{boy.full_name} - {boy.email}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => assignDelivery(selectedOrder.order_id)}
                                                disabled={loading || !selectedDeliveryBoy}
                                                className="w-full bg-cyan-600 text-white py-3 rounded-lg font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                            >
                                                <Truck className="w-5 h-5 mr-2" />
                                                {loading ? 'Assigning...' : 'Assign Delivery'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedOrder.status === 'Processing' && selectedOrder.delivery && (
                                <div className="bg-gradient-to-br from-slate-800/30 to-slate-700/30 dark:from-slate-800/50 dark:to-slate-700/50 rounded-lg p-4 border border-slate-500/30 dark:border-slate-500/50">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Delivery Information</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center text-gray-600 dark:text-gray-300">
                                            <User className="w-4 h-4 mr-2" />
                                            {selectedOrder.delivery.rider?.full_name || 'Not assigned'}
                                        </div>
                                        <div className="flex items-center text-gray-600 dark:text-gray-300">
                                            <Truck className="w-4 h-4 mr-2" />
                                            Status: {selectedOrder.delivery.delivery_status}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedOrder.status === 'Delivered' && (
                                <div className="space-y-4">
                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
                                        <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">Order Delivered</h3>
                                        <p className="text-sm text-green-600 dark:text-green-400">
                                            This order has been marked as delivered by the delivery boy.
                                        </p>
                                        <div className="mt-2 text-sm">
                                            <span className="font-medium">Payment Status: </span>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                selectedOrder.payment_status === 'Paid' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' :
                                                selectedOrder.payment_status === 'Partial' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200' :
                                                'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                                            }`}>
                                                {selectedOrder.payment_status}
                                            </span>
                                        </div>
                                    </div>
                                    {selectedOrder.payment_status !== 'Paid' && (
                                        <div className="space-y-2">
                                            <h4 className="font-semibold text-gray-900 dark:text-white">Confirm Payment</h4>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <button
                                                    onClick={() => confirmPayment(selectedOrder.order_id, 'Paid')}
                                                    disabled={loading}
                                                    className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                >
                                                    Mark as Paid
                                                </button>
                                                <button
                                                    onClick={() => confirmPayment(selectedOrder.order_id, 'Partial')}
                                                    disabled={loading}
                                                    className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-600 text-white py-2 rounded-lg font-semibold hover:from-yellow-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                >
                                                    Mark as Partial
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => confirmSuccessfulDelivery(selectedOrder.order_id)}
                                        disabled={loading}
                                        className="w-full bg-cyan-600 text-white py-3 rounded-lg font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        <CheckCircle className="w-5 h-5 mr-2" />
                                        {loading ? 'Confirming...' : 'Complete Order'}
                                    </button>
                                </div>
                            )}

                            {selectedOrder.status === 'Completed' && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-700">
                                    <h3 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">Order Completed Successfully</h3>
                                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                                        This order has been successfully delivered and confirmed.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="Pre-Orders Management - Mejeck Ice Plant" />

            <div className="px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8 pb-6 border-b border-gray-200 dark:border-slate-700">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pre-Orders</h1>
                    <p className="mt-1.5 text-gray-600 dark:text-gray-400">
                        Review, approve, and track customer pre-orders through delivery
                    </p>
                </div>

                <div className="space-y-6">
                {/* Tabs */}
                <div className="bg-white dark:bg-gradient-to-br dark:from-slate-900/40 dark:to-slate-800/40 rounded-xl shadow-sm border border-slate-200 dark:border-slate-500/50 mb-6">
                    <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-4 p-4 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`flex items-center justify-center px-4 sm:px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap text-sm sm:text-base flex-1 sm:flex-none ${
                                activeTab === 'pending'
                                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            <Clock className="w-5 h-5 mr-2" />
                            Pending ({pendingOrders.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('processing')}
                            className={`flex items-center justify-center px-4 sm:px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap text-sm sm:text-base flex-1 sm:flex-none ${
                                activeTab === 'processing'
                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            <Truck className="w-5 h-5 mr-2" />
                            Processing ({processingOrders.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('delivered')}
                            className={`flex items-center justify-center px-4 sm:px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap text-sm sm:text-base flex-1 sm:flex-none ${
                                activeTab === 'delivered'
                                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            <CheckCircle className="w-5 h-5 mr-2" />
                            Delivered ({deliveredOrders.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('completed')}
                            className={`flex items-center justify-center px-4 sm:px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap text-sm sm:text-base flex-1 sm:flex-none ${
                                activeTab === 'completed'
                                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            <CheckCircle className="w-5 h-5 mr-2" />
                            Completed ({completedOrders.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('cancelled')}
                            className={`relative flex items-center justify-center px-4 sm:px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap text-sm sm:text-base flex-1 sm:flex-none ${
                                activeTab === 'cancelled'
                                    ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                            {refundNeededCount > 0 && (
                                <span className="absolute -top-2 -right-2 flex items-center gap-1 bg-red-600 text-white text-sm font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                                    <AlertCircle className="w-3 h-3" />
                                    {refundNeededCount}
                                </span>
                            )}
                            <XCircle className="w-5 h-5 mr-2" />
                            Cancelled ({cancelledOrders.length})
                        </button>
                    </div>
                </div>

                {/* Search + sort */}
                <div className="flex gap-2">
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
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        title={`Order date is currently sorted ${sortOrder === 'desc' ? 'descending (newest at top)' : 'ascending (oldest at top)'} — click to flip it`}
                        className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                    >
                        {sortOrder === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                        Sort: {sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                    </button>
                </div>

                {/* Orders Grid */}
                {activeOrders.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                        {searchTerm.trim() && ordersForTab.length > 0 ? (
                            <>
                                <p className="font-medium text-gray-600 dark:text-gray-300">No matching orders</p>
                                <p className="text-sm mt-1">Try a different order number or customer name.</p>
                            </>
                        ) : (
                            <>
                                <p className="font-medium text-gray-600 dark:text-gray-300">
                                    {activeTab === 'pending' && "You're all caught up"}
                                    {activeTab === 'processing' && 'Nothing being processed right now'}
                                    {activeTab === 'delivered' && 'No orders awaiting completion'}
                                    {activeTab === 'completed' && 'No completed orders yet'}
                                    {activeTab === 'cancelled' && 'No cancelled orders'}
                                </p>
                                <p className="text-sm mt-1">
                                    {activeTab === 'pending' && 'No orders are waiting for approval.'}
                                    {activeTab === 'processing' && 'Orders show up here once approved and awaiting delivery.'}
                                    {activeTab === 'delivered' && 'Orders show up here once marked delivered, waiting for payment confirmation.'}
                                    {activeTab === 'completed' && 'Finished orders will appear here.'}
                                    {activeTab === 'cancelled' && 'Rejected orders will appear here.'}
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4">
                            {paginatedOrders.map((order) => (
                                <div key={order.order_id}>{renderOrderCard(order)}</div>
                            ))}
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Showing {(currentPage - 1) * ORDERS_PER_PAGE + 1}–{Math.min(currentPage * ORDERS_PER_PAGE, activeOrders.length)} of {activeOrders.length}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                    >
                                        Prev
                                    </button>
                                    <span className="text-sm text-gray-600 dark:text-gray-300">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
                </div>
            </div>

            {/* Order Modal */}
            {renderOrderModal()}

            {/* Payment Proof Lightbox */}
            {lightboxImage && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setLightboxImage(null)}>
                    <div className="relative max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <img src={lightboxImage} alt="Payment proof" className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl" />
                        <button
                            onClick={() => setLightboxImage(null)}
                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            <ConfirmModal {...confirmModalProps} />
        </AppSidebarLayout>
    );
}
