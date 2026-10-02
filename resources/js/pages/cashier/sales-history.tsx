import { Head, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import AppHeaderLayout from '@/layouts/app/app-header-layout';
import { type BreadcrumbItem } from '@/types';
import { getCsrfHeaders } from '@/lib/csrf';
import { showToast } from '@/lib/toast';
import { VOID_SALE_REASONS, OTHER_VOID_REASON } from '@/constants/voidSaleReasons';
import {
    ReceiptText,
    Download,
    Eye,
    Wallet,
    CreditCard,
    Banknote,
    X,
    Ban
} from 'lucide-react';

interface SalesHistoryProps {
    sales: {
        data: Array<{
            id: number;
            sale_id: number;
            receipt_number: string;
            total_amount: number;
            payment_method: string;
            cash_received: number;
            change_amount: number;
            created_at: string;
            can_void: boolean;
            voided_at: string | null;
            void_reason: string | null;
            items: Array<{
                order_item_id: number;
                product_name: string;
                quantity: number;
                unit_price: number;
                subtotal: number;
                can_void: boolean;
                voided_at: string | null;
                void_reason: string | null;
            }>;
        }>;
        links: Array<{
            url: string | null;
            label: string;
            active: boolean;
        }>;
    };
}

// Empty: the top nav/sidebar already shows which page is active, and
// the page has its own heading below, so a "Dashboard > X" trail here was
// just repeating both without adding a real path back anywhere new.
const breadcrumbs: BreadcrumbItem[] = [];

export default function SalesHistory({ sales }: SalesHistoryProps) {
    const [selectedSale, setSelectedSale] = useState<any>(null);
    // The sale currently in the "why are you voiding this" prompt, or null
    // when that prompt is closed.
    const [voidingSale, setVoidingSale] = useState<SalesHistoryProps['sales']['data'][number] | null>(null);
    // The single line item currently in the "why are you voiding this" prompt
    // (voidingSale and voidingItem are mutually exclusive — only one modal
    // trigger sets its target at a time).
    const [voidingItem, setVoidingItem] = useState<{ sale: SalesHistoryProps['sales']['data'][number]; item: SalesHistoryProps['sales']['data'][number]['items'][number] } | null>(null);
    const [voidReason, setVoidReason] = useState('');
    // Which dropdown option is picked — a preset reason (used verbatim as
    // voidReason) or OTHER_VOID_REASON, which instead reveals a free-text
    // box for whatever isn't already covered by a preset.
    const [voidReasonPreset, setVoidReasonPreset] = useState('');
    const [voiding, setVoiding] = useState(false);

    // Close whichever modal is open with the Escape key.
    useEffect(() => {
        if (!selectedSale && !voidingSale && !voidingItem) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (voidingSale || voidingItem) {
                setVoidingSale(null);
                setVoidingItem(null);
                setVoidReason('');
                setVoidReasonPreset('');
            } else if (selectedSale) {
                setSelectedSale(null);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [selectedSale, voidingSale, voidingItem]);

    // Keeps the open "Items Purchased" detail modal in sync with the sales
    // list after a per-item void reloads it — without this, the modal would
    // keep showing the stale, pre-void item state until closed and reopened.
    useEffect(() => {
        if (!selectedSale) return;
        const updated = sales.data.find((s) => s.sale_id === selectedSale.sale_id);
        if (updated) setSelectedSale(updated);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sales]);

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
                return <Wallet className="w-4 h-4" />;
        }
    };

    const exportCsv = () => {
        window.location.href = '/cashier/sales-history/export';
    };

    const confirmVoidSale = async () => {
        if ((!voidingSale && !voidingItem) || !voidReason.trim()) return;

        const url = voidingSale
            ? `/cashier/sales-history/${voidingSale.sale_id}/void`
            : `/cashier/sales-history/${voidingItem!.sale.sale_id}/items/${voidingItem!.item.order_item_id}/void`;

        setVoiding(true);
        try {
            const response = await fetch(url, {
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
                const wasItem = !!voidingItem;
                setVoidingSale(null);
                setVoidingItem(null);
                setVoidReason('');
                setVoidReasonPreset('');
                // Refetch just the sales list so the row (and, if open, the
                // item detail modal via the sync effect above) reflect the
                // reversal and today's totals elsewhere.
                router.reload({ only: ['sales'] });
                showToast('success', wasItem ? 'Item voided. Stock has been restored.' : 'Sale voided. Stock has been restored.');
            } else {
                showToast('error', result.message || 'Could not void this.');
            }
        } catch (error) {
            console.error('Error voiding:', error);
            showToast('error', 'Could not void this.');
        } finally {
            setVoiding(false);
        }
    };

    return (
        <AppHeaderLayout breadcrumbs={breadcrumbs}>
            <Head title="Sales History - Cashier - Mejeck Ice Plant" />
            <div className="p-3 sm:p-6">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex flex-wrap justify-between items-center gap-3">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <ReceiptText className="w-6 h-6" />
                                Sales History
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                Today's sales transactions — for past days, see Sales History in Admin.
                            </p>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                            <button
                                onClick={exportCsv}
                                disabled={sales.data.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                        </div>
                    </div>
                </div>

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
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Items</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Payment</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Cash Received</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">Change</th>
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
                                                            {new Date(sale.created_at).toLocaleDateString()}
                                                        </div>
                                                        <div className="text-gray-600 dark:text-gray-400">
                                                            {new Date(sale.created_at).toLocaleTimeString()}
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
                                                <td className="py-3 px-4">
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {formatCurrency(sale.cash_received)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {formatCurrency(sale.change_amount)}
                                                    </span>
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
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => setSelectedSale(sale)}
                                                            className="p-2 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors"
                                                            title="View details"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        {sale.can_void && (
                                                            <button
                                                                onClick={() => { setVoidingSale(sale); setVoidReason(''); setVoidReasonPreset(''); }}
                                                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                                title="Void this sale"
                                                            >
                                                                <Ban className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <ReceiptText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No sales yet today</h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Start making sales to see them here
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {sales.links && sales.links.length > 3 && (
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex justify-center">
                                <div className="flex gap-2">
                                    {sales.links.map((link, index) => (
                                        <button
                                            key={index}
                                            onClick={() => link.url && (window.location.href = link.url)}
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
                                                {new Date(selectedSale.created_at).toLocaleString()}
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
                                                {selectedSale.items.map((item: any, index: number) => (
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
                                                            {item.voided_at ? (
                                                                <span className="text-xs font-medium text-red-600 dark:text-red-400" title={item.void_reason || ''}>
                                                                    VOIDED
                                                                </span>
                                                            ) : item.can_void ? (
                                                                <button
                                                                    onClick={() => { setVoidingItem({ sale: selectedSale, item }); setVoidReason(''); setVoidReasonPreset(''); }}
                                                                    title="Void this item"
                                                                    className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                                >
                                                                    <Ban className="w-4 h-4" />
                                                                </button>
                                                            ) : null}
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
                                        </p>
                                        {selectedSale.void_reason && (
                                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                                Reason: {selectedSale.void_reason}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                                    {selectedSale.can_void && (
                                        <button
                                            onClick={() => { setVoidingSale(selectedSale); setVoidReason(''); setVoidReasonPreset(''); setSelectedSale(null); }}
                                            className="px-6 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center gap-2"
                                        >
                                            <Ban className="w-4 h-4" />
                                            Void This Sale
                                        </button>
                                    )}
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

                {/* Void Confirmation Modal — shared between voiding a whole
                    sale and voiding just one of its line items. */}
                {(voidingSale || voidingItem) && (
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full">
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
                                        {voidingSale ? `Void Sale ${voidingSale.receipt_number}` : `Void Item: ${voidingItem!.item.product_name}`}
                                    </h2>
                                    <button
                                        onClick={() => { setVoidingSale(null); setVoidingItem(null); setVoidReason(''); setVoidReasonPreset(''); }}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>

                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    {voidingSale ? (
                                        <>This reverses the sale of <strong>{formatCurrency(voidingSale.total_amount)}</strong> — the
                                        items sold are returned to stock and this sale is removed from today's totals. This cannot be undone.</>
                                    ) : (
                                        <>This returns <strong>{voidingItem!.item.quantity} {voidingItem!.item.product_name}</strong> (worth{' '}
                                        <strong>{formatCurrency(voidingItem!.item.subtotal)}</strong>) to stock and removes it from this sale's
                                        total. This cannot be undone.</>
                                    )}
                                </p>

                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Reason for voiding
                                </label>
                                <select
                                    value={voidReasonPreset}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setVoidReasonPreset(value);
                                        setVoidReason(value === OTHER_VOID_REASON ? '' : value);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                                        className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    />
                                )}

                                <div className="mt-6 flex justify-end gap-3">
                                    <button
                                        onClick={() => { setVoidingSale(null); setVoidingItem(null); setVoidReason(''); setVoidReasonPreset(''); }}
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmVoidSale}
                                        disabled={!voidReason.trim() || voiding}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {voiding ? 'Voiding...' : (voidingSale ? 'Void Sale' : 'Void Item')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppHeaderLayout>
    );
}
