<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Admin\CustomerReportController as AdminCustomerReportController;
use App\Http\Controllers\CustomerReportController;
use App\Http\Controllers\Admin\AdminOrderController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\DeliveryBoyController;
use App\Http\Controllers\BrokenBottleController;
use App\Http\Controllers\POSController;
use App\Http\Controllers\CashierController;
use App\Http\Controllers\PaymentConfirmationController;
use App\Http\Controllers\Admin\SupplierController;
use App\Http\Controllers\Admin\PurchaseOrderController;
use App\Http\Controllers\Admin\DeliveryFeeSettingController;
use App\Http\Controllers\Admin\StaffAccountController;
use App\Http\Controllers\ContactController;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::post('/contact-us', [ContactController::class, 'send'])
    ->middleware('throttle:5,1')
    ->name('contact.send');

// Uploads are linked as /storage/{path}. Locally that is the public/storage
// symlink, which the web server answers before Laravel is reached. When the
// "public" disk is remote (Supabase Storage on Vercel) no such file exists, so
// send the browser to the object's public URL instead. Outside the "web"
// middleware group: serving an image shouldn't open a session or run Inertia's
// shared-data queries.
Route::get('/storage/{path}', function (string $path) {
    abort_if(config('filesystems.disks.public.driver') === 'local' || str_contains($path, '..'), 404);

    return redirect()->away(Storage::disk('public')->url($path))
        ->header('Cache-Control', 'public, max-age=86400, s-maxage=86400');
})->where('path', '.*')->withoutMiddleware('web')->name('storage.public');

