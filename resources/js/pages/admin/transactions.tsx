import { Head } from '@inertiajs/react';
import { useState } from 'react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { getOrderDisplayStatus, getStatusColor } from '@/lib/order-status';
import { type BreadcrumbItem } from '@/types';
import { History, Package, ShoppingCart, TrendingUp, ArrowUpDown, Calendar, User, Filter, Search, ArrowUpRight, ArrowDownRight, Plus, Minus, RefreshCw, Wine, ChevronLeft, ChevronRight } from 'lucide-react';

interface StockLog {
    stock_log_id: number;
    product_id: number;
    transaction_type: string;
    quantity: number;
    transaction_date: string;
    created_at: string;
    product?: {
        product_name: string;
    };
    user?: {
        name: string;
    };
}

interface Order {
    order_id: number;
    customer_id: number;
    order_date: string;
    status: string;
    total_amount: number;
    customer?: {
        name: string;
    };
    orderItems?: {
        product: {
            product_name: string;
        };
        quantity: number;
    }[];
}

interface Product {
    product_id: number;
    product_name: string;
    created_at: string;
    category?: {
        category_name: string;
    };
    inventory?: {
        current_quantity: number;
    };
}

interface Sale {
    sale_id: number;
    order_id: number;
    sale_date: string;
    total_amount: number;
    order?: {
        customer?: {
            name: string;
        };
    };
}

interface DamagedBeverage {
    id: number;
    beverage_type: string;
    quantity: number;
    unit_type: string;
    report_date: string;
    reporter?: {
        full_name: string;
    };
}

interface TransactionsProps {
    stockLogs: StockLog[];
    recentOrders: Order[];
    recentProducts: Product[];
    recentSales: Sale[];
    recentDamagedBeverages?: DamagedBeverage[];
}

// Empty: the top nav/sidebar already shows which page is active, and
// the page has its own heading below, so a "Dashboard > X" trail here was
// just repeating both without adding a real path back anywhere new.
const breadcrumbs: BreadcrumbItem[] = [];

// Shared pagination bar used at the bottom of every table on this page, so page/prev/next
// behave and look identical across the five tabs instead of five hand-duplicated copies.
function TablePagination({
    page,
    totalPages,
    totalItems,
    perPage,
    onPageChange,
}: {
    page: number;
    totalPages: number;
    totalItems: number;
    perPage: number;
    onPageChange: (page: number) => void;
}) {
    if (totalItems === 0) return null;

    return (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, totalItems)} of {totalItems}
            </span>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                    Page {page} of {totalPages}
                </span>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                    Next
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

