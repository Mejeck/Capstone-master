import React, { useState, useEffect, useRef } from 'react';
import { Droplets, CircleDollarSign, Package, TrendingUp, AlertTriangle, Users, Activity, BarChart3, ShoppingCart, Truck, Clock, CheckCircle, XCircle, Package as PackageIcon, FileText, Settings, Users as UsersIcon, BarChart3 as ReportsIcon, Plus, XCircle as XCircleIcon, Tag, Ruler, Layers, Check, Edit, Trash2, PlusCircle, Snowflake, Wine, X, RefreshCw } from 'lucide-react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirmModal } from '@/hooks/useConfirmModal';
import { Head, useForm, router } from '@inertiajs/react';
import { formatCurrency } from '@/constants/tax';

// PesoSign component drawn as a lucide-style outline icon so it matches the stroke weight
// of the other icons on this page instead of standing out as a bold filled glyph.
const PesoSign = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(({ className, ...props }, ref) => (
    <svg
        ref={ref}
        className={className}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <path d="M7 21V4h6a4 4 0 0 1 0 8H7" />
        <path d="M4 10h9" />
        <path d="M4 14h9" />
    </svg>
));
PesoSign.displayName = 'PesoSign';

interface Product {
    product_id: number;
    product_name: string;
    category: string;
    description: string | null;
    unit: string;
    price: number;
    price_per_case: number | null;
    price_per_bottle: number | null;
    current_quantity: number;
    min_stock_level: number;
    is_low_stock: boolean;
    recently_added?: boolean;
    total_sales?: number;
    sales_trend?: number[];
}

interface Category {
    category_id: number;
    category_name: string;
}

interface DashboardProps {
    stats: {
        totalProducts: number;
        totalStock: number;
        lowStockItems: number;
        recentTransactions: number;
        todayOrders: number;
        pendingDeliveries: number;
        recentDamagedBeverages: number;
    };
    // All-time takings (confirmed, non-voided sales) — the same figures the
    // POS screen shows in its Overall Sales banner.
    overallSales?: {
        total_sales: number;
        total_transactions: number;
        today_sales: number;
    };
    products: Product[];
    categories: Category[];
    recentStockLogs: Array<{
        id: number;
        product: { product_name: string };
        user: { full_name: string };
        transaction_type: string;
        quantity: number;
        created_at: string;
    }>;
    recentOrders: Array<{
        order_id: number;
        customer: { first_name: string; last_name: string };
        total_amount: number;
        status: string;
        order_date: string;
    }>;
    recentDamagedBeverages?: Array<{
        id: number;
        beverage_type: string;
        quantity: number;
        unit_type: string;
        report_date: string;
        reporter: { full_name: string } | null;
    }>;
    lowStockProducts: Array<{
        product: { product_name: string };
        current_quantity: number;
        min_stock_level: number;
    }>;
    categoryStats: Array<{
        category_name: string;
        total_stock: number;
        product_count: number;
    }>;
    stockTrends: Array<{
        date: string;
        stock_in: number;
        stock_out: number;
    }>;
    salesTrends: Array<{
        date: string;
        orders: number;
        revenue: number;
    }>;
    topProducts: Array<{
        product_name: string;
        total_sold: number;
        total_revenue: number;
    }>;
    deliveryStats: {
        pending: number;
        out_for_delivery: number;
        delivered: number;
        failed: number;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Admin Dashboard',
        href: '/admin/dashboard',
    },
];

