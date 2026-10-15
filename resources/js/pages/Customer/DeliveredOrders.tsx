import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    Package,
    CheckCircle,
    AlertTriangle,
    Search,
    Eye,
    Camera,
    AlertCircle,
} from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';
import PullToRefresh from '@/components/pull-to-refresh';

interface OrderItem {
    product_name: string;
    quantity: number;
    unit_price: number;
    image?: string;
}

interface Order {
    order_id: number;
    total_amount: number;
    status: string;
    order_date: string;
    order_type: string;
    payment_status?: string;
    items?: OrderItem[];
}

interface DeliveredOrdersProps {
    orders: Order[];
}

const reportTypes = [
    { type: 'damaged_beverages',  title: 'Damaged Items',      icon: AlertTriangle, color: 'red' },
    { type: 'delivery_boy_issue', title: 'Delivery Boy Issue', icon: AlertCircle,   color: 'yellow' },
    { type: 'other',              title: 'Other Issue',        icon: AlertCircle,   color: 'gray' },
];

export default function DeliveredOrders({ orders }: DeliveredOrdersProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredOrders = orders.filter(order =>
        searchQuery === '' ||
        order.order_id.toString().includes(searchQuery) ||
        order.order_type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // This page has no client-side polling of its own (unlike My Orders),
    // so a pull-to-refresh here re-visits the current route to pull fresh
    // "orders" props from the server instead of re-fetching via a separate
    // API call.
    const handleRefresh = () =>
        new Promise<void>((resolve) => {
            // router.reload() always preserves scroll/state internally, so
            // preserveScroll isn't a valid (or needed) option here.
            router.reload({ only: ['orders'], onFinish: () => resolve() });
        });

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
            <Head title="Delivered Orders" />
            <CustomerNav currentPage="orders" />

            <PullToRefresh onRefresh={handleRefresh}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">

                {/* Page Heading */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Delivered Orders</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Review your delivered orders and report any issues.
                    </p>
                </div>

                {/* Search */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 mb-5">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search by order ID or type…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors"
                        />
                    </div>
                </div>

                {/* Orders List */}
                <div className="space-y-4">
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <Package className="w-14 h-14 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                No Delivered Orders
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {searchQuery ? 'No orders match your search.' : "Your delivered orders will appear here."}
                            </p>
                        </div>
                    ) : (
                        filteredOrders.map(order => (
                            <div
                                key={order.order_id}
                                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden"
                            >
                                {/* Green left accent */}
                                <div className="flex">
                                    <div className="w-1 bg-green-500 flex-shrink-0" />

                                    <div className="flex-1 p-5">
                                        {/* Order Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                        Order #{order.order_id}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                        {new Date(order.order_date).toLocaleDateString('en-PH', {
                                                            year: 'numeric', month: 'short', day: 'numeric',
                                                        })}
                                                        {' · '}
                                                        <span className="capitalize">{order.order_type}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    {order.status}
                                                </span>
                                                <span className="font-bold text-gray-900 dark:text-white text-sm">
                                                    ₱{Number(order.total_amount).toFixed(2)}
                                                </span>
                                                <Link
                                                    href={route('customer.orders.show', order.order_id)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors text-xs font-medium shadow-sm"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    View Details
                                                </Link>
                                            </div>
                                        </div>

                                        {/* Order Items Preview */}
                                        {order.items && order.items.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Items</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {order.items.slice(0, 6).map((item, index) => (
                                                        <div key={index} className="flex items-center gap-2.5 p-2.5 bg-gray-50 dark:bg-slate-700/60 rounded-lg">
                                                            <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                <Package className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                                                    {item.product_name}
                                                                </p>
                                                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                                    x{item.quantity} · ₱{Number(item.unit_price).toFixed(2)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {order.items.length > 6 && (
                                                        <div className="flex items-center justify-center p-2.5 bg-gray-50 dark:bg-slate-700/60 rounded-lg">
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                +{order.items.length - 6} more items
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Report Issue Section */}
                                        <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
                                            <div className="flex items-center justify-between mb-2.5">
                                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                                    Having issues?
                                                </p>
                                                <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                                                    <Camera className="w-3 h-3" /> Photos required
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {reportTypes.map(rt => {
                                                    const Icon = rt.icon;
                                                    const borderColor =
                                                        rt.color === 'red'    ? 'border-red-200 dark:border-red-800/60' :
                                                        rt.color === 'orange' ? 'border-orange-200 dark:border-orange-800/60' :
                                                        rt.color === 'yellow' ? 'border-yellow-200 dark:border-yellow-800/60' :
                                                                                'border-gray-200 dark:border-slate-600';
                                                    const iconColor =
                                                        rt.color === 'red'    ? 'text-red-500' :
                                                        rt.color === 'orange' ? 'text-orange-500' :
                                                        rt.color === 'yellow' ? 'text-yellow-500' :
                                                                                'text-gray-400 dark:text-gray-500';
                                                    return (
                                                        <Link
                                                            key={rt.type}
                                                            href={route('customer.reports.create', {
                                                                order_id: order.order_id,
                                                                report_type: rt.type,
                                                            })}
                                                            className={`block p-3 border-2 rounded-xl hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-all text-center ${borderColor}`}
                                                        >
                                                            <Icon className={`w-4 h-4 mx-auto mb-1 ${iconColor}`} />
                                                            <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 leading-tight">
                                                                {rt.title}
                                                            </p>
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            </PullToRefresh>
        </div>
    );
}