export default function Transactions({
    stockLogs,
    recentOrders,
    recentProducts,
    recentSales,
    recentDamagedBeverages,
}: TransactionsProps) {
    const [activeTab, setActiveTab] = useState('stock-logs');
    const [searchTerm, setSearchTerm] = useState('');

    const ROWS_PER_PAGE = 10;

    const [stockLogsPage, setStockLogsPage] = useState(1);
    const stockLogsTotalPages = Math.max(1, Math.ceil(stockLogs.length / ROWS_PER_PAGE));
    const paginatedStockLogs = stockLogs.slice((stockLogsPage - 1) * ROWS_PER_PAGE, stockLogsPage * ROWS_PER_PAGE);

    const [ordersPage, setOrdersPage] = useState(1);
    const ordersTotalPages = Math.max(1, Math.ceil(recentOrders.length / ROWS_PER_PAGE));
    const paginatedOrders = recentOrders.slice((ordersPage - 1) * ROWS_PER_PAGE, ordersPage * ROWS_PER_PAGE);

    const [productsPage, setProductsPage] = useState(1);
    const productsTotalPages = Math.max(1, Math.ceil(recentProducts.length / ROWS_PER_PAGE));
    const paginatedProducts = recentProducts.slice((productsPage - 1) * ROWS_PER_PAGE, productsPage * ROWS_PER_PAGE);

    const [salesPage, setSalesPage] = useState(1);
    const salesTotalPages = Math.max(1, Math.ceil(recentSales.length / ROWS_PER_PAGE));
    const paginatedSales = recentSales.slice((salesPage - 1) * ROWS_PER_PAGE, salesPage * ROWS_PER_PAGE);

    const safeRecentDamagedBeverages = recentDamagedBeverages || [];
    const [damagedBeveragesPage, setDamagedBeveragesPage] = useState(1);
    const damagedBeveragesTotalPages = Math.max(1, Math.ceil(safeRecentDamagedBeverages.length / ROWS_PER_PAGE));
    const paginatedDamagedBeverages = safeRecentDamagedBeverages.slice(
        (damagedBeveragesPage - 1) * ROWS_PER_PAGE,
        damagedBeveragesPage * ROWS_PER_PAGE
    );

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case 'STOCK_IN':
                return <Plus className="w-4 h-4 text-green-500" />;
            case 'STOCK_OUT':
                return <Minus className="w-4 h-4 text-red-500" />;
            case 'RETURN':
                return <RefreshCw className="w-4 h-4 text-blue-500" />;
            default:
                return <ArrowUpDown className="w-4 h-4 text-gray-500" />;
        }
    };

    const getTransactionColor = (type: string) => {
        switch (type) {
            case 'STOCK_IN':
                return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200';
            case 'STOCK_OUT':
                return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200';
            case 'RETURN':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200';
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200';
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="Transactions & History - Mejeck Ice Plant" />
            
            <div className="space-y-6 px-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions & History</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">View all system activities and transaction history</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 sm:flex-none">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search transactions..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-auto pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg p-3 border border-cyan-200/50 dark:border-cyan-700/50 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-cyan-200/40 to-blue-200/40 rounded-full blur-xl"></div>
                        <div className="relative">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <ArrowUpDown className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Stock Transactions</span>
                                </div>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{stockLogs.length}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Total transactions</div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-3 border border-purple-200/50 dark:border-purple-700/50 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-purple-200/40 to-pink-200/40 rounded-full blur-xl"></div>
                        <div className="relative">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Recent Orders</span>
                                </div>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{recentOrders.length}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Total orders</div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg p-3 border border-emerald-200/50 dark:border-emerald-700/50 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-emerald-200/40 to-green-200/40 rounded-full blur-xl"></div>
                        <div className="relative">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <Package className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Products Added</span>
                                </div>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{recentProducts.length}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">New products</div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-lg p-3 border border-rose-200/50 dark:border-rose-700/50 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-rose-200/40 to-pink-200/40 rounded-full blur-xl"></div>
                        <div className="relative">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Sales Completed</span>
                                </div>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{recentSales.length}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Total sales</div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        {[
                            { id: 'stock-logs', label: 'Stock Logs', icon: ArrowUpDown },
                            { id: 'orders', label: 'Orders', icon: ShoppingCart },
                            { id: 'products', label: 'Products Added', icon: Package },
                            { id: 'sales', label: 'Sales', icon: TrendingUp },
                            { id: 'damaged-beverages', label: 'Damaged Beverages', icon: Wine },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center justify-center space-x-2 px-3 py-3 text-sm font-medium transition whitespace-nowrap rounded-lg ${
                                    activeTab === tab.id
                                        ? 'bg-cyan-500 text-white shadow-md'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stock Logs Tab */}
                {activeTab === 'stock-logs' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                <ArrowUpDown className="w-5 h-5 mr-2 text-cyan-500" />
                                Stock Transaction Logs
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-slate-700">
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Product</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Type</th>
                                        <th className="text-right py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Quantity</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">User</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedStockLogs.map((log) => (
                                        <tr key={log.stock_log_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                                    <Calendar className="w-4 h-4 mr-2" />
                                                    {new Date(log.created_at).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="font-medium text-gray-900 dark:text-white">{log.product?.product_name || 'Unknown'}</span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getTransactionColor(log.transaction_type)}`}>
                                                    {getTransactionIcon(log.transaction_type)}
                                                    <span className="ml-1">{log.transaction_type.replace('_', ' ')}</span>
                                                </span>
                                            </td>
                                            <td className="text-right py-4 px-4">
                                                <span className={`font-bold ${log.transaction_type === 'STOCK_IN' ? 'text-green-600' : log.transaction_type === 'STOCK_OUT' ? 'text-red-600' : 'text-blue-600'}`}>
                                                    {log.transaction_type === 'STOCK_OUT' ? '-' : '+'}{log.quantity}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                                    <User className="w-4 h-4 mr-2" />
                                                    {log.user?.name || 'System'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <TablePagination
                            page={stockLogsPage}
                            totalPages={stockLogsTotalPages}
                            totalItems={stockLogs.length}
                            perPage={ROWS_PER_PAGE}
                            onPageChange={setStockLogsPage}
                        />
                    </div>
                )}

                {/* Orders Tab */}
                {activeTab === 'orders' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                <ShoppingCart className="w-5 h-5 mr-2 text-purple-500" />
                                Recent Orders
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-slate-700">
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Items</th>
                                        <th className="text-right py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedOrders.map((order) => (
                                        <tr key={order.order_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                                    <Calendar className="w-4 h-4 mr-2" />
                                                    {new Date(order.order_date).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="font-medium text-gray-900 dark:text-white">{order.customer?.name || 'Guest'}</span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                                    {order.orderItems?.length || 0} item{(order.orderItems?.length || 0) !== 1 ? 's' : ''}
                                                </span>
                                            </td>
                                            <td className="text-right py-4 px-4">
                                                <span className="font-bold text-purple-600 dark:text-purple-400">₱{Number(order.total_amount).toFixed(2)}</span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(getOrderDisplayStatus(order))}`}>
                                                    {getOrderDisplayStatus(order)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <TablePagination
                            page={ordersPage}
                            totalPages={ordersTotalPages}
                            totalItems={recentOrders.length}
                            perPage={ROWS_PER_PAGE}
                            onPageChange={setOrdersPage}
                        />
                    </div>
                )}

                {/* Products Tab */}
                {activeTab === 'products' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                <Package className="w-5 h-5 mr-2 text-emerald-500" />
                                Recently Added Products
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-slate-700">
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Date Added</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Product</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Category</th>
                                        <th className="text-right py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Stock</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedProducts.map((product) => (
                                        <tr key={product.product_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                                    <Calendar className="w-4 h-4 mr-2" />
                                                    {new Date(product.created_at).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="font-medium text-gray-900 dark:text-white">{product.product_name}</span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-sm text-gray-600 dark:text-gray-300">{product.category?.category_name || 'Uncategorized'}</span>
                                            </td>
                                            <td className="text-right py-4 px-4">
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{product.inventory?.current_quantity || 0}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <TablePagination
                            page={productsPage}
                            totalPages={productsTotalPages}
                            totalItems={recentProducts.length}
                            perPage={ROWS_PER_PAGE}
                            onPageChange={setProductsPage}
                        />
                    </div>
                )}

                {/* Sales Tab */}
                {activeTab === 'sales' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                <TrendingUp className="w-5 h-5 mr-2 text-rose-500" />
                                Recent Sales
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-slate-700">
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                                        <th className="text-right py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedSales.map((sale) => (
                                        <tr key={sale.sale_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                                    <Calendar className="w-4 h-4 mr-2" />
                                                    {new Date(sale.sale_date).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="font-medium text-gray-900 dark:text-white">{sale.order?.customer?.name || 'Guest'}</span>
                                            </td>
                                            <td className="text-right py-4 px-4">
                                                <span className="font-bold text-rose-600 dark:text-rose-400">₱{Number(sale.total_amount).toFixed(2)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <TablePagination
                            page={salesPage}
                            totalPages={salesTotalPages}
                            totalItems={recentSales.length}
                            perPage={ROWS_PER_PAGE}
                            onPageChange={setSalesPage}
                        />
                    </div>
                )}

                {/* Damaged Beverages Tab */}
                {activeTab === 'damaged-beverages' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                                <Wine className="w-5 h-5 mr-2 text-red-500" />
                                Damaged Beverages
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-slate-700">
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Beverage Type</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Unit Type</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Quantity</th>
                                        <th className="text-left py-3 px-4 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Reported By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedDamagedBeverages.length > 0 ? (
                                        paginatedDamagedBeverages.map((item) => (
                                            <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                                        <Calendar className="w-4 h-4 mr-2" />
                                                        {new Date(item.report_date).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className="font-medium text-gray-900 dark:text-white">{item.beverage_type}</span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        item.unit_type === 'case' 
                                                            ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200'
                                                            : 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-200'
                                                    }`}>
                                                        {item.unit_type}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className="font-bold text-red-600 dark:text-red-400">{item.quantity}</span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className="text-gray-600 dark:text-gray-300">{item.reporter?.full_name || 'Unknown'}</span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-500 dark:text-gray-400">
                                                No damaged beverages reported
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <TablePagination
                            page={damagedBeveragesPage}
                            totalPages={damagedBeveragesTotalPages}
                            totalItems={safeRecentDamagedBeverages.length}
                            perPage={ROWS_PER_PAGE}
                            onPageChange={setDamagedBeveragesPage}
                        />
                    </div>
                )}
            </div>
        </AppSidebarLayout>
    );
}
