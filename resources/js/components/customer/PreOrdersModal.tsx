import { CheckCircle, Clock, Package, X } from 'lucide-react';
import { getStatusColor } from '@/lib/order-status';
import type { PreOrderSummary } from '@/types/customer-order';

interface PreOrdersModalProps<T extends PreOrderSummary> {
    open: boolean;
    onClose: () => void;
    preOrders: T[];
    // Dashboard passes checkoutPreOrder to show a "Checkout Now" button per
    // pending/processing order; Cart passes nothing, so no button renders —
    // Cart's pre-orders modal stays view-only.
    onCheckout?: (order: T) => void;
}

export default function PreOrdersModal<T extends PreOrderSummary>({ open, onClose, preOrders, onCheckout }: PreOrdersModalProps<T>) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center justify-between gap-3 mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Pre-Orders</h2>
                        <button
                            onClick={onClose}
                            aria-label="Close"
                            className="p-2.5 -m-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                        >
                            <X className="w-7 h-7 text-gray-600 dark:text-gray-300" />
                        </button>
                    </div>

                    {preOrders.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                            <p>No pre-orders yet</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {preOrders.map(order => (
                                <div
                                    key={order.order_id}
                                    className={`p-4 rounded-lg border-2 transition-all ${
                                        (order.status === 'Delivered' || order.status === 'Completed')
                                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-500 dark:border-green-400 shadow-md'
                                            : 'bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center space-x-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                (order.status === 'Delivered' || order.status === 'Completed')
                                                    ? 'bg-green-500 dark:bg-green-600'
                                                    : 'bg-cyan-100 dark:bg-cyan-900'
                                            }`}>
                                                {(order.status === 'Delivered' || order.status === 'Completed') ? (
                                                    <CheckCircle className="w-5 h-5 text-white" />
                                                ) : (
                                                    <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-300" />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900 dark:text-white">Order #{order.order_id}</h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">{new Date(order.order_date).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                            <span className="font-bold text-gray-900 dark:text-white">₱{Number(order.total_amount).toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-600 dark:text-gray-400">Status:</span>
                                            <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600 dark:text-gray-400">Payment:</span>
                                            <span className="ml-2 text-gray-900 dark:text-white">{order.payment_method}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600 dark:text-gray-400">Date:</span>
                                            <span className="ml-2 text-gray-900 dark:text-white">
                                                {new Date(order.order_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600 dark:text-gray-400">Total:</span>
                                            <span className="ml-2 text-cyan-600 dark:text-cyan-400 font-bold">
                                                ₱{Number(order.total_amount).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                    {onCheckout && (
                                        <button
                                            onClick={() => onCheckout(order)}
                                            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center"
                                        >
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Checkout Now
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
