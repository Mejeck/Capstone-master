<?php

use App\Models\Category;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

/*
|--------------------------------------------------------------------------
| Overall sales totals shown on the admin Dashboard and the POS screen
|--------------------------------------------------------------------------
|
| Both screens read Sale::overallSummary(), which counts only sales that
| are real income: confirmed and not voided. A pending (unconfirmed GCash)
| sale or a voided one must never inflate the figure.
*/

function recordSale(array $overrides = []): Sale
{
    $cashier = $overrides['cashier'] ?? User::factory()->cashier()->create();

    $category = Category::create(['category_name' => 'Ice Tubes ' . uniqid()]);

    $product = Product::create([
        'category_id' => $category->category_id,
        'product_name' => 'Purified Ice Tube 1kg',
        'unit' => 'kg',
        'price' => 10.00,
        'is_active' => true,
    ]);

    Inventory::create([
        'product_id' => $product->product_id,
        'current_quantity' => 50,
        'min_stock_level' => 10,
    ]);

    $amount = $overrides['amount'] ?? 50.00;

    $order = Order::create([
        'customer_id' => null,
        'user_id' => $cashier->id,
        'order_date' => now(),
        'total_amount' => $amount,
        'overall_total' => $amount,
        'status' => 'Completed',
        'payment_method' => 'Cash',
        'payment_status' => 'Paid',
        'order_type' => 'pos',
    ]);

    OrderItem::create([
        'order_id' => $order->order_id,
        'product_id' => $product->product_id,
        'quantity' => 5,
        'unit_price' => 10.00,
        'subtotal' => $amount,
    ]);

    return Sale::create(array_merge([
        'order_id' => $order->order_id,
        'sale_date' => now(),
        'total_amount' => $amount,
        'payment_received' => $amount,
        'change_amount' => 0,
        'recorded_by' => $cashier->id,
        'payment_status' => 'confirmed',
    ], $overrides['sale'] ?? []));
}

test('the summary counts confirmed sales and ignores voided and pending ones', function () {
    recordSale(['amount' => 100.00]);
    recordSale(['amount' => 250.00]);
    recordSale(['amount' => 999.00, 'sale' => ['voided_at' => now(), 'void_reason' => 'Wrong item']]);
    recordSale(['amount' => 777.00, 'sale' => ['payment_status' => 'pending']]);

    $summary = Sale::overallSummary();

    expect($summary['total_sales'])->toBe(350.0);
    expect($summary['total_transactions'])->toBe(2);
    expect($summary['today_sales'])->toBe(350.0);
});

test("today's figure only covers today, while the overall one covers every day", function () {
    recordSale(['amount' => 60.00, 'sale' => ['sale_date' => now()->subDays(3)]]);
    recordSale(['amount' => 40.00]);

    $summary = Sale::overallSummary();

    expect($summary['total_sales'])->toBe(100.0);
    expect($summary['today_sales'])->toBe(40.0);
});

test('with no sales at all the summary is zeroed, not null', function () {
    expect(Sale::overallSummary())->toBe([
        'total_sales' => 0.0,
        'total_transactions' => 0,
        'today_sales' => 0.0,
    ]);
});

test('the admin POS screen is handed the overall totals', function () {
    recordSale(['amount' => 120.00]);

    $this->actingAs(User::factory()->admin()->create());

    $this->get('/admin/pos')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->component('admin/pos')
            ->where('overall_sales.total_sales', fn ($value) => (float) $value === 120.0)
            ->where('overall_sales.total_transactions', 1)
    );
});

test('the admin dashboard is handed the overall totals', function () {
    recordSale(['amount' => 120.00]);

    $this->actingAs(User::factory()->admin()->create());

    $this->get('/admin/dashboard')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->component('admin/dashboard')
            ->where('overallSales.total_sales', fn ($value) => (float) $value === 120.0)
            ->where('overallSales.today_sales', fn ($value) => (float) $value === 120.0)
    );
});

test('the summary endpoint returns the same totals to an admin', function () {
    recordSale(['amount' => 80.00]);

    $this->actingAs(User::factory()->admin()->create());

    $this->getJson('/admin/api/pos/summary')
        ->assertOk()
        ->assertJson([
            'total_sales' => 80.0,
            'total_transactions' => 1,
            'today_sales' => 80.0,
        ]);
});

test('a customer cannot read the summary endpoint', function () {
    $this->actingAs(User::factory()->create());

    $response = $this->get('/admin/api/pos/summary');

    expect($response->status())->not->toBe(200);
});

test('the Sales History headline skips rejected and voided sales but still lists them', function () {
    recordSale(['amount' => 100.00]);
    recordSale(['amount' => 500.00, 'sale' => ['payment_status' => 'rejected']]);
    recordSale(['amount' => 900.00, 'sale' => ['voided_at' => now(), 'void_reason' => 'Wrong item']]);

    $this->actingAs(User::factory()->admin()->create());

    $this->get('/admin/pos/history')->assertOk()->assertInertia(
        fn (AssertableInertia $page) => $page
            ->component('admin/pos-history')
            // Headline: only the confirmed 100.
            ->where('summary.total_sales', fn ($value) => (float) $value === 100.0)
            ->where('summary.total_transactions', 1)
            // Table: all three are still there to audit.
            ->where('sales.total', 3)
    );
});