Route::middleware(['auth'])->group(function () {
    // Generic post-login landing route. Only a handful of auth scaffolding
    // controllers (email verification, password confirmation) redirect here;
    // everywhere else in the app links directly to the role-specific
    // dashboard route names below.
    Route::get('dashboard', function () {
        return match (auth()->user()->role) {
            'Customer' => redirect()->route('customer.dashboard'),
            'cashier' => redirect()->route('cashier.dashboard'),
            'delivery_boy' => redirect()->route('delivery-boy.dashboard'),
            default => redirect()->route('admin.dashboard'),
        };
    })->name('dashboard');

    // Customer routes
    Route::prefix('customer')->middleware(['role:Customer'])->group(function () {
        Route::get('dashboard', [CustomerController::class, 'index'])->name('customer.dashboard');
        Route::get('cart', [CustomerController::class, 'cart'])->name('customer.cart');
        Route::get('visit-us', function () {
            return Inertia::render('Customer/VisitUs');
        })->name('customer.visit-us');
        Route::get('pre-orders', [CustomerController::class, 'preOrders'])->name('customer.pre-orders');
        Route::post('pre-orders/{id}/cancel', [CustomerController::class, 'cancelPreOrder'])->name('customer.pre-orders.cancel');
        Route::get('delivered-orders', [CustomerController::class, 'deliveredOrders'])->name('customer.delivered-orders');
        Route::get('my-orders', [CustomerController::class, 'myOrders'])->name('customer.my-orders');
        
        // Customer reports
        Route::get('reports', [CustomerReportController::class, 'index'])->name('customer.reports');
        Route::get('reports/create/{orderId}', [CustomerReportController::class, 'create'])->name('customer.reports.create');
        Route::post('reports', [CustomerReportController::class, 'store'])->name('customer.reports.store');
        Route::get('reports/{id}', [CustomerReportController::class, 'show'])->name('customer.reports.show');
        Route::get('settings', [CustomerController::class, 'settings'])->name('customer.settings');
        Route::put('settings/profile', [CustomerController::class, 'updateProfile'])->name('customer.settings.profile');
        Route::put('settings/password', [CustomerController::class, 'updatePassword'])->name('customer.settings.password');
        Route::delete('settings/account', [CustomerController::class, 'deleteAccount'])->name('customer.settings.account');
        Route::post('settings/addresses', [CustomerController::class, 'storeAddress'])->name('customer.settings.addresses.store');
        Route::put('settings/addresses/{id}', [CustomerController::class, 'updateAddress'])->name('customer.settings.addresses.update');
        Route::delete('settings/addresses/{id}', [CustomerController::class, 'destroyAddress'])->name('customer.settings.addresses.destroy');
        Route::put('settings/addresses/{id}/default', [CustomerController::class, 'setDefaultAddress'])->name('customer.settings.addresses.default');
        Route::post('orders', [CustomerController::class, 'createOrder'])->name('customer.orders.create');

        // Customer order view
        Route::get('orders/{id}', [CustomerController::class, 'showOrder'])->name('customer.orders.show');

        // Customer order API routes
        Route::middleware(['web'])->group(function () {
            Route::get('orders', [App\Http\Controllers\Api\OrderController::class, 'getCustomerOrders'])->name('customer.orders');
            Route::post('api/orders', [App\Http\Controllers\Api\OrderController::class, 'store'])->name('customer.api.orders.store');
            Route::post('orders/{id}/checkout', [App\Http\Controllers\Api\OrderController::class, 'checkoutPreOrder'])->name('customer.orders.checkout');
            Route::post('orders/{id}/mark-successful', [App\Http\Controllers\Api\OrderController::class, 'markAsSuccessful'])->name('customer.orders.mark-successful');
            Route::post('orders/{id}/gcash-proof', [CustomerController::class, 'uploadGcashProof'])->name('customer.orders.gcash-proof');
            Route::post('orders/{id}/cod-proof', [CustomerController::class, 'uploadCodProof'])->name('customer.orders.cod-proof');
        });
    });

    // Delivery boy routes
    Route::prefix('delivery-boy')->middleware(['auth', 'role:delivery_boy'])->group(function () {
        Route::get('dashboard', [DeliveryBoyController::class, 'index'])->name('delivery-boy.dashboard');
        Route::get('settings', [DeliveryBoyController::class, 'settings'])->name('delivery-boy.settings');
        Route::put('settings/profile', [DeliveryBoyController::class, 'updateProfile'])->name('delivery-boy.settings.profile');
        Route::put('settings/password', [DeliveryBoyController::class, 'updatePassword'])->name('delivery-boy.settings.password');
        Route::middleware(['web'])->group(function () {
            Route::get('api/assigned-orders', [DeliveryBoyController::class, 'getAssignedOrders'])->name('delivery-boy.api.assigned-orders');
            Route::get('api/completed-deliveries', [DeliveryBoyController::class, 'getCompletedDeliveries'])->name('delivery-boy.api.completed-deliveries');
            Route::match(['post', 'put'], 'api/deliveries/{id}/status', [DeliveryBoyController::class, 'updateDeliveryStatus'])->name('delivery-boy.api.update-status');
        });
    });

    // Cashier routes
    Route::prefix('cashier')->middleware(['auth', 'cashier'])->group(function () {
        Route::get('dashboard', [CashierController::class, 'index'])->name('cashier.dashboard');
        Route::get('pos', [CashierController::class, 'pos'])->name('cashier.pos');
        Route::get('sales-history', [CashierController::class, 'salesHistory'])->name('cashier.sales-history');
        Route::get('sales-history/export', [CashierController::class, 'exportSalesHistory'])->name('cashier.sales-history.export');
        Route::post('sales-history/{sale}/void', [CashierController::class, 'voidSale'])->name('cashier.sales-history.void');
        Route::get('orders', [CashierController::class, 'ordersIndex'])->name('cashier.orders');
        
        // Cashier order management API routes
        Route::middleware(['web'])->group(function () {
            Route::get('api/orders/pending', [CashierController::class, 'getPendingOrders'])->name('cashier.api.orders.pending');
            Route::get('api/orders/processing', [CashierController::class, 'getProcessingOrders'])->name('cashier.api.orders.processing');
            Route::get('api/orders/completed', [CashierController::class, 'getCompletedOrders'])->name('cashier.api.orders.completed');
            Route::post('api/orders/{id}/mark-ready', [CashierController::class, 'markOrderAsReady'])->name('cashier.api.orders.mark-ready');
            Route::get('api/delivery-boys', [CashierController::class, 'getDeliveryBoys'])->name('cashier.api.delivery-boys');
            Route::post('api/orders/{id}/approve', [CashierController::class, 'approveOrder'])->name('cashier.api.orders.approve');
            Route::post('api/orders/{id}/reject', [CashierController::class, 'rejectOrder'])->name('cashier.api.orders.reject');
            Route::post('api/orders/{id}/assign-delivery', [CashierController::class, 'assignDelivery'])->name('cashier.api.orders.assign-delivery');
            Route::post('api/orders/{id}/mark-paid', [CashierController::class, 'markOrderAsPaid'])->name('cashier.api.orders.mark-paid');
            // Reuses AdminOrderController::completeRefund — cashier handles all
            // other GCash money movement in this app (confirm/reject payment
            // proofs above), so they can also mark a refund as sent back; the
            // logic itself has nothing admin-specific about it.
            Route::post('api/orders/{id}/complete-refund', [AdminOrderController::class, 'completeRefund'])->name('cashier.api.orders.complete-refund');
            
            // Daily reset API routes
            Route::post('api/daily-summary/reset', [CashierController::class, 'resetDailySummary'])->name('cashier.api.daily-summary.reset');
            Route::get('api/daily-summary', [CashierController::class, 'getDailySummary'])->name('cashier.api.daily-summary.get');
            Route::get('api/daily-summary/history', [CashierController::class, 'getSummaryHistory'])->name('cashier.api.daily-summary.history');

            // GCash payment verification routes
            Route::get('api/gcash-pending', [CashierController::class, 'getGcashPendingOrders'])->name('cashier.api.gcash-pending');
            Route::post('api/gcash/{id}/confirm', [CashierController::class, 'confirmGcashPayment'])->name('cashier.api.gcash.confirm');
            Route::post('api/gcash/{id}/reject', [CashierController::class, 'rejectGcashPayment'])->name('cashier.api.gcash.reject');
            // COD down payment verification routes
            Route::get('api/cod-pending', [CashierController::class, 'getCodPendingOrders'])->name('cashier.api.cod-pending');
            Route::post('api/cod/{id}/confirm', [CashierController::class, 'confirmCodPayment'])->name('cashier.api.cod.confirm');
            Route::post('api/cod/{id}/reject', [CashierController::class, 'rejectCodPayment'])->name('cashier.api.cod.reject');

            // Customer block/unblock routes
            Route::post('api/customers/{id}/block', [CashierController::class, 'blockCustomer'])->name('cashier.api.customers.block');
            Route::post('api/customers/{id}/unblock', [CashierController::class, 'unblockCustomer'])->name('cashier.api.customers.unblock');
        });
    });

    // Admin routes
    Route::prefix('admin')->middleware(['role:Admin,SuperAdmin', 'admin.approval'])->group(function () {
        Route::get('dashboard', [DashboardController::class, 'index'])->name('admin.dashboard');
        Route::get('inventory', [DashboardController::class, 'index'])->name('admin.inventory');
        Route::get('reports', [DashboardController::class, 'reports'])->name('admin.reports');
        Route::get('transactions', [DashboardController::class, 'transactions'])->name('admin.transactions');
        Route::get('pre-orders', [AdminOrderController::class, 'index'])->name('admin.pre-orders');
        Route::get('broken-bottles-report', [DashboardController::class, 'brokenBottlesReport'])->name('admin.broken-bottles-report');
        Route::get('broken-bottles', function () {
            return Inertia::render('admin/broken-bottles');
        })->name('admin.broken-bottles');
        Route::get('delivery-fee', [DeliveryFeeSettingController::class, 'edit'])->name('admin.delivery-fee.edit');
        Route::put('delivery-fee', [DeliveryFeeSettingController::class, 'update'])->name('admin.delivery-fee.update');

        // Staff accounts (Admin/SuperAdmin creates and manages Cashier,
        // Delivery Boy, and Admin accounts directly — no public
        // self-registration or approval queue for these roles).
        Route::get('staff-accounts', [StaffAccountController::class, 'index'])->name('admin.staff-accounts.index');
        Route::get('staff-accounts/create', [StaffAccountController::class, 'create'])->name('admin.staff-accounts.create');
        Route::post('staff-accounts', [StaffAccountController::class, 'store'])->name('admin.staff-accounts.store');
        Route::put('staff-accounts/{user}/toggle-active', [StaffAccountController::class, 'toggleActive'])->name('admin.staff-accounts.toggle-active');
        Route::put('staff-accounts/{user}/reset-password', [StaffAccountController::class, 'resetPassword'])->name('admin.staff-accounts.reset-password');
        Route::delete('staff-accounts/{user}', [StaffAccountController::class, 'destroy'])->name('admin.staff-accounts.destroy');

        // Admin order management API routes
        Route::middleware(['web'])->group(function () {
            Route::get('api/orders/pending', [AdminOrderController::class, 'getPendingOrders'])->name('admin.api.orders.pending');
            Route::get('api/orders/processing', [AdminOrderController::class, 'getProcessingOrders'])->name('admin.api.orders.processing');
            Route::get('api/orders/delivered', [AdminOrderController::class, 'getDeliveredOrders'])->name('admin.api.orders.delivered');
            Route::get('api/orders/completed', [AdminOrderController::class, 'getCompletedOrders'])->name('admin.api.orders.completed');
            Route::get('api/orders/cancelled', [AdminOrderController::class, 'getCancelledOrders'])->name('admin.api.orders.cancelled');
            Route::post('api/orders/{id}/complete-refund', [AdminOrderController::class, 'completeRefund'])->name('admin.api.orders.complete-refund');
            Route::get('api/delivery-boys', [AdminOrderController::class, 'getDeliveryBoys'])->name('admin.api.delivery-boys');
            Route::post('api/orders/{id}/accept', [AdminOrderController::class, 'acceptOrder'])->name('admin.api.orders.accept');
            Route::post('api/orders/{id}/approve', [AdminOrderController::class, 'approveOrder'])->name('admin.api.orders.approve');
            Route::post('api/orders/{id}/assign-delivery', [AdminOrderController::class, 'assignDelivery'])->name('admin.api.orders.assign-delivery');
            Route::post('api/orders/{id}/reject', [AdminOrderController::class, 'rejectOrder'])->name('admin.api.orders.reject');
            Route::post('api/orders/{id}/confirm-success', [AdminOrderController::class, 'confirmSuccessfulDelivery'])->name('admin.api.orders.confirm-success');
            Route::post('api/orders/{id}/confirm-payment', [AdminOrderController::class, 'confirmPayment'])->name('admin.api.orders.confirm-payment');
            // Backs the sidebar header's low-stock bell.
            Route::get('api/low-stock-products', [DashboardController::class, 'getLowStockProducts'])->name('admin.api.low-stock-products');
        });

        // Broken bottles management API routes
        Route::middleware(['web'])->group(function () {
            Route::get('api/broken-bottles', [BrokenBottleController::class, 'index'])->name('admin.api.broken-bottles.index');
            Route::get('api/broken-bottles/reports', [BrokenBottleController::class, 'getReports'])->name('admin.api.broken-bottles.reports');
            Route::post('api/broken-bottles', [BrokenBottleController::class, 'store'])->name('admin.api.broken-bottles.store');
            Route::delete('api/broken-bottles/{id}', [BrokenBottleController::class, 'destroy'])->name('admin.api.broken-bottles.destroy');
            Route::get('api/broken-bottles/stats', [BrokenBottleController::class, 'getStats'])->name('admin.api.broken-bottles.stats');
        });

        // Inventory management API routes
        Route::middleware(['web'])->group(function () {
            Route::post('inventory/add-stock', [InventoryController::class, 'addStock'])->name('admin.inventory.add-stock');
            Route::post('inventory/update-min-stock', [InventoryController::class, 'updateMinStock'])->name('admin.inventory.update-min-stock');
            Route::post('inventory/create-product', [InventoryController::class, 'createProduct'])->name('admin.inventory.create-product');
            Route::post('inventory/update-product', [InventoryController::class, 'updateProduct'])->name('admin.inventory.update-product');
            Route::post('inventory/archive-product', [InventoryController::class, 'archiveProduct'])->name('admin.inventory.archive-product');
        });


        // POS routes (admin's own POS screen; stays admin/super-admin only)
        Route::get('pos', [POSController::class, 'index'])->name('admin.pos');
        // Complete sales history across every cashier/admin account, not
        // just the currently logged-in user (unlike cashier.sales-history).
        Route::get('pos/history', [POSController::class, 'history'])->name('admin.pos.history');
        // Overall (all-time) POS sales totals, refreshed by the POS screen
        // after a sale or a void without reloading the whole page.
        Route::get('api/pos/summary', [POSController::class, 'salesSummary'])->name('admin.api.pos.summary');

        // Payment confirmation API routes
        Route::middleware(['web'])->group(function () {
            Route::get('api/payments/pending', [PaymentConfirmationController::class, 'index'])->name('api.payments.pending');
            Route::get('api/payments/{saleId}', [PaymentConfirmationController::class, 'getPaymentDetails'])->name('api.payments.details');
            Route::post('api/payments/{saleId}/confirm', [PaymentConfirmationController::class, 'confirmPayment'])->name('api.payments.confirm');
            Route::post('api/payments/{saleId}/reject', [PaymentConfirmationController::class, 'rejectPayment'])->name('api.payments.reject');
        });

        // Supplier management routes
        Route::get('suppliers', [SupplierController::class, 'index'])->name('admin.suppliers');
        Route::post('suppliers', [SupplierController::class, 'store'])->name('admin.suppliers.store');
        Route::put('suppliers/{supplier}', [SupplierController::class, 'update'])->name('admin.suppliers.update');
        Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy'])->name('admin.suppliers.destroy');
        Route::post('suppliers/{supplier}/toggle-status', [SupplierController::class, 'toggleStatus'])->name('admin.suppliers.toggle-status');

        // Customer reports management routes
        Route::get('customer-reports', [AdminCustomerReportController::class, 'index'])->name('admin.customer-reports');
        Route::get('customer-reports/{id}', [AdminCustomerReportController::class, 'show'])->name('admin.customer-reports.show');
        Route::put('customer-reports/{id}/status', [AdminCustomerReportController::class, 'updateStatus'])->name('admin.customer-reports.update-status');
        Route::put('customer-reports/{id}/resolve', [AdminCustomerReportController::class, 'resolve'])->name('admin.customer-reports.resolve');
        Route::get('api/customer-reports/stats', [AdminCustomerReportController::class, 'getStats'])->name('admin.api.customer-reports.stats');
        Route::get('api/suppliers', [SupplierController::class, 'getSuppliers'])->name('admin.api.suppliers');
        Route::get('api/suppliers/{supplier}', [SupplierController::class, 'getSupplierDetails'])->name('admin.api.suppliers.details');

        // Purchase order management routes
        Route::get('purchase-orders', [PurchaseOrderController::class, 'index'])->name('admin.purchase-orders');
        Route::post('purchase-orders', [PurchaseOrderController::class, 'store'])->name('admin.purchase-orders.store');
        Route::get('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->name('admin.purchase-orders.show');
        Route::put('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'update'])->name('admin.purchase-orders.update');
        Route::post('purchase-orders/{purchaseOrder}/send', [PurchaseOrderController::class, 'sendToSupplier'])->name('admin.purchase-orders.send');
        Route::post('purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receiveItems'])->name('admin.purchase-orders.receive');
        Route::post('purchase-orders/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel'])->name('admin.purchase-orders.cancel');
        Route::get('api/purchase-orders/products', [PurchaseOrderController::class, 'getProducts'])->name('admin.api.purchase-orders.products');
        Route::get('api/purchase-orders/low-stock-products', [PurchaseOrderController::class, 'getLowStockProducts'])->name('admin.api.purchase-orders.low-stock-products');
    });

    // POS sale API routes, shared by the admin POS screen and the cashier POS
    // screen. Kept out of the admin.approval-gated group above: that
    // middleware hard-rejects any non-Admin/SuperAdmin role, which would
    // block cashiers from ever completing a walk-in sale even though their
    // own page (cashier/pos) calls these same admin/api/... endpoints.
    Route::prefix('admin')->middleware(['web', 'role:Admin,SuperAdmin,cashier'])->group(function () {
        Route::get('api/products', [POSController::class, 'getPOSProducts'])->name('api.products');
        Route::post('api/pos/sale', [POSController::class, 'processSale'])->name('api.pos.sale');
    });

});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
