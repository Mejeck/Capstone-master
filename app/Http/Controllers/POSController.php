<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Sale;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Inventory;
use App\Models\StockLog;
use App\Models\DailyCashierSummary;
use App\Models\Product;
use App\Services\InventoryService;
use App\Http\Controllers\Concerns\HasPOSProducts;
use App\Constants\TaxConstants;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class POSController extends Controller
{
    use HasPOSProducts;

    public function index(): Response
    {
        return Inertia::render('admin/pos', array_merge(
            $this->getPOSViewData(),
            ['overall_sales' => Sale::overallSummary()]
        ));
    }

    /**
     * Same totals as a JSON endpoint, so the POS screen can refresh them
     * after a sale or a void without a full page reload.
     */
    public function salesSummary(): \Illuminate\Http\JsonResponse
    {
        return response()->json(Sale::overallSummary());
    }

    /**
     * Complete sales history across every account that can record a POS
     * sale (admins, super-admins, and cashiers), not just the current
     * user's own sales — unlike CashierController::salesHistory().
     */
    public function history(Request $request): Response
    {
        $query = Sale::with(['order.orderItems.product', 'recordedByUser', 'voidedByUser']);

        if ($request->filled('start_date')) {
            $query->whereDate('sale_date', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $query->whereDate('sale_date', '<=', $request->end_date);
        }
        if ($request->filled('cashier_id')) {
            $query->where('recorded_by', $request->cashier_id);
        }

        // Grand total across every matching sale, not just the 15 on the
        // current page — cloned before pagination narrows $query down to one
        // page. Only confirmed, non-voided sales count, the same definition
        // the Dashboard and POS banners use (Sale::scopeRevenue): a rejected
        // payment never became income and a voided sale was reversed. The
        // table below still lists both, labelled — it's only this headline
        // figure that's filtered.
        $summaryQuery = (clone $query)->revenue();
        $summary = [
            'total_sales' => (float) (clone $summaryQuery)->sum('total_amount'),
            'total_transactions' => (clone $summaryQuery)->count(),
        ];

        $sales = $query->orderBy('created_at', 'desc')
            ->paginate(15)
            ->withQueryString()
            ->through(function ($sale) {
                return [
                    'sale_id' => $sale->sale_id,
                    'receipt_number' => 'POS-' . date('Y') . '-' . str_pad($sale->order_id, 6, '0', STR_PAD_LEFT),
                    'total_amount' => $sale->total_amount,
                    'payment_method' => $sale->order->payment_method ?? 'Unknown',
                    'cash_received' => $sale->payment_received,
                    'change_amount' => $sale->change_amount,
                    'created_at' => $sale->created_at->format('M d, Y h:i A'),
                    'cashier_name' => $sale->recordedByUser->full_name ?? 'Unknown',
                    'cashier_role' => $sale->recordedByUser->role ?? null,
                    'voided_at' => $sale->voided_at?->format('M d, Y h:i A'),
                    'voided_by' => $sale->voidedByUser->full_name ?? null,
                    'void_reason' => $sale->void_reason,
                    'items' => $sale->order->orderItems->map(function ($item) {
                        return [
                            'product_name' => $item->product->product_name,
                            'quantity' => $item->quantity,
                            'unit_price' => $item->unit_price,
                            'subtotal' => $item->subtotal,
                        ];
                    }),
                ];
            });

        // Only accounts that have actually recorded a sale — not the full
        // staff roster, which would list cashiers/admins with no history yet.
        $cashiers = User::whereIn('id', Sale::select('recorded_by')->distinct())
            ->orderBy('full_name')
            ->get(['id', 'full_name', 'role']);

        return Inertia::render('admin/pos-history', [
            'sales' => $sales,
            'summary' => $summary,
            'filters' => $request->only(['start_date', 'end_date', 'cashier_id']),
            'cashiers' => $cashiers,
        ]);
    }

    public function processSale(Request $request)
    {
        // The sales/order_items tables store money as decimal(10,2), so
        // anything at or above 1e8 overflows the column and crashes the
        // insert with a raw SQLSTATE[22003] instead of a clean validation
        // error. Capping here keeps a mistyped or pasted-in amount (e.g. a
        // fat-fingered cash received value) from ever reaching the DB.
        $maxDecimal102 = 99999999.99;

        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,product_id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_type' => 'required|in:bottle,case,kilos',
            'items.*.price' => "required|numeric|min:0|max:{$maxDecimal102}",
            'items.*.subtotal' => "required|numeric|min:0|max:{$maxDecimal102}",
            'payment_method' => 'required|in:cash,gcash',
            'cash_received' => "nullable|numeric|min:0|max:{$maxDecimal102}",
            'total_amount' => "required|numeric|min:0|max:{$maxDecimal102}",
            // Walk-in GCash is confirmed face-to-face at the counter: the
            // cashier reads the reference number off the customer's phone,
            // there's no screenshot to upload.
            'transaction_id' => 'required_if:payment_method,gcash|nullable|string|max:50',
        ]);

        try {
            DB::beginTransaction();

            // Verify stock is sufficient for every item before writing anything.
            // Quantities are summed per product since the same product can appear
            // more than once in the cart under different unit types (bottle/case).
            $requiredByProduct = [];
            foreach ($request->items as $item) {
                $requiredByProduct[$item['product_id']] = ($requiredByProduct[$item['product_id']] ?? 0) + $item['quantity'];
            }
            foreach ($requiredByProduct as $productId => $requiredQty) {
                $product = Product::find($productId);
                $inventory = $product?->inventory;
                if ($inventory && $inventory->current_quantity < $requiredQty) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => "Insufficient stock for {$product->product_name}. Available: {$inventory->current_quantity}, Requested: {$requiredQty}",
                    ], 422);
                }
            }

            $isGcash = $request->payment_method === 'gcash';

            // Create order for walk-in customer
            $order = new Order();
            $order->customer_id = null; // Walk-in customer
            $order->user_id = Auth::id(); // Current authenticated user
            $order->order_date = now();
            $order->status = 'Completed';
            $order->total_amount = $request->total_amount;
            $order->payment_method = $isGcash ? 'GCash' : 'Cash';
            $order->notes = 'Walk-in customer POS sale';
            $order->order_type = 'pos';
            $order->approval_status = 'approved'; // POS orders bypass pre-order approval
            // The cashier is physically present when a walk-in pays, so both
            // cash and GCash (confirmed via reference number) are paid immediately.
            $order->payment_status = 'Paid';
            $order->save(); // Save to generate auto-increment order_id

            // Create order items and update inventory
            $saleItems = [];
            foreach ($request->items as $item) {
                // Create order item
                OrderItem::create([
                    'order_id' => $order->order_id,
                    'product_id' => $item['product_id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['price'],
                    'subtotal' => $item['subtotal'],
                ]);

                // Get product for name and inventory
                $product = Product::find($item['product_id']);
                
                // Add to sale items for response
                $saleItems[] = [
                    'product_name' => $product->product_name,
                    'quantity' => $item['quantity'],
                    'unit_type' => $item['unit_type'],
                    'is_cold' => !empty($item['is_cold']),
                    'subtotal' => $item['subtotal'],
                ];
                
                $inventory = $product->inventory;
                
                if ($inventory) {
                    $quantityToDeduct = $item['quantity'];
                    if ($item['unit_type'] === 'case') {
                        // For beverages, inventory is tracked in cases, so deduct 1 per case
                        // For ice tubes, inventory might be different
                        $isIceTube = str_contains(strtolower($product->product_name), 'ice tube');
                        if (!$isIceTube) {
                            // Beverages: inventory is in cases, deduct 1 per case
                            $quantityToDeduct = $item['quantity'];
                        } else {
                            // Ice tubes: convert cases to appropriate unit if needed
                            $quantityToDeduct = $item['quantity']; // Ice tube cases are tracked as cases in inventory
                        }
                    }
                    // For kilos (ice tubes), quantity is already in kilos
                    
                    // Check stock level and create purchase order if needed (BEFORE deduction)
                    $inventoryService = new InventoryService();
                    $purchaseOrder = $inventoryService->checkStockLevelAfterSale($product, $quantityToDeduct);
                    
                    if ($purchaseOrder) {
                        // Log that a purchase order was created
                        \Log::info("Purchase order {$purchaseOrder->po_number} created for low stock product: {$product->product_name}");
                    }
                    
                    $inventory->current_quantity -= $quantityToDeduct;
                    $inventory->save();

                    // Create stock log
                    StockLog::create([
                        'product_id' => $item['product_id'],
                        'user_id' => Auth::id(),
                        'transaction_type' => 'STOCK_OUT',
                        'quantity' => $quantityToDeduct,
                        'transaction_date' => now(),
                        'reference' => 'POS Sale #' . $order->order_id,
                        'notes' => 'Walk-in customer purchase',
                    ]);
                }
            }

            // Create sale record. GCash proof is just the reference number the
            // cashier read off the customer's phone and already confirmed in
            // person, so the sale is recorded as confirmed immediately.
            $sale = Sale::create([
                'order_id' => $order->order_id,
                'sale_date' => now(),
                'total_amount' => $request->total_amount,
                'payment_received' => $request->cash_received ?? $request->total_amount,
                'change_amount' => $request->cash_received ? $request->cash_received - $request->total_amount : 0,
                'recorded_by' => Auth::id(),
                'payment_proof_type' => $isGcash ? 'transaction_id' : null,
                'transaction_id' => $request->transaction_id,
                'payment_status' => 'confirmed',
            ]);

            // Update daily cashier summary. Only an actual cash payment counts
            // toward cash received / change — GCash paid at the counter is
            // tracked separately since no physical cash changed hands.
            $this->updateDailyCashierSummary(
                Auth::id(),
                $request->total_amount,
                $isGcash ? 0 : $request->cash_received,
                $isGcash ? $request->total_amount : 0,
                $isGcash ? 0 : ($request->cash_received - $request->total_amount)
            );

            DB::commit();

            // Calculate VAT (12% inclusive)
            $totalAmount = $sale->total_amount;
            $subtotalWithoutVAT = TaxConstants::calculateBasePrice($totalAmount);
            $vatAmount = TaxConstants::calculateVAT($totalAmount);

            return response()->json([
                'success' => true,
                'sale' => [
                    'sale_id' => $sale->sale_id,
                    'receipt_number' => 'POS-' . date('Y') . '-' . str_pad($order->order_id, 6, '0', STR_PAD_LEFT),
                    'created_at' => now(),
                    'total_amount' => $sale->total_amount,
                    'subtotal_without_vat' => round($subtotalWithoutVAT, 2),
                    'vat_amount' => round($vatAmount, 2),
                    'payment_method' => $request->payment_method,
                    'cash_received' => $sale->payment_received,
                    'change' => $sale->change_amount,
                    'items' => $saleItems,
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error processing sale: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update daily cashier summary after each sale
     */
    private function updateDailyCashierSummary($cashierId, $totalAmount, $cashReceived, $nonCashReceived, $changeAmount)
    {
        // Get or create today's summary
        $summary = DailyCashierSummary::getTodaySummary($cashierId);

        if (!$summary) {
            // Create new summary for today
            $summary = DailyCashierSummary::create([
                'cashier_id' => $cashierId,
                'summary_date' => today(),
                'total_sales' => $totalAmount,
                'total_transactions' => 1,
                'total_cash_received' => $cashReceived,
                'total_non_cash_received' => $nonCashReceived,
                'total_change' => $changeAmount,
                'average_transaction' => $totalAmount,
            ]);
        } else {
            // Update existing summary
            $summary->total_sales += $totalAmount;
            $summary->total_transactions += 1;
            $summary->total_cash_received += $cashReceived;
            $summary->total_non_cash_received += $nonCashReceived;
            $summary->total_change += $changeAmount;
            $summary->average_transaction = $summary->total_transactions > 0 ? $summary->total_sales / $summary->total_transactions : 0;
            $summary->save();
        }
    }

    /**
     * Reset daily cashier summary
     */
    public function resetDailySummary(Request $request)
    {
        $request->validate([
            'cashier_id' => 'required|exists:users,id',
            'notes' => 'nullable|string|max:500',
        ]);

        $cashierId = $request->cashier_id;
        $notes = $request->notes;
        $resetBy = Auth::id();

        try {
            $summary = DailyCashierSummary::getTodaySummary($cashierId);
            
            if (!$summary) {
                return response()->json([
                    'success' => false,
                    'message' => 'No daily summary found for today'
                ], 404);
            }

            if ($summary->isReset()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Daily summary has already been reset today'
                ], 400);
            }

            // Mark as reset
            $summary->markAsReset($resetBy, $notes);

            return response()->json([
                'success' => true,
                'message' => 'Daily summary reset successfully',
                'summary' => $summary->load(['cashier', 'resetBy'])
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error resetting daily summary: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get daily cashier summary
     */
    public function getDailySummary(Request $request)
    {
        $cashierId = $request->cashier_id ?? Auth::id();
        $date = $request->date ?? today()->toDateString();

        $summary = DailyCashierSummary::forCashier($cashierId)
            ->forDate($date)
            ->with(['cashier', 'resetBy'])
            ->first();

        if (!$summary) {
            return response()->json([
                'success' => false,
                'message' => 'No summary found for the specified date'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'summary' => $summary
        ]);
    }

    /**
     * Get cashier summary history
     */
    public function getSummaryHistory(Request $request)
    {
        $cashierId = $request->cashier_id ?? Auth::id();
        $days = $request->days ?? 7;

        $summaries = DailyCashierSummary::forCashier($cashierId)
            ->with(['cashier', 'resetBy'])
            ->orderBy('summary_date', 'desc')
            ->limit($days)
            ->get();

        return response()->json([
            'success' => true,
            'summaries' => $summaries
        ]);
    }
}