export default function Dashboard({ stats, overallSales, products = [], categories = [], recentStockLogs, recentOrders, recentDamagedBeverages, lowStockProducts, categoryStats, stockTrends, salesTrends, topProducts, deliveryStats }: DashboardProps) {
    const [activeSection, setActiveSection] = useState<string>('dashboard');
    const [showAddStockModal, setShowAddStockModal] = useState(false);
    const [showCreateProductModal, setShowCreateProductModal] = useState(false);
    const [showEditProductModal, setShowEditProductModal] = useState(false);
    // Centered confirm() replacement, used for "archive this product?" below.
    const { confirm, confirmModalProps } = useConfirmModal();
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [showIceAddRow, setShowIceAddRow] = useState(false);
    const [showBeverageAddRow, setShowBeverageAddRow] = useState(false);
    const [showLowStockModal, setShowLowStockModal] = useState(false);
    const lowStockAlertShownRef = useRef(false);

    // Close the Stock Management / Edit Product / Create Product modals with the Escape key.
    useEffect(() => {
        if (!showAddStockModal && !showEditProductModal && !showCreateProductModal) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (showAddStockModal) {
                setShowAddStockModal(false);
                reset();
                setSelectedProduct(null);
            } else if (showEditProductModal) {
                setShowEditProductModal(false);
                editProductForm.reset();
                setSelectedProduct(null);
            } else if (showCreateProductModal) {
                setShowCreateProductModal(false);
                createProductForm.reset();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [showAddStockModal, showEditProductModal, showCreateProductModal]);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '') || 'dashboard';
            setActiveSection(hash);

            // Show the low stock alert once per visit to this page (resets on every fresh
            // login/page load), not on every hash navigation to Inventory — the same info
            // is already always visible via the status badges and stat card.
            if (
                hash === 'inventory' &&
                lowStockProducts &&
                lowStockProducts.length > 0 &&
                !lowStockAlertShownRef.current
            ) {
                setShowLowStockModal(true);
                lowStockAlertShownRef.current = true;
            }
        };

        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, [lowStockProducts]);

    const { data, setData, post, processing, reset } = useForm({
        product_id: '',
        quantity: '',
        transaction_type: 'STOCK_IN',
    });

    const createProductForm = useForm({
        product_name: '',
        category_id: '',
        description: '',
        unit: 'kg',
        price: '',
        initial_quantity: '',
        min_stock_level: '',
    });

    const iceTubeKiloPricing = [
        { kilo: 1, price: 10 },
        { kilo: 3, price: 28 },
        { kilo: 5, price: 40 },
        { kilo: 10, price: 90 },
        { kilo: 20, price: 160 },
        { kilo: 30, price: 210 },
        { kilo: 40, price: 230 },
        { kilo: 50, price: 250 },
    ];

    const iceInlineForm = useForm({
        product_name: 'Purified Ice Tube',
        category_id: '',
        description: '',
        unit: 'kg',
        price: '',
        initial_quantity: '',
        min_stock_level: '',
        kilo_amount: '',
    });

    const beverageInlineForm = useForm({
        product_name: '',
        category_id: '',
        description: '',
        unit: 'case',
        price: '',
        price_per_case: '',
        price_per_bottle: '',
        initial_quantity: '',
        min_stock_level: '',
    });

    const editProductForm = useForm({
        product_id: '',
        product_name: '',
        category_id: '',
        description: '',
        unit: '',
        price: '',
        min_stock_level: '',
    });

    const handleAddStock = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/inventory/add-stock', {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                window.location.hash = 'inventory';
                setShowAddStockModal(false);
                reset();
                setSelectedProduct(null);
            },
        });
    };

    const handleCreateProduct = (e: React.FormEvent) => {
        e.preventDefault();
        createProductForm.post('/admin/inventory/create-product', {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                window.location.hash = 'inventory';
                setShowCreateProductModal(false);
                createProductForm.reset();
            },
        });
    };

    // Ice tubes are produced in-house, not bought from a supplier — this just logs
    // the production output directly against inventory.
    const openAddStockModal = (product: Product) => {
        setSelectedProduct(product);
        setData('product_id', product.product_id.toString());
        setData('transaction_type', 'STOCK_IN');
        setShowAddStockModal(true);
    };

    // Beverages are bought from suppliers, so "ordering" them creates a Purchase Order
    // instead of touching inventory directly — stock only increases once it's received.
    const orderStockFromSupplier = (product: Product) => {
        router.visit(`/admin/purchase-orders?product_id=${product.product_id}`);
    };

    const handleUpdateMinStock = (productId: number, minStock: number) => {
        router.post('/admin/inventory/update-min-stock', {
            product_id: productId,
            min_stock_level: minStock,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleIceInlineAdd = (e: React.FormEvent) => {
        e.preventDefault();
        // Find the Ice Tubes category ID
        const iceTubesCategory = safeCategories.find(cat => cat.category_name === 'Ice Tubes');
        if (iceTubesCategory) {
            iceInlineForm.setData('category_id', iceTubesCategory.category_id.toString());
        }
        // Auto-fill price based on selected kilogram
        const selectedKilo = iceTubeKiloPricing.find(k => k.kilo.toString() === iceInlineForm.data.kilo_amount);
        if (selectedKilo) {
            iceInlineForm.setData('price', selectedKilo.price.toString());
            iceInlineForm.setData('product_name', `Purified Ice Tube ${selectedKilo.kilo}kg`);
        }
        // Remove kilo_amount before submitting
        iceInlineForm.setData('kilo_amount', '');
        iceInlineForm.post('/admin/inventory/create-product', {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                window.location.hash = 'inventory';
                setShowIceAddRow(false);
                iceInlineForm.reset();
            },
        });
    };

    const handleBeverageInlineAdd = (e: React.FormEvent) => {
        e.preventDefault();
        // Find the Beverages category ID and auto-set it
        const beveragesCategory = safeCategories.find(cat => cat.category_name === 'Beverages');
        if (beveragesCategory) {
            beverageInlineForm.setData('category_id', beveragesCategory.category_id.toString());
        }
        // Set price from price_per_case for the backend
        beverageInlineForm.setData('price', beverageInlineForm.data.price_per_case);
        beverageInlineForm.post('/admin/inventory/create-product', {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                window.location.hash = 'inventory';
                setShowBeverageAddRow(false);
                beverageInlineForm.reset();
            },
        });
    };

    const handleUpdateProduct = (e: React.FormEvent) => {
        e.preventDefault();
        // If editing an ice tube or beverage product, the category is locked in the UI —
        // re-apply it here since openEditModal leaves category_id blank for those products.
        if (selectedProduct && (selectedProduct.category === 'Ice Tubes' || selectedProduct.category === 'Beverages')) {
            const lockedCategory = safeCategories.find(cat => cat.category_name === selectedProduct.category);
            if (lockedCategory) {
                editProductForm.setData('category_id', lockedCategory.category_id.toString());
            }
        }
        editProductForm.post('/admin/inventory/update-product', {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                window.location.hash = 'inventory';
                setShowEditProductModal(false);
                editProductForm.reset();
                setSelectedProduct(null);
            },
        });
    };

    const openEditModal = (product: Product) => {
        setSelectedProduct(product);
        editProductForm.setData({
            product_id: product.product_id.toString(),
            product_name: product.product_name,
            category_id: '',
            description: product.description || '',
            unit: product.unit,
            price: product.price.toString(),
            min_stock_level: product.min_stock_level.toString(),
        });
        setShowEditProductModal(true);
    };

    const handleArchiveProduct = async (productId: number) => {
        if (await confirm('Are you sure you want to archive this product? This action can be undone.')) {
            router.post('/admin/inventory/archive-product', {
                product_id: productId,
            }, {
                preserveState: true,
                preserveScroll: true,
            });
        }
    };

    const safeProducts = Array.isArray(products) ? products : [];
    const safeCategories = Array.isArray(categories) ? categories : [];

    // Auto-set Beverages category when inline add row is shown
    useEffect(() => {
        if (showBeverageAddRow) {
            const beveragesCategory = safeCategories.find(cat => cat.category_name === 'Beverages');
            if (beveragesCategory && !beverageInlineForm.data.category_id) {
                beverageInlineForm.setData('category_id', beveragesCategory.category_id.toString());
            }
        }
    }, [showBeverageAddRow, safeCategories]);

    // Filter products into ice tubes and beverages based on category
    const iceProducts = safeProducts.filter(product => product.category === 'Ice Tubes');
    const beverageProducts = safeProducts.filter(product => product.category === 'Beverages');

    const formatNumber = (value: number | string | null | undefined, decimals: number = 2): string => {
        if (value === null || value === undefined) return '0';
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(num)) return '0';
        return num.toFixed(decimals);
    };

    // KPI stat cards shown at the top of the dashboard. Every card keeps its own real color —
    // no washed-out grays — but the palette is curated (one hue per metric, no repeats within
    // a tier) so it reads as designed instead of a random rainbow. "red" is a deep, muted red
    // (red-700, not the more vivid red-600/red-500) — strong enough to read as an alert next to
    // the calmer info cards, without being a glaring, bright block.
    const statColors: Record<string, { badge: string; icon: string; accent: string }> = {
        cyan: { badge: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400', icon: 'text-cyan-600 dark:text-cyan-400', accent: 'border-l-cyan-500' },
        blue: { badge: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', icon: 'text-blue-600 dark:text-blue-400', accent: 'border-l-blue-500' },
        violet: { badge: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400', icon: 'text-violet-600 dark:text-violet-400', accent: 'border-l-violet-500' },
        teal: { badge: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400', icon: 'text-teal-600 dark:text-teal-400', accent: 'border-l-teal-500' },
        indigo: { badge: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400', icon: 'text-indigo-600 dark:text-indigo-400', accent: 'border-l-indigo-500' },
        green: { badge: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400', icon: 'text-green-600 dark:text-green-400', accent: 'border-l-green-500' },
        red: { badge: 'bg-red-700 text-white dark:bg-red-800 dark:text-red-100', icon: 'text-red-700 dark:text-red-400', accent: 'border-l-red-700' },
    };

    // Each card navigates to the existing page that has its full detail, so clicking one
    // never duplicates data or UI we'd have to build fresh.
    const goToInventory = () => { window.location.hash = 'inventory'; };
    type StatCard = { label: string; value: string | number; sub: string; icon: React.ElementType; color: keyof typeof statColors; onClick: () => void };

    // Primary tier: the "state of the business" numbers that matter regardless of the day.
    const primaryCards: StatCard[] = [
        { label: 'Total Products', value: stats.totalProducts, sub: 'Products available', icon: Package, color: 'cyan', onClick: goToInventory },
        { label: 'Total Stock', value: Number(stats.totalStock || 0).toFixed(0), sub: 'Total inventory', icon: Droplets, color: 'blue', onClick: goToInventory },
        { label: 'Low Stock', value: stats.lowStockItems, sub: stats.lowStockItems > 0 ? 'Needs restocking' : 'All good', icon: AlertTriangle, color: 'red', onClick: goToInventory },
        { label: 'Pending Deliveries', value: stats.pendingDeliveries, sub: 'Awaiting pickup', icon: Truck, color: 'violet', onClick: () => router.visit('/admin/pre-orders') },
    ];

    // Secondary tier: today-only activity counters. Still fully colored — the smaller card
    // size (not duller color) is what marks these as lighter weight than the primary tier.
    const secondaryCards: StatCard[] = [
        { label: "Today's Activity", value: stats.recentTransactions, sub: 'Stock transactions', icon: TrendingUp, color: 'teal', onClick: () => router.visit('/admin/transactions') },
        { label: "Today's Orders", value: stats.todayOrders, sub: 'New orders', icon: ShoppingCart, color: 'indigo', onClick: () => router.visit('/admin/pre-orders') },
        { label: 'Damaged Beverages', value: stats.recentDamagedBeverages, sub: stats.recentDamagedBeverages > 0 ? "Today's reports" : 'None reported', icon: Wine, color: stats.recentDamagedBeverages > 0 ? 'red' : 'green', onClick: () => router.visit('/admin/broken-bottles') },
    ];

    const hasLowStock = !!(lowStockProducts && lowStockProducts.length > 0);

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <div className="px-4 sm:px-6 lg:px-8 py-6">
            <Head title={`Mejeck IcePlant ${activeSection === 'dashboard' ? 'Dashboard' : activeSection === 'inventory' ? 'Inventory' : 'Settings'}`} />
            {/* Page Title (logo already shown in sidebar) */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {activeSection === 'dashboard' && 'Dashboard'}
                    {activeSection === 'inventory' && 'Inventory'}
                    {activeSection === 'settings' && 'Settings'}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                    {activeSection === 'dashboard' && 'Beverage & Ice Tube Management System'}
                    {activeSection === 'inventory' && 'Product Inventory Management'}
                    {activeSection === 'settings' && 'System Configuration'}
                </p>
            </div>

            {/* Dashboard Section */}
            {activeSection === 'dashboard' && (
                <div>
            {/* Overall Sales — the first thing an admin should see on opening the
                Dashboard, so the running total doesn't require a trip to POS Sales
                History. Same figures and treatment as the POS screen's banner. */}
            <button
                type="button"
                onClick={() => router.visit('/admin/pos/history')}
                className="mb-3 flex w-full flex-col gap-4 rounded-2xl border-2 border-cyan-700/50 bg-gradient-to-br from-cyan-600 to-cyan-800 p-5 text-left text-white shadow-lg transition-shadow hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-cyan-800 dark:from-cyan-700 dark:to-cyan-950"
            >
                <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-cyan-100">
                        <CircleDollarSign className="w-4 h-4" /> Overall Sales
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums sm:text-4xl">
                        {formatCurrency(overallSales?.total_sales ?? 0)}
                    </p>
                </div>
                <div className="flex items-center gap-6 sm:gap-8">
                    <div className="sm:text-right">
                        <p className="text-xs font-medium text-cyan-100 sm:text-sm">Today</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
                            {formatCurrency(overallSales?.today_sales ?? 0)}
                        </p>
                    </div>
                    <div className="h-10 w-px bg-white/25" aria-hidden="true" />
                    <div className="sm:text-right">
                        <p className="text-xs font-medium text-cyan-100 sm:text-sm">Transactions</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
                            {(overallSales?.total_transactions ?? 0).toLocaleString()}
                        </p>
                    </div>
                </div>
            </button>

            {/* Stats Cards — primary tier: the state-of-the-business numbers */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                {primaryCards.map((card) => {
                    const colors = statColors[card.color];
                    const Icon = card.icon;
                    return (
                        <button
                            key={card.label}
                            type="button"
                            onClick={card.onClick}
                            className={`w-full text-left bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-200/50 dark:border-slate-700/50 border-l-4 ${colors.accent} p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400`}
                        >
                            <div className="flex items-center gap-2.5">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors.badge}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-none tabular-nums">{card.value}</div>
                            </div>
                            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-2">{card.label}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500">{card.sub}</div>
                        </button>
                    );
                })}
            </div>

            {/* Stats Cards — secondary tier: today-only activity, deliberately lighter weight */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                {secondaryCards.map((card) => {
                    const colors = statColors[card.color];
                    const Icon = card.icon;
                    return (
                        <button
                            key={card.label}
                            type="button"
                            onClick={card.onClick}
                            className={`w-full text-left bg-white/90 dark:bg-slate-800/90 rounded-lg border border-slate-200/50 dark:border-slate-700/50 border-l-4 ${colors.accent} px-3 py-2.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400`}
                        >
                            <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${colors.badge}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums">{card.value}</span>
                                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{card.label}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{card.sub}</div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* When there's nothing low on stock, this row collapses to a single compact banner
                instead of a half-empty two-thirds-width card, and Delivery Status — which actually
                has content — gets the full row instead of being squeezed into one-third. */}
            <div className={hasLowStock ? 'grid grid-cols-1 lg:grid-cols-3 items-start gap-6' : 'space-y-4'}>
                {/* Low Stock Alerts */}
                {hasLowStock ? (
                <div className="lg:col-span-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-300 dark:border-slate-600 p-5 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Low Stock Alerts</h2>
                                <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">{lowStockProducts?.length || 0} items</div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {/* Beverages Low Stock Warning */}
                        {lowStockProducts && lowStockProducts.some(item => item.product?.product_name?.toLowerCase().includes('beer') || item.product?.product_name?.toLowerCase().includes('san mig')) && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-500 dark:border-red-400">
                                <div className="flex items-center gap-3 mb-3">
                                    <Wine className="w-5 h-5 text-red-600 dark:text-red-400" />
                                    <h3 className="font-semibold text-red-900 dark:text-red-100">Beverages Low Stock Alert</h3>
                                </div>
                                <div className="space-y-2">
                                    {lowStockProducts.filter(item => item.product?.product_name?.toLowerCase().includes('beer') || item.product?.product_name?.toLowerCase().includes('san mig')).map((item) => (
                                        <div key={`beverage-${item.product?.product_name}`} className="flex items-center justify-between text-sm">
                                            <span className="text-slate-700 dark:text-slate-300">{item.product?.product_name}</span>
                                            <span className="font-bold text-red-600 dark:text-red-400">Current: {Math.floor(item.current_quantity)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Ice Tubes Low Stock Warning */}
                        {lowStockProducts && lowStockProducts.some(item => item.product?.product_name?.toLowerCase().includes('ice tube')) && (
                            <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border-2 border-cyan-500 dark:border-cyan-400">
                                <div className="flex items-center gap-3 mb-3">
                                    <Snowflake className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                                    <h3 className="font-semibold text-cyan-900 dark:text-cyan-100">Ice Tubes Low Stock Alert</h3>
                                </div>
                                <div className="space-y-2">
                                    {lowStockProducts.filter(item => item.product?.product_name?.toLowerCase().includes('ice tube')).map((item) => (
                                        <div key={`ice-tube-${item.product?.product_name}`} className="flex items-center justify-between text-sm">
                                            <span className="text-slate-700 dark:text-slate-300">{item.product?.product_name}</span>
                                            <span className="font-bold text-cyan-600 dark:text-cyan-400">Current: {item.current_quantity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Other Low Stock Items */}
                        {lowStockProducts && lowStockProducts.filter(item =>
                            !item.product?.product_name?.toLowerCase().includes('beer') &&
                            !item.product?.product_name?.toLowerCase().includes('san mig') &&
                            !item.product?.product_name?.toLowerCase().includes('ice tube')
                        ).length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">Other Low Stock Items</h4>
                                {lowStockProducts.filter(item =>
                                    !item.product?.product_name?.toLowerCase().includes('beer') &&
                                    !item.product?.product_name?.toLowerCase().includes('san mig') &&
                                    !item.product?.product_name?.toLowerCase().includes('ice tube')
                                ).map((item) => (
                                    <div key={`other-low-${item.product?.product_name}`} className="p-3 bg-orange-50/50 dark:bg-orange-900/20 rounded-lg border border-orange-200/30 dark:border-orange-700/30">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="font-medium text-slate-800 dark:text-slate-100">{item.product?.product_name || 'Unknown Product'}</div>
                                                <div className="text-sm text-slate-600 dark:text-slate-300">
                                                    Current: {Math.floor(item.current_quantity)} | Min: {Math.floor(item.min_stock_level)}
                                                </div>
                                            </div>
                                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                ) : (
                <div className="flex items-center gap-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-300 dark:border-slate-600 px-5 py-3.5 shadow-sm">
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    <span className="text-sm text-slate-600 dark:text-slate-300">All stocked up — nothing is running low right now.</span>
                </div>
                )}

                {/* Delivery Status */}
                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-300 dark:border-slate-600 p-5 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                                <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Delivery Status</h2>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Overview</div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-amber-50/50 dark:bg-amber-900/20 rounded-lg border border-amber-200/30 dark:border-amber-700/30">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                <span className="font-medium text-slate-800 dark:text-slate-100">Pending</span>
                            </div>
                            <span className="font-bold text-amber-600 dark:text-amber-400">{deliveryStats.pending}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-200/30 dark:border-blue-700/30">
                            <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span className="font-medium text-slate-800 dark:text-slate-100">Out for Delivery</span>
                            </div>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{deliveryStats.out_for_delivery}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-green-50/50 dark:bg-green-900/20 rounded-lg border border-green-200/30 dark:border-green-700/30">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                <span className="font-medium text-slate-800 dark:text-slate-100">Delivered</span>
                            </div>
                            <span className="font-bold text-green-600 dark:text-green-400">{deliveryStats.delivered}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-red-50/50 dark:bg-red-900/20 rounded-lg border border-red-200/30 dark:border-red-700/30">
                            <div className="flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                <span className="font-medium text-slate-800 dark:text-slate-100">Failed</span>
                            </div>
                            <span className="font-bold text-red-600 dark:text-red-400">{deliveryStats.failed}</span>
                        </div>
                    </div>
                </div>
            </div>

                </div>
            )}

            {/* Inventory Section */}
            {activeSection === 'inventory' && (
                <div>
                    <div className="relative z-10">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 border-l-cyan-500 p-4 shadow-sm">
                            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{safeProducts.length}</div>
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Total Products</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => document.getElementById('ice-tubes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="w-full text-left bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 border-l-blue-500 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{iceProducts.length}</div>
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Ice Tubes</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => document.getElementById('beverages-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="w-full text-left bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 border-l-amber-500 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{beverageProducts.length}</div>
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Beverages</div>
                        </button>
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 border-l-purple-500 p-4 shadow-sm">
                            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{safeCategories.length}</div>
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Categories</div>
                        </div>
                    </div>

                    {/* Ice Tubes Section */}
                    <div id="ice-tubes-section" className="mb-8 bg-white dark:bg-slate-800 rounded-xl border border-blue-300 dark:border-blue-800 shadow-md p-6 relative overflow-hidden scroll-mt-6">
                        {/* Background Image with Blur */}
                        {/* <div className="absolute inset-0 opacity-50 pointer-events-none">
                            <div className="absolute inset-0 bg-cover bg-center blur-sm" style={{ backgroundImage: "url('/images/icetube.jpg')" }}></div>
                        </div> */}
                        <div className="relative z-10">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                                <h2 className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                    <Package className="w-5 h-5 sm:w-6 sm:h-6" />
                                    Ice Tubes
                                </h2>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => setShowIceAddRow(!showIceAddRow)}
                                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm sm:text-base w-full sm:w-auto"
                                    >
                                        {showIceAddRow ? <X size={18} className="sm:w-5 sm:h-5" /> : <Plus size={18} className="sm:w-5 sm:h-5" />}
                                        {showIceAddRow ? 'Cancel' : 'Add Ice Tube'}
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-700/50 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500">
                                        <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '25%'}}>Product</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '12%'}}>Category</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '8%'}}>Unit</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '12%'}}>Price</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '12%'}}>Quantity</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '12%'}}>Min Stock</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '10%'}}>Status</th>
                                        <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '19%'}}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-blue-100 dark:divide-blue-900">
                                    {showIceAddRow && (
                                        <tr className="bg-blue-50 dark:bg-blue-900/30">
                                            <td colSpan={8} className="p-0">
                                                <form onSubmit={handleIceInlineAdd}>
                                                    <table className="w-full">
                                                        <tbody>
                                                            <tr>
                                                                <td className="px-4 py-3 whitespace-nowrap">
                                                                    <select
                                                                        value={iceInlineForm.data.kilo_amount}
                                                                        onChange={(e) => {
                                                                            iceInlineForm.setData('kilo_amount', e.target.value);
                                                                            const selectedKilo = iceTubeKiloPricing.find(k => k.kilo.toString() === e.target.value);
                                                                            if (selectedKilo) {
                                                                                iceInlineForm.setData('price', selectedKilo.price.toString());
                                                                            }
                                                                        }}
                                                                        className="w-full px-2 py-1.5 border border-blue-300 dark:border-blue-700 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400"
                                                                        required
                                                                    >
                                                                        <option value="">Select Kilo</option>
                                                                        {iceTubeKiloPricing.map(k => (
                                                                            <option key={k.kilo} value={k.kilo.toString()}>
                                                                                {k.kilo}kg - ₱{k.price}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Ice Tubes</span>
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">kg</span>
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="Price"
                                                                        value={iceInlineForm.data.price}
                                                                        onChange={(e) => iceInlineForm.setData('price', e.target.value)}
                                                                        className="w-full px-2 py-1.5 border border-blue-300 dark:border-blue-700 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400"
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="Qty"
                                                                        value={iceInlineForm.data.initial_quantity}
                                                                        onChange={(e) => iceInlineForm.setData('initial_quantity', e.target.value)}
                                                                        className="w-full px-2 py-1.5 border border-blue-300 dark:border-blue-700 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400"
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="Min Stock"
                                                                        value={iceInlineForm.data.min_stock_level}
                                                                        onChange={(e) => iceInlineForm.setData('min_stock_level', e.target.value)}
                                                                        className="w-full px-2 py-1.5 border border-blue-300 dark:border-blue-700 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400"
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                                                        New
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">
                                                                    <button
                                                                        type="submit"
                                                                        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 mr-1 transition text-xs"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setShowIceAddRow(false);
                                                                            iceInlineForm.reset();
                                                                        }}
                                                                        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-xs"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </form>
                                            </td>
                                        </tr>
                                    )}
                                    {iceProducts.length === 0 && !showIceAddRow && (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center">
                                                <Package className="mx-auto h-12 w-12 text-blue-400" />
                                                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No ice tubes yet</h3>
                                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Click "Add Ice Tube" to get started.</p>
                                            </td>
                                        </tr>
                                    )}
                                    {/* Mobile card view - hidden on sm and up */}
                                    <tr className="sm:hidden">
                                        <td colSpan={8} className="p-0">
                                            <div className="space-y-3">
                                                {iceProducts.map((product) => (
                                                    <div key={product.product_id} className="bg-white dark:bg-slate-700 rounded-lg border border-blue-200 dark:border-blue-800 p-3 shadow-sm">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="font-bold text-sm text-gray-900 dark:text-white">{product.product_name}</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                                            <div className="text-gray-700 dark:text-gray-300">
                                                                {product.category}
                                                            </div>
                                                            <div className="text-gray-700 dark:text-gray-300">
                                                                {product.unit}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-bold text-blue-600 dark:text-blue-400">{formatNumber(product.price)}</span>
                                                            </div>
                                                            <div className="text-gray-700 dark:text-gray-300">
                                                                {formatNumber(product.current_quantity, 0)}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            {product.is_low_stock ? (
                                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                                                                    Low Stock
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                                                    In Stock
                                                                </span>
                                                            )}
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={() => openAddStockModal(product)}
                                                                    className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                                                    title="Manage Stock"
                                                                >
                                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => openEditModal(product)}
                                                                    className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition"
                                                                    title="Edit"
                                                                >
                                                                    <Edit className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleArchiveProduct(product.product_id)}
                                                                    className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition"
                                                                    title="Archive"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Desktop table rows - hidden on mobile */}
                                    {iceProducts.map((product) => (
                                        <tr key={product.product_id} className="hover:bg-blue-50 dark:hover:bg-blue-900/30 transition hidden sm:table-row">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{product.product_name}</div>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                {product.category}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                {product.unit}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                <span className="font-bold text-blue-600 dark:text-blue-400">{formatNumber(product.price)}</span>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                {formatNumber(product.current_quantity, 0)}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                {formatNumber(product.min_stock_level, 0)}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                {product.is_low_stock ? (
                                                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                                                        Low Stock
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                                        In Stock
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">
                                                <div className="flex flex-col sm:flex-row gap-1">
                                                    <button
                                                        onClick={() => openAddStockModal(product)}
                                                        className="flex items-center justify-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition text-xs"
                                                    >
                                                        <RefreshCw className="w-3 h-3" />
                                                        <span className="hidden sm:inline">Manage Stock</span>
                                                        <span className="sm:hidden">Manage</span>
                                                    </button>
                                                    <button
                                                        onClick={() => openEditModal(product)}
                                                        className="flex items-center justify-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition text-xs"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleArchiveProduct(product.product_id)}
                                                        className="flex items-center justify-center gap-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-xs"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        <span className="hidden sm:inline">Archive</span>
                                                        <span className="sm:hidden">Del</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        </div>
                    </div>

                    {/* Beverages Section */}
                    <div id="beverages-section" className="mb-8 bg-white dark:bg-slate-800 rounded-xl border border-amber-300 dark:border-amber-800 shadow-md p-6 relative overflow-hidden scroll-mt-6">
                        {/* Background Image with Blur */}
                        {/* <div className="absolute inset-0 opacity-50 pointer-events-none">
                            <div className="absolute inset-0 bg-cover bg-center blur-sm" style={{ backgroundImage: "url('/images/redhorse.jpg')" }}></div>
                        </div> */}
                        <div className="relative z-10">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                                <h2 className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                                    <Wine className="w-5 h-5 sm:w-6 sm:h-6" />
                                    Beverages
                                </h2>
                                <button
                                    onClick={() => setShowBeverageAddRow(!showBeverageAddRow)}
                                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm sm:text-base w-full sm:w-auto"
                                >
                                    {showBeverageAddRow ? <X size={18} className="sm:w-5 sm:h-5" /> : <Plus size={18} className="sm:w-5 sm:h-5" />}
                                    {showBeverageAddRow ? 'Cancel' : 'Add Beverage'}
                                </button>
                            </div>
                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-700/50 text-amber-700 dark:text-amber-300 border-b-2 border-amber-500">
                                        <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '20%'}}>Product</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '10%'}}>Category</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '7%'}}>Unit</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '12%'}}>Price/Case</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '12%'}}>Price/Bottle</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '10%'}}>Quantity</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '10%'}}>Min Stock</th>
                                        <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '9%'}}>Status</th>
                                        <th className="px-4 py-3 text-left text-sm font-bold uppercase tracking-wider" style={{width: '20%'}}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-amber-100 dark:divide-amber-900">
                                    {showBeverageAddRow && (
                                        <tr className="bg-amber-50 dark:bg-amber-900/30">
                                            <td colSpan={9} className="p-0">
                                                <form onSubmit={handleBeverageInlineAdd}>
                                                    <table className="w-full">
                                                        <tbody>
                                                            <tr>
                                                                <td className="px-4 py-3 whitespace-nowrap">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Product Name"
                                                                        value={beverageInlineForm.data.product_name}
                                                                        onChange={(e) => beverageInlineForm.setData('product_name', e.target.value)}
                                                                        className="w-full px-2 py-1.5 border border-amber-300 dark:border-amber-700 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:border-amber-400"
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Beverages</span>
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <input
                                                                        type="text"
                                                                        value={beverageInlineForm.data.unit}
                                                                        onChange={(e) => beverageInlineForm.setData('unit', e.target.value)}
                                                                        className="w-full px-2 py-1.5 border border-amber-300 dark:border-amber-700 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:border-amber-400"
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="Price/Case"
                                                                        value={beverageInlineForm.data.price_per_case}
                                                                        onChange={(e) => beverageInlineForm.setData('price_per_case', e.target.value)}
                                                                        className="w-full px-2 py-1.5 border border-amber-300 dark:border-amber-700 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:border-amber-400"
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="Price/Bottle"
                                                                        value={beverageInlineForm.data.price_per_bottle}
                                                                        onChange={(e) => beverageInlineForm.setData('price_per_bottle', e.target.value)}
                                                                        className="w-full px-2 py-1.5 border border-amber-300 dark:border-amber-700 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:border-amber-400"
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="Qty"
                                                                        value={beverageInlineForm.data.initial_quantity}
                                                                        onChange={(e) => beverageInlineForm.setData('initial_quantity', e.target.value)}
                                                                        className="w-full px-2 py-1.5 border border-amber-300 dark:border-amber-700 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:border-amber-400"
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="Min Stock"
                                                                        value={beverageInlineForm.data.min_stock_level}
                                                                        onChange={(e) => beverageInlineForm.setData('min_stock_level', e.target.value)}
                                                                        className="w-full px-2 py-1.5 border border-amber-300 dark:border-amber-700 rounded text-xs text-gray-900 dark:text-white bg-white dark:bg-slate-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:border-amber-400"
                                                                        required
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap">
                                                                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                                                                        New
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">
                                                                    <button
                                                                        type="submit"
                                                                        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 mr-1 transition text-xs"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setShowBeverageAddRow(false);
                                                                            beverageInlineForm.reset();
                                                                        }}
                                                                        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-xs"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </form>
                                            </td>
                                        </tr>
                                    )}
                                    {beverageProducts.length === 0 && !showBeverageAddRow && (
                                        <tr>
                                            <td colSpan={9} className="px-6 py-12 text-center">
                                                <Settings className="mx-auto h-12 w-12 text-amber-400" />
                                                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No beverages yet</h3>
                                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Click "Add Beverage" to get started.</p>
                                            </td>
                                        </tr>
                                    )}
                                    {/* Mobile card view - hidden on sm and up */}
                                    <tr className="sm:hidden">
                                        <td colSpan={9} className="p-0">
                                            <div className="space-y-3">
                                                {beverageProducts.map((product) => (
                                                    <div key={product.product_id} className="bg-white dark:bg-slate-700 rounded-lg border border-amber-200 dark:border-amber-800 p-3 shadow-sm">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="font-bold text-sm text-gray-900 dark:text-white">{product.product_name}</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                                            <div className="text-gray-700 dark:text-gray-300">
                                                                {product.category}
                                                            </div>
                                                            <div className="text-gray-700 dark:text-gray-300">
                                                                {product.unit}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-bold text-amber-600 dark:text-amber-400">{formatNumber(product.price)}</span>
                                                            </div>
                                                            <div className="text-gray-700 dark:text-gray-300">
                                                                {formatNumber(product.current_quantity, 0)}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            {product.is_low_stock ? (
                                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                                                                    Low Stock
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                                                    In Stock
                                                                </span>
                                                            )}
                                                            <div className="flex gap-1">
                                                                <button
                                                                    onClick={() => orderStockFromSupplier(product)}
                                                                    className="p-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition"
                                                                    title="Order Stock"
                                                                >
                                                                    <PlusCircle className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => openEditModal(product)}
                                                                    className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition"
                                                                    title="Edit"
                                                                >
                                                                    <Edit className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleArchiveProduct(product.product_id)}
                                                                    className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition"
                                                                    title="Archive"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Desktop table rows - hidden on mobile */}
                                    {beverageProducts.map((product) => (
                                        <tr key={product.product_id} className="hover:bg-amber-50 dark:hover:bg-amber-900/30 transition hidden sm:table-row">
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{product.product_name}</div>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                {product.category}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                {product.unit}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                <span className="font-bold text-amber-600 dark:text-amber-400">{formatNumber(product.price_per_case)}/case</span>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                <span className="font-bold text-amber-600 dark:text-amber-400">{formatNumber(product.price_per_bottle)}/bottle</span>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                {formatNumber(product.current_quantity, 0)}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                                {formatNumber(product.min_stock_level, 0)}
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                {product.is_low_stock ? (
                                                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                                                        Low Stock
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                                        In Stock
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">
                                                <div className="flex flex-col sm:flex-row gap-1">
                                                    <button
                                                        onClick={() => orderStockFromSupplier(product)}
                                                        className="flex items-center justify-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50 transition text-xs"
                                                    >
                                                        <PlusCircle className="w-3 h-3" />
                                                        <span className="hidden sm:inline">Order Stock</span>
                                                        <span className="sm:hidden">+Order</span>
                                                    </button>
                                                    <button
                                                        onClick={() => openEditModal(product)}
                                                        className="flex items-center justify-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition text-xs"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleArchiveProduct(product.product_id)}
                                                        className="flex items-center justify-center gap-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-xs"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        <span className="hidden sm:inline">Archive</span>
                                                        <span className="sm:hidden">Del</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        </div>
                    </div>
                    </div>
                </div>
            )}

            {/* Modals - always available regardless of section */}
            {showAddStockModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md relative overflow-hidden">
                        <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Stock Management - {selectedProduct.product_name}</h2>
                            <button
                                onClick={() => {
                                    setShowAddStockModal(false);
                                    reset();
                                    setSelectedProduct(null);
                                }}
                                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                                title="Close"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddStock}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Transaction Type
                                </label>
                                <select
                                    value={data.transaction_type}
                                    onChange={(e) => setData('transaction_type', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                >
                                    <option value="STOCK_IN">Stock In</option>
                                    <option value="STOCK_OUT">Stock Out</option>
                                    <option value="RETURN">Return</option>
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Quantity
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.quantity}
                                    onChange={(e) => setData('quantity', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddStockModal(false);
                                        reset();
                                        setSelectedProduct(null);
                                    }}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                                >
                                    {processing ? 'Processing...' : 'Submit'}
                                </button>
                            </div>
                        </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Product Modal */}
            {showCreateProductModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto relative overflow-hidden">
                        <div className="relative z-10">
                        <button
                            onClick={() => {
                                setShowCreateProductModal(false);
                                createProductForm.reset();
                            }}
                            className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                            title="Close"
                        >
                            <XCircle size={24} />
                        </button>
                        <h2 className="text-xl font-bold mb-4 pr-8 text-gray-900 dark:text-white">Create New Product</h2>
                        <form onSubmit={handleCreateProduct}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Product Name
                                </label>
                                <input
                                    type="text"
                                    value={createProductForm.data.product_name}
                                    onChange={(e) => createProductForm.setData('product_name', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Category
                                </label>
                                <select
                                    value={createProductForm.data.category_id}
                                    onChange={(e) => createProductForm.setData('category_id', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    required
                                >
                                    <option value="">Select Category</option>
                                    {safeCategories.map((category) => (
                                        <option key={category.category_id} value={category.category_id}>
                                            {category.category_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={createProductForm.data.description}
                                    onChange={(e) => createProductForm.setData('description', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    rows={3}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Unit
                                </label>
                                <input
                                    type="text"
                                    value={createProductForm.data.unit}
                                    onChange={(e) => createProductForm.setData('unit', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Price
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={createProductForm.data.price}
                                    onChange={(e) => createProductForm.setData('price', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Initial Quantity
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={createProductForm.data.initial_quantity}
                                    onChange={(e) => createProductForm.setData('initial_quantity', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Minimum Stock Level
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={createProductForm.data.min_stock_level}
                                    onChange={(e) => createProductForm.setData('min_stock_level', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateProductModal(false);
                                        createProductForm.reset();
                                    }}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createProductForm.processing}
                                    className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                                >
                                    {createProductForm.processing ? 'Processing...' : 'Create Product'}
                                </button>
                            </div>
                        </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Product Modal */}
            {showEditProductModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto relative overflow-hidden">
                        <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Product - {selectedProduct.product_name}</h2>
                            <button
                                onClick={() => {
                                    setShowEditProductModal(false);
                                    editProductForm.reset();
                                    setSelectedProduct(null);
                                }}
                                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                                title="Close"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateProduct}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Product Name
                                </label>
                                <input
                                    type="text"
                                    value={editProductForm.data.product_name}
                                    onChange={(e) => editProductForm.setData('product_name', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Category
                                </label>
                                {selectedProduct.category === 'Ice Tubes' || selectedProduct.category === 'Beverages' ? (
                                    <span className="block px-3 py-2 text-gray-900 dark:text-white font-medium">{selectedProduct.category}</span>
                                ) : (
                                    <select
                                        value={editProductForm.data.category_id}
                                        onChange={(e) => editProductForm.setData('category_id', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                        required
                                    >
                                        <option value="">Select Category</option>
                                        {safeCategories.map((category) => (
                                            <option key={category.category_id} value={category.category_id}>
                                                {category.category_name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={editProductForm.data.description}
                                    onChange={(e) => editProductForm.setData('description', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    rows={3}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Unit
                                </label>
                                <input
                                    type="text"
                                    value={editProductForm.data.unit}
                                    onChange={(e) => editProductForm.setData('unit', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Price
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editProductForm.data.price}
                                    onChange={(e) => editProductForm.setData('price', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Minimum Stock Level
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editProductForm.data.min_stock_level}
                                    onChange={(e) => editProductForm.setData('min_stock_level', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditProductModal(false);
                                        editProductForm.reset();
                                        setSelectedProduct(null);
                                    }}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={editProductForm.processing}
                                    className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                                >
                                    {editProductForm.processing ? 'Processing...' : 'Update Product'}
                                </button>
                            </div>
                        </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Section */}
            {activeSection === 'settings' && (
                <div className="mt-6 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-200/50 dark:border-slate-700/50 p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900/30 rounded-lg flex items-center justify-center">
                            <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Settings</h2>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Application settings</div>
                        </div>
                    </div>
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        Settings panel coming soon...
                    </div>
                </div>
            )}

            {/* Low Stock Alert Notification — centered with a backdrop like the other modals
                on this page (Add Stock, Edit Product, etc.), instead of being the one popup
                pinned to the top of the screen. */}
            {showLowStockModal && lowStockProducts && lowStockProducts.length > 0 && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-orange-200 dark:border-orange-700 p-4 max-w-md w-full">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                                    Low Stock Alert
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                                    The following products are running low on stock. Please consider adding more stock soon.
                                </p>
                                <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-1">
                                    {lowStockProducts.map((item) => (
                                        <div key={item.product?.product_name} className="flex items-center justify-between text-sm gap-3">
                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                                {item.product?.product_name || 'Unknown Product'}
                                            </span>
                                            <span className="text-orange-600 dark:text-orange-400 font-medium shrink-0">
                                                {Math.floor(item.current_quantity)} / {Math.floor(item.min_stock_level)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setShowLowStockModal(false)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                                >
                                    Okay
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>

            <ConfirmModal {...confirmModalProps} />
        </AppSidebarLayout>
    );
}
