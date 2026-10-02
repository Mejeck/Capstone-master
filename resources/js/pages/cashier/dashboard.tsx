import { Head } from '@inertiajs/react';
import { Link } from '@inertiajs/react';
import AppHeaderLayout from '@/layouts/app/app-header-layout';
import { type BreadcrumbItem } from '@/types';
import { getCsrfHeaders } from '@/lib/csrf';
import { useState, useEffect } from 'react';
import {
    ShoppingCart,
    CircleDollarSign,
    Hash,
    Users,
    Clock,
    AlertCircle,
    RotateCcw,
    CreditCard,
    ArrowUpRight,
    Wallet,
    TriangleAlert,
} from 'lucide-react';
import { PENDING_PAYMENTS_UPDATED_EVENT } from '@/lib/cashier-events';
import { showToast } from '@/lib/toast';

interface DashboardProps {
    stats: {
        total_sales: number;
        total_transactions: number;
        total_cash_received: number;
        total_non_cash_received: number;
        total_change: number;
        average_transaction: number;
    };
    low_stock: Array<{
        product_name: string;
        current_quantity: number;
        min_stock_level: number;
        unit: string;
        is_critical: boolean;
    }>;
    cashier_name: string;
    daily_summary?: {
        id: number;
        summary_date: string;
        total_sales: number;
        total_transactions: number;
        total_cash_received: number;
        total_non_cash_received: number;
        total_change: number;
        average_transaction: number;
        reset_at?: string;
        reset_by?: {
            full_name: string;
        };
        notes?: string;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Cashier Dashboard',
        href: '/cashier/dashboard',
    },
];

