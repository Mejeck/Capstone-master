<?php

namespace App\Http\Controllers;

use App\Constants\TaxConstants;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Order;
use App\Models\User;
use App\Models\Delivery;
use App\Models\DailyCashierSummary;
use App\Models\Inventory;
use App\Models\StockLog;
use App\Http\Controllers\Concerns\HasPOSProducts;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class CashierController extends Controller
{
    use HasPOSProducts;

    public function index(): Response
    {
        // Get today's daily summary (reset-aware)
        $todaySummary = DailyCashierSummary::getTodaySummary(Auth::id());
        
        // If summary exists and is reset, show zero values
        if ($todaySummary && $todaySummary->isReset()) {
            $totalSales = 0;
            $totalTransactions = 0;
            $totalCashReceived = 0;
            $totalNonCashReceived = 0;
            $totalChange = 0;
        } else {
            // Get actual today's sales if not reset
            $totalSales = $todaySummary ? $todaySummary->total_sales : 0;
            $totalTransactions = $todaySummary ? $todaySummary->total_transactions : 0;
            $totalCashReceived = $todaySummary ? $todaySummary->total_cash_received : 0;
            $totalNonCashReceived = $todaySummary ? $todaySummary->total_non_cash_received : 0;
            $totalChange = $todaySummary ? $todaySummary->total_change : 0;
        }

        $averageTransaction = $totalTransactions > 0 ? $totalSales / $totalTransactions : 0;

        $lowStockProducts = Inventory::with('product')
            ->whereRaw('current_quantity <= min_stock_level + 0.0001')
            ->whereHas('product', fn($q) => $q->where('is_active', true))
            ->get()
            ->map(fn($inv) => [
                'product_name'     => $inv->product->product_name,
                'current_quantity' => (float) $inv->current_quantity,
                'min_stock_level'  => (float) $inv->min_stock_level,
                'unit'             => $inv->product->unit,
                'is_critical'      => $inv->criticalStockLevel(),
            ])
            ->sortBy('current_quantity')
            ->values();

        return Inertia::render('cashier/dashboard', [
            'stats' => [
                'total_sales' => $totalSales,
                'total_transactions' => $totalTransactions,
                'total_cash_received' => $totalCashReceived,
                'total_non_cash_received' => $totalNonCashReceived,
                'total_change' => $totalChange,
                'average_transaction' => $averageTransaction,
            ],
            'cashier_name' => Auth::user()->full_name,
            'daily_summary' => $todaySummary,
            'low_stock' => $lowStockProducts,
        ]);
    }

    public function pos(): Response
    {
        return Inertia::render('cashier/pos', $this->getPOSViewData(Auth::user()->full_name));
    }

    public function salesHistory(Request $request): Response
    {
        // Cashiers only ever see today's own transactions here — voiding is
        // same-day only anyway, and browsing past days' history across all
        // cashiers is an admin-level report (see admin/pos-history).
        $query = Sale::with('order.orderItems.product')
            ->where('recorded_by', Auth::id())
            ->whereDate('sale_date', today());

        $sales = $query->orderBy('created_at', 'desc')
            ->paginate(10)
            ->through(function ($sale) {
                return [
                    'id' => $sale->id,
                    'sale_id' => $sale->sale_id,
                    'receipt_number' => 'POS-' . date('Y') . '-' . str_pad($sale->order_id, 6, '0', STR_PAD_LEFT),
                    'total_amount' => $sale->total_amount,
                    'payment_method' => $sale->order->payment_method ?? 'Unknown',
                    'cash_received' => $sale->payment_received,
                    'change_amount' => $sale->change_amount,
                    'created_at' => $sale->created_at->format('M d, Y h:i A'),
                    // Only today's own sales can be voided — see voidSale().
                    'can_void' => !$sale->isVoided() && $sale->created_at->isToday(),
                    'voided_at' => $sale->voided_at?->format('M d, Y h:i A'),
                    'void_reason' => $sale->void_reason,
                    'items' => $sale->order->orderItems->map(function ($item) use ($sale) {
                        return [
                            'order_item_id' => $item->order_item_id,
                            'product_name' => $item->product->product_name,
                            'quantity' => $item->quantity,
                            'unit_price' => $item->unit_price,
                            'subtotal' => $item->subtotal,
                            // A line can be voided on its own under the same
                            // same-day rule as the sale, as long as neither
                            // the line nor the whole sale is voided already.
                            'can_void' => !$sale->isVoided() && !$item->isVoided() && $sale->created_at->isToday(),
                            'voided_at' => $item->voided_at?->format('M d, Y h:i A'),
                            'void_reason' => $item->void_reason,
                        ];
                    }),
                ];
            });

        return Inertia::render('cashier/sales-history', [
            'sales' => $sales,
        ]);
    }

    /**
     * Export the cashier's sales history — today's transactions only, same
     * scope as salesHistory() above.
     */
    public function exportSalesHistory()
    {
        $sales = Sale::with('order.orderItems')
            ->where('recorded_by', Auth::id())
            ->whereDate('sale_date', today())
            ->orderBy('created_at', 'desc')->get();

        $filename = 'sales-history-' . now()->format('Y-m-d-His') . '.csv';

        return response()->streamDownload(function () use ($sales) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Receipt #', 'Date', 'Time', 'Items', 'Payment Method', 'Cash Received', 'Change', 'Total Amount']);

            foreach ($sales as $sale) {
                fputcsv($handle, [
                    'POS-' . date('Y') . '-' . str_pad($sale->order_id, 6, '0', STR_PAD_LEFT),
                    $sale->created_at->format('Y-m-d'),
                    $sale->created_at->format('h:i A'),
                    $sale->order->orderItems->count(),
                    $sale->order->payment_method ?? 'Unknown',
                    $sale->payment_received,
                    $sale->change_amount,
                    $sale->total_amount,
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    /**
     * Void one of the cashier's own completed walk-in sales: restores the
     * stock deducted at sale time, reverses this sale's contribution to
     * today's daily summary, and marks the sale (and its order) as voided
     * rather than deleting anything, so it still shows up in history as a
     * reversed transaction instead of just vanishing.
     *
     * Restricted to sales the cashier recorded themselves, from today only.
     * Voiding an older sale would mean rewriting a daily summary that's
     * already closed out (and possibly already reported on), which needs a
     * proper adjustment workflow, not a same-page undo button.
     */
    public function voidSale(Request $request, $saleId)
    {
        $request->validate([
            'reason' => 'required|string|max:255',
        ]);

        $sale = Sale::with('order.orderItems.product.inventory')
            ->where('recorded_by', Auth::id())
            ->find($saleId);

        if (!$sale) {
            return response()->json([
                'success' => false,
                'message' => 'Sale not found.',
            ], 404);
        }

        if ($sale->isVoided()) {
            return response()->json([
                'success' => false,
                'message' => 'This sale has already been voided.',
            ], 422);
        }

        if (!$sale->created_at->isToday()) {
            return response()->json([
                'success' => false,
                'message' => 'Only sales from today can be voided. Ask an admin to handle older transactions.',
            ], 422);
        }

        try {
            DB::transaction(function () use ($sale, $request) {
                $this->reverseWholeSale($sale, $request->reason);
            });

            return response()->json(['success' => true]);
        } catch (\Throwable $e) {
            \Log::error('Error voiding sale #' . $saleId . ': ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Could not void this sale. Please try again.',
            ], 500);
        }
    }

    /**
     * Void a single line of one of the cashier's own completed walk-in
     * sales — a customer only needs one wrong item taken off a three-item
     * receipt, not the whole transaction redone. Restores stock for that
     * line only, and reduces the sale's own total by that line's subtotal;
     * the rest of the sale (and the order it belongs to) stays exactly as
     * it was.
     *
     * If this is the last item still active on the sale, voiding it is
     * voiding the whole sale — it goes through the exact same reversal
     * voidSale() uses (order cancelled, the full original cash and change
     * backed out of the summary), rather than leaving a sale with every
     * line voided but the sale itself not marked as such.
     *
     * Same restrictions as voidSale(): the cashier's own sale, from today.
     */
    public function voidSaleItem(Request $request, $saleId, $orderItemId)
    {
        $request->validate([
            'reason' => 'required|string|max:255',
        ]);

        $sale = Sale::with('order.orderItems.product.inventory')
            ->where('recorded_by', Auth::id())
            ->find($saleId);

        if (!$sale) {
            return response()->json([
                'success' => false,
                'message' => 'Sale not found.',
            ], 404);
        }

        if ($sale->isVoided()) {
            return response()->json([
                'success' => false,
                'message' => 'This sale has already been voided.',
            ], 422);
        }

        if (!$sale->created_at->isToday()) {
            return response()->json([
                'success' => false,
                'message' => 'Only sales from today can be voided. Ask an admin to handle older transactions.',
            ], 422);
        }

        $order = $sale->order;
        $orderItem = $order->orderItems->firstWhere('order_item_id', (int) $orderItemId);

        if (!$orderItem) {
            return response()->json([
                'success' => false,
                'message' => 'Item not found on this sale.',
            ], 404);
        }

        if ($orderItem->isVoided()) {
            return response()->json([
                'success' => false,
                'message' => 'This item has already been voided.',
            ], 422);
        }

        try {
            $becameFullVoid = DB::transaction(function () use ($sale, $order, $orderItem, $request) {
                $stillActive = $order->orderItems->whereNull('voided_at');

                if ($stillActive->count() <= 1) {
                    // This is the only item left standing — finish the job
                    // the same way a whole-sale void does.
                    $this->reverseWholeSale($sale, $request->reason);

                    return true;
                }

                $this->reverseOrderItems($order, collect([$orderItem]), $request->reason);

                $order->total_amount -= $orderItem->subtotal;
                $order->save();

                $sale->total_amount -= $orderItem->subtotal;
                $sale->save();

                // Only the revenue figure moves for a partial void —
                // payment_received and change_amount are what physically
                // happened at the counter for the sale's original total, and
                // stay as a true record of that. The cashier hands the
                // voided item's amount back to the customer directly; this
                // only corrects what the business keeps from the sale.
                $summary = DailyCashierSummary::getTodaySummary(Auth::id());
                if ($summary && !$summary->isReset()) {
                    $summary->total_sales -= $orderItem->subtotal;
                    $summary->average_transaction = $summary->total_transactions > 0
                        ? $summary->total_sales / $summary->total_transactions
                        : 0;
                    $summary->save();
                }

                return false;
            });

            return response()->json([
                'success' => true,
                'sale_voided' => $becameFullVoid,
                'sale' => $this->serializeSaleForReceipt($sale->fresh('order.orderItems.product', 'recordedByUser')),
            ]);
        } catch (\Throwable $e) {
            \Log::error('Error voiding item #' . $orderItemId . ' on sale #' . $saleId . ': ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Could not void this item. Please try again.',
            ], 500);
        }
    }

    /**
     * The reversal common to both a whole-sale void and a per-item void that
     * turns out to be the sale's last remaining item: restores stock for
     * whatever is still active, marks the sale and its order voided, and
     * backs the sale's full current total — plus the original cash and
     * change received — out of today's summary.
     *
     * Only items not already voided are reversed, so a sale that already
     * had some lines voided one at a time doesn't have their stock restored
     * a second time when the last line finishes the job.
     */
    private function reverseWholeSale(Sale $sale, string $reason): void
    {
        $order = $sale->order;
        $stillActive = $order->orderItems->whereNull('voided_at');

        $this->reverseOrderItems($order, $stillActive, $reason);

        $sale->voided_at = now();
        $sale->voided_by = Auth::id();
        $sale->void_reason = $reason;
        $sale->save();

        // Not deleted: kept as the audit trail of what was voided and why.
        // 'Cancelled' also drops it out of any revenue totals elsewhere in
        // the app that only count 'Completed' orders.
        $order->status = 'Cancelled';
        $order->save();

        $summary = DailyCashierSummary::getTodaySummary(Auth::id());
        if ($summary && !$summary->isReset()) {
            $isGcash = strtolower($order->payment_method ?? '') === 'gcash';

            $summary->total_sales -= $sale->total_amount;
            $summary->total_transactions = max(0, $summary->total_transactions - 1);

            if ($isGcash) {
                $summary->total_non_cash_received -= $sale->total_amount;
            } else {
                $summary->total_cash_received -= $sale->payment_received;
                $summary->total_change -= $sale->change_amount;
            }

            $summary->average_transaction = $summary->total_transactions > 0
                ? $summary->total_sales / $summary->total_transactions
                : 0;

            $summary->save();
        }
    }

    /**
     * Restores inventory for each given order item, logs the return, and
     * marks each one voided. Shared by a whole-sale void and a single-item
     * void so stock is always put back the same way, whichever one ran.
     */
    private function reverseOrderItems(Order $order, \Illuminate\Support\Collection $items, string $reason): void
    {
        foreach ($items as $item) {
            $inventory = $item->product->inventory ?? null;
            if ($inventory) {
                $inventory->current_quantity += $item->quantity;
                $inventory->save();

                StockLog::create([
                    'product_id' => $item->product_id,
                    'user_id' => Auth::id(),
                    'transaction_type' => 'RETURN',
                    'quantity' => $item->quantity,
                    'transaction_date' => now(),
                    'reference' => 'Void POS Sale #' . $order->order_id,
                    'notes' => 'Item voided: ' . $reason,
                ]);
            }

            $item->voided_at = now();
            $item->voided_by = Auth::id();
            $item->void_reason = $reason;
            $item->save();
        }
    }

    /**
     * The same item shape the checkout response and Sales History already
     * send to the receipt, plus each line's own void state — so the receipt
     * can keep showing a sale after one of its items is voided, instead of
     * needing a full page reload to see the corrected total.
     */
    private function serializeSaleForReceipt(Sale $sale): array
    {
        $totalAmount = $sale->total_amount;
        $subtotalWithoutVAT = TaxConstants::calculateBasePrice($totalAmount);
        $vatAmount = TaxConstants::calculateVAT($totalAmount);

        return [
            'sale_id' => $sale->sale_id,
            'total_amount' => $totalAmount,
            'subtotal_without_vat' => round($subtotalWithoutVAT, 2),
            'vat_amount' => round($vatAmount, 2),
            'voided_at' => $sale->voided_at?->toIso8601String(),
            'items' => $sale->order->orderItems->map(function ($item) {
                return [
                    'order_item_id' => $item->order_item_id,
                    'product_name' => $item->product->product_name,
                    'quantity' => $item->quantity,
                    'subtotal' => $item->subtotal,
                    'voided_at' => $item->voided_at?->toIso8601String(),
                    'voided_by' => $item->voidedByUser->full_name ?? null,
                    'void_reason' => $item->void_reason,
                ];
            }),
        ];
    }

    // Order management methods for cashiers
    public function ordersIndex(): Response
    {
        return Inertia::render('cashier/orders');
    }

    public function getPendingOrders()
    {
        $orders = Order::with(['customer', 'user', 'orderItems.product.inventory'])
            ->where('approval_status', 'pending')
            ->whereIn('order_type', ['preorder', 'delivery', 'pickup'])
            ->orderBy('order_date', 'desc')
            ->get();

        return response()->json($orders);
    }

    public function getProcessingOrders()
    {
        $orders = Order::with(['customer', 'user', 'orderItems.product.inventory', 'delivery.rider'])
            ->whereIn('status', ['Processing', 'Ready to Deliver'])
            ->where('approval_status', 'approved')
            ->orderBy('order_date', 'desc')
            ->get();

        $orders->each(function ($order) {
            if ($order->gcash_screenshot) {
                $order->gcash_screenshot = asset('storage/' . $order->gcash_screenshot);
            }
        });

        return response()->json($orders);
    }

    public function approveOrder($id)
    {
        $order = Order::find($id);

        if (!$order) {
            return response()->json(['error' => 'Order not found'], 404);
        }

        if ($order->approval_status !== 'pending') {
            return response()->json(['error' => 'Order can only be approved when approval status is pending'], 400);
        }

        // Check stock availability before approving
        foreach ($order->orderItems as $item) {
            $product = $item->product;
            if (!$product->inventory || $product->inventory->current_quantity < $item->quantity) {
                $availableStock = $product->inventory ? $product->inventory->current_quantity : 0;
                return response()->json([
                    'error' => "Insufficient stock for {$product->product_name}. Required: {$item->quantity}, Available: {$availableStock}"
                ], 400);
            }
        }

        // Update approval status and order status
        $wasPending = $order->status === 'Pending';
        $order->approval_status = 'approved';
        $order->status = 'Processing';
        $order->approved_by = Auth::id();
        $order->approved_at = now();
        $order->save();

        // Deduct stock from inventory (only if not already deducted)
        if ($wasPending) {
            foreach ($order->orderItems as $item) {
                $product = $item->product;
                if ($product->inventory) {
                    $product->inventory->decrement('current_quantity', $item->quantity);
                }
            }
        }

        return response()->json([
            'message' => 'Order approved successfully',
            'order' => $order->load('orderItems.product.inventory')
        ]);
    }

    public function rejectOrder(Request $request, $id)
    {
        $request->validate([
            'rejection_reason' => 'required|string',
        ]);

        $order = Order::find($id);

        if (!$order) {
            return response()->json(['error' => 'Order not found'], 404);
        }

        if ($order->approval_status !== 'pending') {
            return response()->json(['error' => 'Order can only be rejected when approval status is pending'], 400);
        }

        // Update approval status and order status
        $order->approval_status = 'rejected';
        $order->status = 'Cancelled';
        $order->notes = $request->rejection_reason;
        $order->rejected_by = Auth::id();
        $order->rejected_at = now();
        $order->save();

        // Refund down payment if any (in a real system, this would process a refund)
        if ($order->down_payment > 0) {
            // In a real implementation, this would trigger a refund process
        }

        return response()->json([
            'message' => 'Order rejected successfully',
            'order' => $order
        ]);
    }

    public function markOrderAsPaid($id)
    {
        $order = Order::where('order_id', $id)
            ->where('payment_status', 'Partial')
            ->firstOrFail();

        $order->update(['payment_status' => 'Paid']);

        return response()->json(['success' => true, 'message' => 'Order marked as fully paid.']);
    }

    public function getCompletedOrders()
    {
        // A GCash/COD payment rejection only flips payment_status to 'Unpaid';
        // it deliberately leaves `status` untouched (it's still 'Processing')
        // so the customer can resubmit proof without the order being treated
        // as cancelled. That means these orders never reach the statuses
        // below on their own, so pull them in explicitly by their rejection
        // marker or they'd never show up in the cashier's Rejected/Unpaid list.
        $orders = Order::with(['customer', 'user', 'orderItems.product', 'delivery.rider'])
            ->where(function ($query) {
                $query->whereIn('status', ['Completed', 'Delivered', 'Cancelled'])
                    ->orWhere(function ($rejected) {
                        $rejected->where('payment_status', 'Unpaid')
                            ->where(function ($reason) {
                                $reason->whereNotNull('gcash_rejected_at')
                                    ->orWhereNotNull('cod_rejected_at');
                            });
                    });
            })
            ->orderBy('order_date', 'desc')
            ->get();

        $orders->each(function ($order) {
            if ($order->gcash_screenshot) {
                $order->gcash_screenshot = asset('storage/' . $order->gcash_screenshot);
            }
        });

        return response()->json($orders);
    }

    public function markOrderAsReady($id)
    {
        $order = Order::find($id);

        if (!$order) {
            return response()->json(['error' => 'Order not found'], 404);
        }

        if ($order->status !== 'Processing') {
            return response()->json(['error' => 'Order must be in Processing status to mark as ready'], 400);
        }

        $order->status = 'Ready to Deliver';
        $order->save();

        return response()->json(['success' => true, 'message' => 'Order marked as ready.']);
    }

    public function getDeliveryBoys()
    {
        $deliveryBoys = User::where('role', 'delivery_boy')
            ->where('is_active', true)
            ->get(['id', 'full_name', 'email', 'contact_number']);

        return response()->json($deliveryBoys);
    }

    public function assignDelivery(Request $request, $id)
    {
        $request->validate([
            'rider_id' => 'required|exists:users,id',
        ]);

        $order = Order::with('delivery')->find($id);

        if (!$order) {
            return response()->json(['error' => 'Order not found'], 404);
        }

        if (!in_array($order->status, ['Processing', 'Ready to Deliver'])) {
            return response()->json([
                'error' => 'Order must be in Processing or Ready to Deliver status to assign delivery',
                'current_status' => $order->status
            ], 400);
        }

        if ($order->approval_status !== 'approved') {
            return response()->json(['error' => 'Order must be approved before assigning delivery'], 400);
        }

        // Check if delivery already exists
        if ($order->delivery && $order->delivery->delivery_status !== 'Failed') {
            return response()->json(['error' => 'Delivery already assigned for this order'], 400);
        }

        try {
            // Create or update delivery record
            $delivery = Delivery::updateOrCreate(
                ['order_id' => $order->order_id],
                [
                    'rider_id' => $request->rider_id,
                    'assigned_by' => Auth::id(),
                    'assigned_date' => now(),
                    'delivery_status' => 'Pending',
                ]
            );

            return response()->json([
                'message' => 'Delivery assigned successfully',
                'delivery' => $delivery->load('rider', 'order')
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to assign delivery: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reset daily cashier summary
     */
    public function resetDailySummary(Request $request)
    {
        $request->validate([
            'notes' => 'nullable|string|max:500',
        ]);

        $cashierId = Auth::id();
        $notes = $request->notes;

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
            $summary->markAsReset($cashierId, $notes);

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
        $cashierId = Auth::id();
        $date = $request->date ?? today()->toDateString();

        $summary = DailyCashierSummary::forCashier($cashierId)
            ->forDate($date)
            ->with(['cashier', 'resetBy'])
            ->first();

        return response()->json([
            'summary' => $summary
        ]);
    }

    /**
     * Get cashier summary history
     */
    public function getSummaryHistory(Request $request)
    {
        $cashierId = Auth::id();
        $days = $request->days ?? 7;

        $summaries = DailyCashierSummary::forCashier($cashierId)
            ->with(['cashier', 'resetBy'])
            ->where('summary_date', '<', today())
            ->orderBy('summary_date', 'desc')
            ->limit($days)
            ->get();

        return response()->json([
            'summaries' => $summaries
        ]);
    }

    public function getGcashPendingOrders()
    {
        // A rejected/cancelled order can still be sitting on a leftover
        // 'Awaiting Verification' payment_status (rejecting an order only
        // ever touches approval_status/status, never payment_status) — without
        // this it kept resurfacing here asking the cashier to verify a
        // payment for an order that's already dead.
        $orders = Order::with(['user', 'orderItems.product'])
            ->where('payment_method', 'GCash')
            ->where('payment_status', 'Awaiting Verification')
            ->where('status', '!=', 'Cancelled')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($order) {
                $user = $order->user;
                return [
                    'order_id'            => $order->order_id,
                    'user_id'             => $order->user_id,
                    'customer_name'       => $order->order_type === 'pos' ? 'Walk-in Customer' : ($user ? $user->full_name : 'Unknown'),
                    'order_type'          => $order->order_type,
                    'total_amount'        => $order->total_amount,
                    'order_date'          => $order->order_date->format('Y-m-d H:i:s'),
                    'contact_number'      => $user ? $user->contact_number : null,
                    'delivery_address'    => $order->delivery_address,
                    'gcash_screenshot'    => $order->gcash_screenshot
                        ? asset('storage/' . $order->gcash_screenshot)
                        : null,
                    'gcash_resubmit_count' => $order->gcash_resubmit_count ?? 0,
                    'gcash_rejected_count' => $order->gcash_rejected_count ?? 0,
                    'gcash_flagged'        => (bool) ($order->gcash_flagged ?? false),
                    'customer_is_blocked'  => $user ? (bool) $user->is_blocked : false,
                    'order_items'          => $order->orderItems->map(fn ($item) => [
                        'product_name' => $item->product->product_name ?? 'Unknown product',
                        'quantity'     => $item->quantity,
                    ]),
                ];
            });

        return response()->json($orders);
    }

    public function confirmGcashPayment($id)
    {
        $order = Order::where('order_id', $id)
            ->where('payment_method', 'GCash')
            ->where('payment_status', 'Awaiting Verification')
            ->firstOrFail();

        $order->update([
            'payment_status'  => 'Paid',
            'approval_status' => 'approved',
            // POS walk-in sales are already handed over at the counter, so
            // confirming their proof shouldn't reopen them into prep/delivery.
            'status'          => $order->order_type === 'pos' ? $order->status : 'Processing',
            'approved_by'     => Auth::id(),
            'approved_at'     => now(),
        ]);

        return response()->json(['success' => true]);
    }

    public function rejectGcashPayment($id)
    {
        $order = Order::where('order_id', $id)
            ->where('payment_method', 'GCash')
            ->where('payment_status', 'Awaiting Verification')
            ->firstOrFail();

        $newRejectedCount = ($order->gcash_rejected_count ?? 0) + 1;
        $shouldFlag = $newRejectedCount >= 3;

        // Keep gcash_screenshot so the customer knows it was reviewed and rejected (not just unsubmitted)
        $order->update([
            'payment_status' => 'Unpaid',
            'gcash_rejected_count' => $newRejectedCount,
            'gcash_rejected_at' => now(),
            'gcash_flagged' => $shouldFlag,
        ]);

        return response()->json([
            'success' => true,
            'flagged' => $shouldFlag,
            'rejected_count' => $newRejectedCount,
        ]);
    }

    public function getCodPendingOrders()
    {
        // Same guard as getGcashPendingOrders() — a rejected/cancelled order's
        // leftover 'Awaiting Verification' payment_status shouldn't keep it
        // showing up here.
        $orders = Order::with(['user', 'orderItems.product'])
            ->where('payment_method', 'Cash')
            ->where('order_type', 'delivery')
            ->where('payment_status', 'Awaiting Verification')
            ->where('status', '!=', 'Cancelled')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($order) {
                $user = $order->user;
                return [
                    'order_id'       => $order->order_id,
                    'user_id'        => $order->user_id,
                    'customer_name'  => $user ? $user->full_name : 'Unknown',
                    'total_amount'   => $order->total_amount,
                    'down_payment'   => $order->down_payment,
                    'order_date'     => $order->order_date->format('Y-m-d H:i:s'),
                    'contact_number'   => $user ? $user->contact_number : null,
                    'delivery_address' => $order->delivery_address,
                    'proof_image'    => $order->gcash_screenshot
                        ? asset('storage/' . $order->gcash_screenshot)
                        : null,
                    'order_items'    => $order->orderItems->map(fn ($item) => [
                        'product_name' => $item->product->product_name ?? 'Unknown product',
                        'quantity'     => $item->quantity,
                    ]),
                ];
            });

        return response()->json($orders);
    }

    public function confirmCodPayment($id)
    {
        $order = Order::where('order_id', $id)
            ->where('payment_method', 'Cash')
            ->where('order_type', 'delivery')
            ->where('payment_status', 'Awaiting Verification')
            ->firstOrFail();

        $order->update([
            'payment_status'  => 'Partial',
            'approval_status' => 'approved',
            'status'          => 'Processing',
            'approved_by'     => Auth::id(),
            'approved_at'     => now(),
        ]);

        return response()->json(['success' => true]);
    }

    public function rejectCodPayment(Request $request, $id)
    {
        $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $order = Order::where('order_id', $id)
            ->where('payment_method', 'Cash')
            ->where('order_type', 'delivery')
            ->where('payment_status', 'Awaiting Verification')
            ->firstOrFail();

        $order->update([
            'payment_status'   => 'Unpaid',
            'gcash_screenshot' => null,
            'notes'            => $request->input('reason'),
            'cod_rejected_at'  => now(),
        ]);

        return response()->json(['success' => true]);
    }

    public function blockCustomer(Request $request, $id)
    {
        $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $customer = \App\Models\User::where('id', $id)->where('role', 'Customer')->firstOrFail();

        $customer->update([
            'is_blocked' => true,
            'blocked_reason' => $request->reason,
            'blocked_at' => now(),
            'blocked_by' => Auth::id(),
        ]);

        return response()->json(['success' => true, 'message' => 'Customer blocked successfully.']);
    }

    public function unblockCustomer($id)
    {
        $customer = \App\Models\User::where('id', $id)->where('role', 'Customer')->firstOrFail();

        $customer->update([
            'is_blocked' => false,
            'blocked_reason' => null,
            'blocked_at' => null,
            'blocked_by' => null,
        ]);

        return response()->json(['success' => true, 'message' => 'Customer unblocked successfully.']);
    }
}
