import { Head, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';
import PesoSign from '@/components/icons/peso-sign';
import {
    History,
    Filter,
    Eye,
    CreditCard,
    Banknote,
    X,
    User,
} from 'lucide-react';

interface Cashier {
    id: number;
    full_name: string;
    role: string;
}

interface PosHistoryProps {
    sales: {
        data: Array<{
            sale_id: number;
            receipt_number: string;
            total_amount: number;
            payment_method: string;
            cash_received: number;
            change_amount: number;
            created_at: string;
            cashier_name: string;
            cashier_role: string | null;
            voided_at: string | null;
            voided_by: string | null;
            void_reason: string | null;
            items: Array<{
                order_item_id: number;
                product_name: string;
                quantity: number;
                unit_price: number;
                subtotal: number;
                voided_at: string | null;
                voided_by: string | null;
                void_reason: string | null;
            }>;
        }>;
        links: Array<{
            url: string | null;
            label: string;
            active: boolean;
        }>;
    };
    summary: {
        total_sales: number;
        total_transactions: number;
    };
    filters: {
        start_date?: string;
        end_date?: string;
        cashier_id?: string;
    };
    cashiers: Cashier[];
}

// Empty: the top nav/sidebar already shows which page is active, and
// the page has its own heading below, so a "Dashboard > X" trail here was
// just repeating both without adding a real path back anywhere new.
const breadcrumbs: BreadcrumbItem[] = [];

const ROLE_LABELS: Record<string, string> = {
    Admin: 'Admin',
    SuperAdmin: 'Super Admin',
    cashier: 'Cashier',
};

export default function PosHistory({ sales, summary, filters, cashiers }: PosHistoryProps) {
    const [showFilters, setShowFilters] = useState(false);
    const [selectedSale, setSelectedSale] = useState<PosHistoryProps['sales']['data'][number] | null>(null);
    const [startDate, setStartDate] = useState(filters.start_date || '');
    const [endDate, setEndDate] = useState(filters.end_date || '');
    const [cashierId, setCashierId] = useState(filters.cashier_id || '');

    // Close the "Sale Details" modal with the Escape key.
    useEffect(() => {
        if (!selectedSale) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedSale(null);
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [selectedSale]);

    const formatCurrency = (amount: number | string) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        return `₱${numAmount.toFixed(2)}`;
    };

    const getPaymentIcon = (method: string) => {
        switch (method.toLowerCase()) {
            case 'cash':
                return <Banknote className="w-4 h-4" />;
            case 'gcash':
                return <CreditCard className="w-4 h-4" />;
            default:
                return <PesoSign className="w-4 h-4" />;
        }
    };

    const applyFilters = () => {
        const params = new URLSearchParams();
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        if (cashierId) params.set('cashier_id', cashierId);

        router.visit(`/admin/pos/history${params.toString() ? '?' + params.toString() : ''}`);
    };

    const clearFilters = () => {
        setStartDate('');
        setEndDate('');
        setCashierId('');
        router.visit('/admin/pos/history');
    };

    const hasActiveFilters = Boolean(startDate || endDate || cashierId);

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="Sales History - Mejeck Ice Plant" />
            <div className="p-3 sm:p-6">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex flex-wrap justify-between items-center gap-3">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <History className="w-6 h-6" />
                                Sales History
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                Every POS sale recorded by any admin or cashier account
                            </p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            <button
                                onClick={() => router.visit('/admin/pos')}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                                Back to POS
                            </button>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                                <Filter className="w-4 h-4" />
                                Filters
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                            <PesoSign className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Total Sales{hasActiveFilters ? ' (filtered)' : ' (all time)'}
                            </p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(summary.total_sales)}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Transactions{hasActiveFilters ? ' (filtered)' : ' (all time)'}
                            </p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {summary.total_transactions}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                {showFilters && (
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filter Sales</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Cashier / Admin
                                </label>
                                <select
                                    value={cashierId}
                                    onChange={(e) => setCashierId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                >
                                    <option value="">All accounts</option>
                                    {cashiers.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.full_name} ({ROLE_LABELS[c.role] || c.role})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end gap-2">
                                <button
                                    onClick={applyFilters}
                                    className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                                >
                                    Apply
                                </button>
                                <button
                                    onClick={clearFilters}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sales Table */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="p-6">
                        {sales.data.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Receipt #</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Date & Time</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Cashier</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Items</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Payment</th>
                                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Total</th>
                                            <th className="text-center py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sales.data.map((sale) => (
                                            <tr key={sale.sale_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="py-3 px-4">
                                                    <span className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                                                        {sale.receipt_number}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="text-sm">
                                                        <div className="text-gray-900 dark:text-white">
                                                            {sale.created_at}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4 text-gray-400" />
                                                        <div>
                                                            <div className="text-sm text-gray-900 dark:text-white">{sale.cashier_name}</div>
                                                            {sale.cashier_role && (
                                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                    {ROLE_LABELS[sale.cashier_role] || sale.cashier_role}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {sale.items.length} items
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        {getPaymentIcon(sale.payment_method)}
                                                        <span className="text-sm capitalize text-gray-700 dark:text-gray-300">
                                                            {sale.payment_method}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className={`text-sm font-semibold ${sale.voided_at ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                                        {formatCurrency(sale.total_amount)}
                                                    </span>
                                                    {sale.voided_at && (
                                                        <div className="text-xs text-red-500 dark:text-red-400">Voided</div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button
                                                        onClick={() => setSelectedSale(sale)}
                                                        className="p-2 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors"
                                                        title="View details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No sales found</h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    {hasActiveFilters ? 'Try adjusting your filters' : 'No POS sales have been recorded yet'}
                                </p>
                                {hasActiveFilters && (
                                    <button
                                        onClick={clearFilters}
                                        className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {sales.links && sales.links.length > 3 && (
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex justify-center">
                                <div className="flex gap-2 flex-wrap">
                                    {sales.links.map((link, index) => (
                                        <button
                                            key={index}
                                            onClick={() => link.url && router.visit(link.url)}
                                            disabled={!link.url}
                                            className={`px-3 py-1 rounded text-sm transition-colors ${
                                                link.active
                                                    ? 'bg-cyan-500 text-white'
                                                    : link.url
                                                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                    : 'bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                            }`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sale Details Modal */}
                {selectedSale && (
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        Sale Details - {selectedSale.receipt_number}
                                        {selectedSale.voided_at && (
                                            <span className="text-xs font-semibold uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-1 rounded">
                                                Voided
                                            </span>
                                        )}
                                    </h2>
                                    <button
                                        onClick={() => setSelectedSale(null)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Date & Time:</span>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {selectedSale.created_at}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Recorded By:</span>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {selectedSale.cashier_name}
                                                {selectedSale.cashier_role && (
                                                    <span className="text-gray-500 dark:text-gray-400 font-normal">
                                                        {' '}({ROLE_LABELS[selectedSale.cashier_role] || selectedSale.cashier_role})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Payment Method:</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                {getPaymentIcon(selectedSale.payment_method)}
                                                <span className="font-medium text-gray-900 dark:text-white capitalize">
                                                    {selectedSale.payment_method}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Total Amount:</span>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {formatCurrency(selectedSale.total_amount)}
                                            </p>
                                        </div>
                                        {selectedSale.payment_method === 'cash' && (
                                            <>
                                                <div>
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">Cash Received:</span>
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {formatCurrency(selectedSale.cash_received)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">Change:</span>
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {formatCurrency(selectedSale.change_amount)}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Items Purchased</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Product</th>
                                                    <th className="text-center py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Quantity</th>
                                                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Unit Price</th>
                                                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Subtotal</th>
                                                    <th className="text-center py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedSale.items.map((item, index) => (
                                                    <tr key={index} className={`border-b border-gray-100 dark:border-gray-700 ${item.voided_at ? 'opacity-50' : ''}`}>
                                                        <td className="py-3 px-3">
                                                            <span className={`text-sm font-medium text-gray-900 dark:text-white ${item.voided_at ? 'line-through' : ''}`}>
                                                                {item.product_name}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                                {item.quantity}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-right">
                                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                                {formatCurrency(item.unit_price)}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-right">
                                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                                {formatCurrency(item.subtotal)}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            {item.voided_at && (
                                                                <span
                                                                    className="text-xs font-medium text-red-600 dark:text-red-400"
                                                                    title={[item.voided_by, item.void_reason].filter(Boolean).join(' — ')}
                                                                >
                                                                    VOIDED
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {selectedSale.voided_at && (
                                    <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                        <p className="text-sm font-medium text-red-700 dark:text-red-300">
                                            Voided on {selectedSale.voided_at}
                                            {selectedSale.voided_by ? ` by ${selectedSale.voided_by}` : ''}
                                        </p>
                                        {selectedSale.void_reason && (
                                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                                Reason: {selectedSale.void_reason}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                                    <button
                                        onClick={() => setSelectedSale(null)}
                                        className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        Close
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
