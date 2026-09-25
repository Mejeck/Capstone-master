<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Inventory;
use App\Models\StockLog;
use App\Models\Category;
use App\Models\Order;
use App\Models\Sale;
use App\Models\Delivery;
use App\Models\BrokenBottle;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;

class DashboardController extends Controller
{
    // Backs the sidebar header's low-stock bell — same query as the
    // Dashboard's own Low Stock Alerts section, but standalone so it can be
    // polled from any admin page instead of only being available on a full
    // Dashboard visit.
    public function getLowStockProducts()
    {
        $lowStockProducts = Inventory::with('product')
            ->where('current_quantity', '<=', DB::raw('min_stock_level'))
            ->orderBy('current_quantity', 'asc')
            ->get()
            ->map(fn ($inventory) => [
                'product_id' => $inventory->product_id,
                'product_name' => $inventory->product->product_name ?? 'Unknown product',
                'current_quantity' => $inventory->current_quantity,
                'min_stock_level' => $inventory->min_stock_level,
            ]);

        return response()->json($lowStockProducts);
    }

    public function index(Request $request): Response|RedirectResponse
    {
        // Check if user is admin or super admin
        if (!in_array(Auth::user()->role, ['Admin', 'SuperAdmin'])) {
            return redirect()->route('home')->with('error', 'Access denied. Admins only.');
        }

        // Get inventory statistics
        $totalProducts = Product::where('is_active', true)->count();
        $totalStock = Inventory::sum('current_quantity');
        $lowStockItems = Inventory::where('current_quantity', '<=', DB::raw('min_stock_level'))->count();
        
        // Get business metrics
        $todayOrders = Order::whereDate('order_date', today())->count();
        $pendingDeliveries = Delivery::where('delivery_status', 'Pending')->count();
        
        // Get recent stock movements
        $recentStockLogs = StockLog::with(['product', 'user'])
            ->orderBy('created_at', 'desc')
            ->take(5)
            ->get();
        
        // Get recent damaged beverages
        $recentDamagedBeverages = BrokenBottle::with('reporter')
            ->orderBy('report_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->take(5)
            ->get();
        
        // Get recent orders
        $recentOrders = Order::with(['customer'])
            ->orderBy('order_date', 'desc')
            ->take(5)
            ->get();
        
        // Get low stock products
        $lowStockProducts = Inventory::with(['product'])
            ->where('current_quantity', '<=', DB::raw('min_stock_level'))
            ->orderBy('current_quantity', 'asc')
            ->take(5)
            ->get();
        
        // Get top products by stock for dashboard display
        $categoryStats = DB::table('inventory as i')
            ->join('products as p', 'i.product_id', '=', 'p.product_id')
            ->select('p.product_name as category_name', DB::raw('SUM(i.current_quantity) as total_stock'), DB::raw('COUNT(p.product_id) as product_count'))
            ->where('p.is_active', true)
            ->whereIn('p.product_name', ['San Mig Apple', 'San Mig Light', 'Redhorse Beer', 'San Mig Pilsen', 'Purified Ice Tube'])
            ->groupBy('p.product_id', 'p.product_name')
            ->orderBy('total_stock', 'desc')
            ->get();
        
        // Get stock movement trends (last 7 days)
        $stockTrends = DB::table('stock_logs')
            ->select(
                DB::raw('DATE(transaction_date) as date'),
                DB::raw("SUM(CASE WHEN transaction_type = 'STOCK_IN' THEN quantity ELSE 0 END) as stock_in"),
                DB::raw("SUM(CASE WHEN transaction_type = 'STOCK_OUT' THEN quantity ELSE 0 END) as stock_out")
            )
            ->where('transaction_date', '>=', now()->subDays(7))
            ->groupBy('date')
            ->orderBy('date')
            ->get();
        
        // Get sales trends (last 7 days)
        $salesTrends = DB::table('sales')
            ->select(
                DB::raw('DATE(sale_date) as date'),
                DB::raw('COUNT(sale_id) as orders'),
                DB::raw('SUM(total_amount) as revenue')
            )
            ->where('sale_date', '>=', now()->subDays(7))
            ->groupBy('date')
            ->orderBy('date')
            ->get();
        
        // Get top selling products
        $topProducts = DB::table('order_items as oi')
            ->join('products as p', 'oi.product_id', '=', 'p.product_id')
            ->select('p.product_name', DB::raw('SUM(oi.quantity) as total_sold'), DB::raw('SUM(oi.subtotal) as total_revenue'))
            ->join('orders as o', 'oi.order_id', '=', 'o.order_id')
            ->where('o.status', '!=', 'Cancelled')
            ->groupBy('p.product_id', 'p.product_name')
            ->orderBy('total_sold', 'desc')
            ->take(5)
            ->get();
        
        // Get delivery statistics
        $deliveryStats = [
            'pending' => Delivery::where('delivery_status', 'Pending')->count(),
            'out_for_delivery' => Delivery::where('delivery_status', 'Out for Delivery')->count(),
            'delivered' => Delivery::where('delivery_status', 'Delivered')->count(),
            'failed' => Delivery::where('delivery_status', 'Failed')->count(),
        ];

        // Get products for inventory table with sales data
        $products = Product::with(['category', 'inventory'])
            ->where('is_active', true)
            ->get()
            ->map(function ($product) {
                // Check if product was recently added (last 7 days)
                $recentlyAdded = $product->created_at && $product->created_at->greaterThan(now()->subDays(7));

                // Set default sales values (can be enhanced later when Sale model is available)
                $totalSales = 0;
                $salesTrend = [0, 0, 0, 0, 0, 0, 0]; // 7 days of zeros

                return [
                    'product_id' => $product->product_id,
                    'product_name' => $product->product_name,
                    'category' => $product->category ? $product->category->category_name : 'Unknown',
                    'description' => $product->description,
                    'unit' => $product->unit,
                    'price' => $product->price,
                    'price_per_case' => $product->price_per_case,
                    'price_per_case_cold' => $product->price_per_case_cold,
                    'price_per_bottle' => $product->price_per_bottle,
                    'current_quantity' => $product->inventory ? $product->inventory->current_quantity : 0,
                    'min_stock_level' => $product->inventory ? $product->inventory->min_stock_level : 0,
                    'is_low_stock' => $product->inventory && $product->inventory->isLowStock(),
                    'recently_added' => $recentlyAdded,
                    'total_sales' => $totalSales,
                    'sales_trend' => $salesTrend,
                ];
            });

        $categories = Category::all();

        return Inertia::render('admin/dashboard', [
            'stats' => [
                'totalProducts' => $totalProducts,
                'totalStock' => $totalStock,
                'lowStockItems' => $lowStockItems,
                'recentTransactions' => StockLog::whereDate('transaction_date', today())->count(),
                'todayOrders' => $todayOrders,
                'pendingDeliveries' => $pendingDeliveries,
                'recentDamagedBeverages' => BrokenBottle::whereDate('report_date', today())->count(),
            ],
            // All-time takings, so the admin sees where sales stand without
            // opening POS Sales History or the Reports page.
            'overallSales' => Sale::overallSummary(),
            'recentStockLogs' => $recentStockLogs,
            'recentOrders' => $recentOrders,
            'recentDamagedBeverages' => $recentDamagedBeverages,
            'lowStockProducts' => $lowStockProducts,
            'categoryStats' => $categoryStats,
            'stockTrends' => $stockTrends,
            'salesTrends' => $salesTrends,
            'topProducts' => $topProducts,
            'deliveryStats' => $deliveryStats,
            'products' => $products,
            'categories' => $categories,
        ]);
    }

    public function reports(Request $request): Response
    {
        // Get filter parameters
        $categoryFilter = $request->input('category', 'all');
        $daysFilter = (int) $request->input('days', 30);
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');

        // Determine date range
        if ($startDate && $endDate) {
            // Use custom date range
            $dateFrom = \Carbon\Carbon::parse($startDate)->startOfDay();
            $dateTo = \Carbon\Carbon::parse($endDate)->endOfDay();
            $useCustomRange = true;
        } else {
            // Use days filter
            $dateFrom = now()->subDays($daysFilter);
            $dateTo = now();
            $useCustomRange = false;
        }

        // Get moving products (sold in specified date range)
        $movingProductsQuery = DB::table('order_items as oi')
            ->join('products as p', 'oi.product_id', '=', 'p.product_id')
            ->join('orders as o', 'oi.order_id', '=', 'o.order_id')
            ->join('categories as c', 'p.category_id', '=', 'c.category_id')
            ->select(
                DB::raw('MIN(p.product_id) as product_id'),
                'p.product_name',
                'c.category_name',
                DB::raw('MIN(p.price) as price'),
                DB::raw('SUM(oi.quantity) as total_sold'),
                DB::raw('SUM(oi.subtotal) as total_revenue'),
                DB::raw('COUNT(DISTINCT o.order_id) as order_count'),
                DB::raw('MAX(o.order_date) as last_sale_date')
            )
            ->whereBetween('o.order_date', [$dateFrom, $dateTo])
            ->where('o.status', '!=', 'Cancelled')
            ->where('p.is_active', true);

        // Apply category filter if selected
        if ($categoryFilter !== 'all') {
            $movingProductsQuery->where('c.category_name', $categoryFilter);
        }

        $movingProducts = $movingProductsQuery
            // Grouped by name + category rather than product_id: products
            // like "Purified Ice Tube" exist as one row per weight variant
            // (1kg, 3kg, 5kg ... 50kg), so grouping by id showed the same
            // name repeated up to 8x in the Top Moving Products chart,
            // crowding out other real products from the top 10. Every
            // variant sharing a name is now summed into a single row.
            ->groupBy('p.product_name', 'c.category_name')
            ->orderBy('total_sold', 'desc')
            ->get();

        // Get non-moving products (not sold in specified date range)
        $nonMovingProductsQuery = DB::table('products as p')
            ->leftJoin('order_items as oi', function($join) use ($dateFrom, $dateTo) {
                $join->on('p.product_id', '=', 'oi.product_id')
                    ->join('orders as o', 'oi.order_id', '=', 'o.order_id')
                    ->whereBetween('o.order_date', [$dateFrom, $dateTo])
                    ->where('o.status', '!=', 'Cancelled');
            })
            ->leftJoin('categories as c', 'p.category_id', '=', 'c.category_id')
            ->leftJoin('inventory as i', 'p.product_id', '=', 'i.product_id')
            ->select(
                'p.product_id',
                'p.product_name',
                'c.category_name',
                'p.price',
                'i.current_quantity',
                'i.min_stock_level',
                DB::raw('COALESCE(SUM(oi.quantity), 0) as total_sold'),
                DB::raw('p.created_at as product_added_date')
            )
            ->where('p.is_active', true)
            ->whereNull('oi.order_item_id');

        // Apply category filter if selected
        if ($categoryFilter !== 'all') {
            $nonMovingProductsQuery->where('c.category_name', $categoryFilter);
        }

        $nonMovingProducts = $nonMovingProductsQuery
            ->groupBy('p.product_id', 'p.product_name', 'c.category_name', 'p.price', 'i.current_quantity', 'i.min_stock_level', 'p.created_at')
            ->orderBy('i.current_quantity', 'desc')
            ->get();

        // Get all categories for filter dropdown
        $categories = Category::all()->pluck('category_name')->toArray();

        // Prepare filters for frontend
        $filters = [
            'category' => $categoryFilter,
        ];

        if ($useCustomRange) {
            $filters['start_date'] = $startDate;
            $filters['end_date'] = $endDate;
            $filters['days'] = 'custom';
        } else {
            $filters['days'] = $daysFilter;
        }

        return Inertia::render('admin/reports', [
            'movingProducts' => $movingProducts,
            'nonMovingProducts' => $nonMovingProducts,
            'categories' => $categories,
            'filters' => $filters,
            'salesReport' => $this->buildSalesReport($dateFrom, $dateTo),
            'customerReport' => $this->buildCustomerReport($dateFrom, $dateTo),
            'ordersReport' => $this->buildOrdersReport($dateFrom, $dateTo),
            'deliveryReport' => $this->buildDeliveryReport($dateFrom, $dateTo),
        ]);
    }

    /**
     * Confirmed, non-voided revenue: 'pending' sales haven't actually been
     * paid yet and a voided sale was reversed, so neither counts as real
     * income for the period.
     */
    private function buildSalesReport($dateFrom, $dateTo): array
    {
        $baseQuery = Sale::whereBetween('sale_date', [$dateFrom, $dateTo])
            ->where('payment_status', 'confirmed')
            ->whereNull('voided_at');

        $totalSales = $baseQuery->clone()->count();
        $totalRevenue = (float) $baseQuery->clone()->sum('total_amount');

        $trend = DB::table('sales')
            ->select(
                DB::raw('DATE(sale_date) as date'),
                DB::raw('SUM(total_amount) as revenue'),
                DB::raw('COUNT(*) as sales_count')
            )
            ->whereBetween('sale_date', [$dateFrom, $dateTo])
            ->where('payment_status', 'confirmed')
            ->whereNull('voided_at')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $paymentBreakdown = DB::table('sales as s')
            ->join('orders as o', 's.order_id', '=', 'o.order_id')
            ->select('o.payment_method', DB::raw('COUNT(*) as count'), DB::raw('SUM(s.total_amount) as revenue'))
            ->whereBetween('s.sale_date', [$dateFrom, $dateTo])
            ->where('s.payment_status', 'confirmed')
            ->whereNull('s.voided_at')
            ->groupBy('o.payment_method')
            ->get();

        return [
            'summary' => [
                'total_revenue' => $totalRevenue,
                'total_sales' => $totalSales,
                'average_sale' => $totalSales > 0 ? round($totalRevenue / $totalSales, 2) : 0,
            ],
            'trend' => $trend,
            'paymentBreakdown' => $paymentBreakdown,
        ];
    }

    /**
     * "Customers" here means account-level analytics (new signups, top
     * spenders) — distinct from the separate "Customer Reports" damage/
     * complaint feature elsewhere in the admin nav, which already has its
     * own page.
     */
    private function buildCustomerReport($dateFrom, $dateTo): array
    {
        $newCustomers = User::where('role', 'Customer')
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->count();

        $activeCustomers = Order::whereBetween('order_date', [$dateFrom, $dateTo])
            ->where('status', '!=', 'Cancelled')
            ->distinct('user_id')
            ->count('user_id');

        $topCustomers = DB::table('orders as o')
            ->join('users as u', 'o.user_id', '=', 'u.id')
            ->select(
                'u.id as user_id',
                'u.full_name',
                'u.email',
                DB::raw('COUNT(DISTINCT o.order_id) as total_orders'),
                DB::raw('SUM(o.total_amount) as total_spent')
            )
            ->whereBetween('o.order_date', [$dateFrom, $dateTo])
            ->where('o.status', '!=', 'Cancelled')
            ->groupBy('u.id', 'u.full_name', 'u.email')
            ->orderBy('total_spent', 'desc')
            ->take(10)
            ->get();

        return [
            'summary' => [
                'new_customers' => $newCustomers,
                'active_customers' => $activeCustomers,
            ],
            'topCustomers' => $topCustomers,
        ];
    }

    /**
     * Every order in the range regardless of status — the operational view
     * of order volume, as opposed to buildSalesReport()'s confirmed-revenue
     * financial view.
     */
    private function buildOrdersReport($dateFrom, $dateTo): array
    {
        $baseQuery = Order::whereBetween('order_date', [$dateFrom, $dateTo]);

        $totalOrders = $baseQuery->clone()->count();
        $cancelledCount = $baseQuery->clone()->where('status', 'Cancelled')->count();
        // total_amount, not overall_total: overall_total is only ever set
        // for order_type='delivery' (total_amount + delivery_fee) — POS
        // orders leave it at 0, which would silently undercount revenue here.
        $completedValue = (float) $baseQuery->clone()->where('status', '!=', 'Cancelled')->sum('total_amount');
        $nonCancelledCount = $totalOrders - $cancelledCount;

        $statusBreakdown = DB::table('orders')
            ->select('status', DB::raw('COUNT(*) as count'))
            ->whereBetween('order_date', [$dateFrom, $dateTo])
            ->groupBy('status')
            ->get();

        $typeBreakdown = DB::table('orders')
            ->select('order_type', DB::raw('COUNT(*) as count'))
            ->whereBetween('order_date', [$dateFrom, $dateTo])
            ->groupBy('order_type')
            ->get();

        $trend = DB::table('orders')
            ->select(DB::raw('DATE(order_date) as date'), DB::raw('COUNT(*) as count'))
            ->whereBetween('order_date', [$dateFrom, $dateTo])
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return [
            'summary' => [
                'total_orders' => $totalOrders,
                'cancelled_orders' => $cancelledCount,
                'total_value' => $completedValue,
                'average_order_value' => $nonCancelledCount > 0 ? round($completedValue / $nonCancelledCount, 2) : 0,
            ],
            'statusBreakdown' => $statusBreakdown,
            'typeBreakdown' => $typeBreakdown,
            'trend' => $trend,
        ];
    }

    private function buildDeliveryReport($dateFrom, $dateTo): array
    {
        $baseQuery = Delivery::whereBetween('assigned_date', [$dateFrom, $dateTo]);

        $totalDeliveries = $baseQuery->clone()->count();
        $deliveredCount = $baseQuery->clone()->where('delivery_status', 'Delivered')->count();
        $failedCount = $baseQuery->clone()->where('delivery_status', 'Failed')->count();

        $statusBreakdown = DB::table('deliveries')
            ->select('delivery_status', DB::raw('COUNT(*) as count'))
            ->whereBetween('assigned_date', [$dateFrom, $dateTo])
            ->groupBy('delivery_status')
            ->get();

        $riderPerformance = DB::table('deliveries as d')
            ->join('users as u', 'd.rider_id', '=', 'u.id')
            ->select(
                'u.id as rider_id',
                'u.full_name as rider_name',
                DB::raw('COUNT(*) as assigned'),
                DB::raw("SUM(CASE WHEN d.delivery_status = 'Delivered' THEN 1 ELSE 0 END) as delivered"),
                DB::raw("SUM(CASE WHEN d.delivery_status = 'Failed' THEN 1 ELSE 0 END) as failed")
            )
            ->whereBetween('d.assigned_date', [$dateFrom, $dateTo])
            ->groupBy('u.id', 'u.full_name')
            ->orderBy('assigned', 'desc')
            ->get();

        return [
            'summary' => [
                'total_deliveries' => $totalDeliveries,
                'delivered' => $deliveredCount,
                'failed' => $failedCount,
                'completion_rate' => $totalDeliveries > 0 ? round(($deliveredCount / $totalDeliveries) * 100, 1) : 0,
            ],
            'statusBreakdown' => $statusBreakdown,
            'riderPerformance' => $riderPerformance,
        ];
    }

    public function transactions(Request $request): Response
    {
        // Get stock logs (inventory transactions)
        $stockLogs = StockLog::with(['product', 'user'])
            ->orderBy('created_at', 'desc')
            ->take(50)
            ->get();

        // Get recent orders
        $recentOrders = Order::with(['customer', 'orderItems.product'])
            ->orderBy('order_date', 'desc')
            ->take(50)
            ->get();

        // Get recent product additions
        $recentProducts = Product::with(['category', 'inventory'])
            ->where('is_active', true)
            ->orderBy('created_at', 'desc')
            ->take(50)
            ->get();

        // Get recent sales
        $recentSales = Sale::with(['order'])
            ->orderBy('sale_date', 'desc')
            ->take(50)
            ->get();

        // Get recent damaged beverages
        $recentDamagedBeverages = BrokenBottle::with('reporter')
            ->orderBy('report_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->take(50)
            ->get();

        return Inertia::render('admin/transactions', [
            'stockLogs' => $stockLogs,
            'recentOrders' => $recentOrders,
            'recentProducts' => $recentProducts,
            'recentSales' => $recentSales,
            'recentDamagedBeverages' => $recentDamagedBeverages,
        ]);
    }

    public function brokenBottlesReport(Request $request): Response
    {
        // Get filter parameters
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $daysFilter = $request->input('days', 30);

        // Prepare filters for frontend
        $filters = [];
        
        if ($startDate && $endDate) {
            $filters['start_date'] = $startDate;
            $filters['end_date'] = $endDate;
            $filters['days'] = 'custom';
        } else {
            $filters['days'] = $daysFilter;
        }

        return Inertia::render('admin/broken-bottles-report', [
            'filters' => $filters,
        ]);
    }
}