export default function CashierDashboard({ stats, cashier_name, daily_summary, low_stock }: DashboardProps) {
    const [loading, setLoading] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetNotes, setResetNotes] = useState('');
    const [summaryHistory, setSummaryHistory] = useState([]);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [gcashCount, setGcashCount] = useState<number | null>(null);
    const [codCount, setCodCount] = useState<number | null>(null);

    const formatCurrency = (amount: number | string) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        return `₱${numAmount.toFixed(2)}`;
    };

    const isResetToday = daily_summary?.reset_at;

    const resetDailySummary = async () => {
        setLoading(true);
        try {
            const response = await fetch('/cashier/api/daily-summary/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getCsrfHeaders(),
                },
                body: JSON.stringify({ notes: resetNotes }),
            });
            const data = await response.json();
            if (data.success) {
                // A toast dispatched right before reload would never be seen —
                // the page (and the FlashToaster listening for it) unmounts
                // before it can render. Stash a flag and show it after the
                // reload instead, once this page's own mount effect picks it up.
                sessionStorage.setItem('dailySummaryJustReset', '1');
                window.location.reload();
            } else {
                alert(data.message || 'Failed to reset daily summary');
            }
        } catch {
            alert('Failed to reset daily summary');
        } finally {
            setLoading(false);
        }
    };

    const fetchSummaryHistory = async () => {
        try {
            const response = await fetch('/cashier/api/daily-summary/history');
            const data = await response.json();
            setSummaryHistory(data.summaries || []);
        } catch {
            console.error('Error fetching summary history');
        }
    };

    useEffect(() => {
        if (showHistoryModal) fetchSummaryHistory();
    }, [showHistoryModal]);

    // Picks up the flag resetDailySummary stashed right before reloading —
    // see the comment there for why the toast couldn't just fire from there.
    useEffect(() => {
        if (sessionStorage.getItem('dailySummaryJustReset') === '1') {
            sessionStorage.removeItem('dailySummaryJustReset');
            showToast('success', 'Daily summary reset.');
        }
    }, []);

    useEffect(() => {
        const loadPendingCounts = () => {
            Promise.all([
                fetch('/cashier/api/gcash-pending').then((r) => r.json()).catch(() => []),
                fetch('/cashier/api/cod-pending').then((r) => r.json()).catch(() => []),
            ]).then(([gcash, cod]) => {
                setGcashCount(Array.isArray(gcash) ? gcash.length : 0);
                setCodCount(Array.isArray(cod) ? cod.length : 0);
            });
        };
        loadPendingCounts();
        // These counts are fetched once here rather than read from Inertia
        // props, so a confirm/reject done through the header's notification
        // bell (or the Orders page) wouldn't otherwise be reflected here
        // until the next full page load — this event is how those tell this
        // page to refetch.
        window.addEventListener(PENDING_PAYMENTS_UPDATED_EVENT, loadPendingCounts);
        return () => window.removeEventListener(PENDING_PAYMENTS_UPDATED_EVENT, loadPendingCounts);
    }, []);

    const totalPending = (gcashCount ?? 0) + (codCount ?? 0);

    const sectionHeader = (icon: React.ReactNode, iconBg: string, title: string, badge?: React.ReactNode) => (
        <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2.5">
            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</span>
            {title}
            {badge}
        </h2>
    );

    return (
        <AppHeaderLayout breadcrumbs={breadcrumbs}>
            <Head title="Cashier Dashboard - Mejeck Ice Plant" />
            {/* Now that Quick Actions is gone (both its links duplicated the top
                nav), the remaining sections are sized up — more padding, bigger
                numbers — so the page reads as full and intentional instead of
                leaving dead space below Action Needed. */}
            <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 sm:p-6 space-y-4">

                {/* Header — plain, no card chrome (no background/border/shadow). This
                    is the page title and its primary actions, not a data card, so it
                    shouldn't look like one of the content cards below it.
                    Stacked (column) on mobile so Reset Daily/History get their own
                    deliberate row with a separator, instead of just wrapping under
                    the welcome text wherever there happens to be room; back to a
                    single row on sm+ screens where there's space for both. */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-cyan-600 flex items-center justify-center shadow-sm flex-shrink-0">
                            <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        </span>
                        <div>
                            {/* Sized up now that the Total Sales banner and stat cards
                                below carry much bigger numbers — at the old text-xl the
                                title read as an afterthought next to them. */}
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Cashier Dashboard</h1>
                            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-0.5">
                                Welcome back, {cashier_name} — here's your sales overview for today.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-3 pt-2 border-t border-gray-200 dark:border-gray-700 sm:pt-0 sm:border-t-0">
                        {isResetToday ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300 rounded-lg">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">Reset Today</span>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowResetModal(true)}
                                className="flex items-center gap-1.5 px-3 py-2 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">Reset Daily</span>
                            </button>
                        )}
                        <button
                            onClick={() => setShowHistoryModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">History</span>
                        </button>
                    </div>
                </div>

                {isResetToday && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                        <div className="flex items-center gap-2 text-orange-800 dark:text-orange-300">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm">
                                Daily summary was reset at{' '}
                                {daily_summary.reset_at ? new Date(daily_summary.reset_at).toLocaleTimeString() : ''} by{' '}
                                {daily_summary.reset_by?.full_name}
                                {daily_summary.notes && ` — "${daily_summary.notes}"`}
                            </span>
                        </div>
                    </div>
                )}

                {/* Hero: Total Sales + Primary CTA */}
                <div className="bg-gradient-to-br from-cyan-600 to-cyan-800 dark:from-cyan-700 dark:to-cyan-950 rounded-2xl border-2 border-cyan-700/50 dark:border-cyan-800 shadow-lg p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-cyan-100 flex items-center gap-1.5">
                            <CircleDollarSign className="w-4 h-4" /> Total Sales Today
                        </p>
                        <p className="text-3xl sm:text-4xl font-bold mt-1">{formatCurrency(stats.total_sales)}</p>
                    </div>
                    <Link
                        href="/cashier/pos"
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-cyan-700 rounded-xl font-semibold hover:bg-cyan-50 transition-colors shadow-sm whitespace-nowrap"
                    >
                        <ShoppingCart className="w-5 h-5" />
                        Start New Sale
                    </Link>
                </div>

                {/* Stats Cards — kept right under the Total Sales banner since these
                    four numbers are a breakdown of that same figure, not a separate
                    topic; Action Needed and Quick Actions come after since they're
                    about what to do next, not what already happened today. */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-md p-3 sm:p-4 flex items-center gap-3">
                        <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            {/* A plain count symbol, not a currency one — this is a count
                                of sales, not a money amount. (First tried Receipt here,
                                but that icon has a dollar sign drawn into it, same
                                problem as the peso sign it was meant to replace.) */}
                            <Hash className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Transactions</p>
                            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">{stats.total_transactions}</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-md p-3 sm:p-4 flex items-center gap-3">
                        <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
                            <Wallet className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Cash Received</p>
                            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">{formatCurrency(stats.total_cash_received)}</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-md p-3 sm:p-4 flex items-center gap-3">
                        <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
                            <CreditCard className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Non-Cash Received</p>
                            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">{formatCurrency(stats.total_non_cash_received)}</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 shadow-md p-3 sm:p-4 flex items-center gap-3">
                        <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
                            <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Average Sale</p>
                            <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">{formatCurrency(stats.average_transaction)}</p>
                        </div>
                    </div>
                </div>

                {/* Action Needed — pending payment verifications and low stock need
                    the cashier to actually do something about them, so this sits
                    above Quick Actions (just links elsewhere) even though it comes
                    after the "what already happened today" summary above. */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-md overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        {sectionHeader(
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
                            'bg-amber-100 dark:bg-amber-900/30',
                            'Action Needed',
                            (low_stock.length > 0 || totalPending > 0) ? (
                                <span className="flex items-center gap-1.5">
                                    {low_stock.length > 0 && (
                                        <span className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                                            <TriangleAlert className="w-3 h-3" /> {low_stock.length} stock
                                        </span>
                                    )}
                                    {totalPending > 0 && (
                                        <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full">
                                            <CreditCard className="w-3 h-3" /> {totalPending} payment{totalPending !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </span>
                            ) : undefined,
                        )}
                    </div>

                    <div className="px-4 py-1.5 bg-gray-50 dark:bg-slate-700/30">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Pending Payment Verification
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                        {/* GCash attention card */}
                        <Link
                            href="/cashier/orders"
                            className={`group flex items-center justify-between p-3 sm:p-4 rounded-xl border-2 shadow-md transition-all ${
                                gcashCount && gcashCount > 0
                                    ? 'border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/20 hover:shadow-lg hover:border-cyan-400'
                                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/30 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                        gcashCount && gcashCount > 0
                                            ? 'bg-cyan-500'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                    }`}
                                >
                                    <CreditCard
                                        className={`w-5 h-5 ${
                                            gcashCount && gcashCount > 0
                                                ? 'text-white'
                                                : 'text-gray-400 dark:text-gray-500'
                                        }`}
                                    />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                        GCash Proofs
                                    </p>
                                    <p
                                        className={`text-2xl font-bold leading-none mt-0.5 ${
                                            gcashCount && gcashCount > 0
                                                ? 'text-cyan-600 dark:text-cyan-400'
                                                : 'text-gray-300 dark:text-gray-600'
                                        }`}
                                    >
                                        {gcashCount === null ? '—' : gcashCount}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {gcashCount === 1 ? 'proof' : 'proofs'} pending verification
                                    </p>
                                </div>
                            </div>
                            <ArrowUpRight
                                className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                                    gcashCount && gcashCount > 0
                                        ? 'text-cyan-400'
                                        : 'text-gray-300 dark:text-gray-600'
                                }`}
                            />
                        </Link>

                        {/* COD attention card */}
                        <Link
                            href="/cashier/orders"
                            className={`group flex items-center justify-between p-3 sm:p-4 rounded-xl border-2 shadow-md transition-all ${
                                codCount && codCount > 0
                                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 hover:shadow-lg hover:border-amber-400'
                                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/30 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                        codCount && codCount > 0
                                            ? 'bg-amber-500'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                    }`}
                                >
                                    <Wallet
                                        className={`w-5 h-5 ${
                                            codCount && codCount > 0
                                                ? 'text-white'
                                                : 'text-gray-400 dark:text-gray-500'
                                        }`}
                                    />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                        COD Down Payments
                                    </p>
                                    <p
                                        className={`text-2xl font-bold leading-none mt-0.5 ${
                                            codCount && codCount > 0
                                                ? 'text-amber-600 dark:text-amber-400'
                                                : 'text-gray-300 dark:text-gray-600'
                                        }`}
                                    >
                                        {codCount === null ? '—' : codCount}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {codCount === 1 ? 'proof' : 'proofs'} pending verification
                                    </p>
                                </div>
                            </div>
                            <ArrowUpRight
                                className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                                    codCount && codCount > 0
                                        ? 'text-amber-400'
                                        : 'text-gray-300 dark:text-gray-600'
                                }`}
                            />
                        </Link>
                    </div>

                    {low_stock.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between px-4 py-1.5 bg-red-50 dark:bg-red-900/10">
                                <span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                                    <TriangleAlert className="w-3.5 h-3.5" /> Low Stock — inform the admin to restock
                                </span>
                                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                    {low_stock.length}
                                </span>
                            </div>
                            {/* Capped and internally scrollable: a long low-stock list
                                would otherwise grow this card without bound and push
                                everything below it off the screen. */}
                            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-40 overflow-y-auto">
                                {low_stock.map((item) => (
                                    <div key={item.product_name} className="flex items-center justify-between px-4 py-2">
                                        <div className="flex items-center gap-3">
                                            {item.is_critical ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">
                                                    <TriangleAlert className="w-3 h-3" /> Critical
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">
                                                    Low
                                                </span>
                                            )}
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {item.product_name}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-sm font-bold ${item.is_critical ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                                {item.current_quantity} {item.unit}
                                            </span>
                                            <span className="text-xs text-gray-400 dark:text-gray-500 ml-1.5">
                                                / min {item.min_stock_level}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Reset Daily Summary Modal */}
                {showResetModal && (
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reset Daily Summary</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                    This will reset today's sales summary to zero. All transaction history will still be available in Sales History.
                                </p>
                            </div>
                            <div className="p-6">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Reset Notes (Optional)
                                </label>
                                <textarea
                                    value={resetNotes}
                                    onChange={(e) => setResetNotes(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-slate-700 dark:text-white"
                                    rows={3}
                                    placeholder="Add notes about this reset (e.g., End of shift, Handover, etc.)"
                                />
                            </div>
                            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                                <button
                                    onClick={() => { setShowResetModal(false); setResetNotes(''); }}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={resetDailySummary}
                                    disabled={loading}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {loading ? 'Resetting...' : 'Reset Daily Summary'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Daily Summary History Modal */}
                {showHistoryModal && (
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Daily Summary History</h3>
                            </div>
                            <div className="p-6 overflow-y-auto max-h-[60vh]">
                                {summaryHistory.length > 0 ? (
                                    <div className="space-y-4">
                                        {summaryHistory.map((summary: any) => (
                                            <div key={summary.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h4 className="font-medium text-gray-900 dark:text-white">
                                                            {new Date(summary.summary_date).toLocaleDateString('en-US', {
                                                                weekday: 'long',
                                                                year: 'numeric',
                                                                month: 'long',
                                                                day: 'numeric',
                                                            })}
                                                        </h4>
                                                        {summary.reset_at && (
                                                            <div className="flex items-center gap-2 mt-1 text-sm text-orange-600 dark:text-orange-400">
                                                                <AlertCircle className="w-3 h-3" />
                                                                <span>Reset at {new Date(summary.reset_at).toLocaleTimeString()}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-semibold text-cyan-600 dark:text-cyan-400">
                                                            {formatCurrency(summary.total_sales)}
                                                        </div>
                                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                                            {summary.total_transactions} transactions
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                                    <div>
                                                        <span className="text-gray-500 dark:text-gray-400">Cash Received:</span>
                                                        <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(summary.total_cash_received)}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 dark:text-gray-400">Non-Cash (GCash):</span>
                                                        <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(summary.total_non_cash_received ?? 0)}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 dark:text-gray-400">Change Given:</span>
                                                        <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(summary.total_change)}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 dark:text-gray-400">Average Sale:</span>
                                                        <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(summary.average_transaction)}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 dark:text-gray-400">Reset By:</span>
                                                        <div className="font-medium text-gray-900 dark:text-white">{summary.reset_by?.full_name || 'Not reset'}</div>
                                                    </div>
                                                </div>
                                                {summary.notes && (
                                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                                        <span className="text-sm text-gray-500 dark:text-gray-400">Notes:</span>
                                                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{summary.notes}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                        <p className="text-gray-600 dark:text-gray-400">No daily summary history available</p>
                                    </div>
                                )}
                            </div>
                            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                                <button
                                    onClick={() => setShowHistoryModal(false)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppHeaderLayout>
    );
}
