<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Delivery;
use App\Models\Inventory;
use App\Models\User;
use App\Models\Customer;
use App\Models\DeliveryFeeSetting;

class OrderController extends Controller
{
    // Delivery orders only: minimum order total that makes a delivery trip worth dispatching.
    const MIN_DELIVERY_ORDER_AMOUNT = 200;

    public function index()
    {
        $orders = Order::with(['customer', 'orderItems.product', 'delivery.rider'])
            ->orderBy('order_date', 'desc')
            ->get();

        return response()->json($orders);
    }

    public function store(Request $request)
    {
        $validator = \Validator::make($request->all(), [
            'items' => 'required|array',
            'items.*.product_id' => 'required|exists:products,product_id,is_active,1',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.is_cold' => 'nullable|boolean',
            'payment_method' => 'required|in:Cash,GCash',
            'order_type' => 'required|in:preorder,delivery,pickup,walkin',
            'delivery_address' => 'required_if:order_type,delivery|nullable|string',
            'delivery_municipality' => 'required_if:order_type,delivery|nullable|string',
            'delivery_landmark' => 'nullable|string',
            'delivery_remarks' => 'nullable|string|max:500',
            'delivery_barangay' => 'nullable|string',
            'delivery_purok' => 'nullable|string',
            'delivery_city' => 'nullable|string',
            'delivery_province' => 'nullable|string',
            'delivery_postal_code' => 'nullable|string',
            'delivery_latitude' => 'nullable|numeric',
            'delivery_longitude' => 'nullable|numeric',
            'down_payment' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Validation failed',
                'messages' => $validator->errors()->all(),
                'data' => $request->all()
            ], 400);
        }

        $user = Auth::user();

        // Check if customer account is blocked
        if ($user->is_blocked) {
            return response()->json([
                'error' => 'Your account has been blocked. Please contact the store for assistance.',
                'blocked' => true,
            ], 403);
        }

        // Beverages are age-restricted: block the order if the customer hasn't
        // shown (via their registered birthdate) that they're 18 or older.
        if (!$user->is_adult) {
            $orderedProducts = Product::with('category')
                ->whereIn('product_id', collect($request->items)->pluck('product_id'))
                ->get();

            $hasBeverage = $orderedProducts->contains(
                fn ($product) => $product->category && $product->category->category_name === 'Beverages'
            );

            if ($hasBeverage) {
                return response()->json([
                    'error' => 'Sorry, you cannot order beverages because you are still a minor. You must be 18 years old or above to order beverages.',
                ], 403);
            }
        }

        $totalAmount = 0;
        $isDelivery = $request->order_type === 'delivery';

        // Check stock availability and calculate total
        foreach ($request->items as $item) {
            $product = Product::with('inventory')->find($item['product_id']);
            $unitType = $item['unit_type'] ?? 'kilo';

            if (!$product->inventory || $product->inventory->current_quantity < $item['quantity']) {
                return response()->json([
                    'error' => "Insufficient stock for {$product->product_name}. Available: " . ($product->inventory->current_quantity ?? 0)
                ], 400);
            }
            $isCold = $unitType === 'case' && !empty($item['is_cold']) && $product->price_per_case_cold;
            if ($isCold) {
                $unitPrice = $product->price_per_case_cold;
            } elseif ($unitType === 'case' && $product->price_per_case) {
                $unitPrice = $product->price_per_case;
            } elseif ($unitType === 'bottle' && $product->price_per_bottle) {
                $unitPrice = $product->price_per_bottle;
            } else {
                $unitPrice = $product->price;
            }
            $totalAmount += $unitPrice * $item['quantity'];
        }

        if ($isDelivery && $totalAmount < self::MIN_DELIVERY_ORDER_AMOUNT) {
            return response()->json([
                'error' => "Minimum order for delivery is ₱" . self::MIN_DELIVERY_ORDER_AMOUNT . ". Your current order total is ₱{$totalAmount}."
            ], 400);
        }

        $deliveryFee = $isDelivery ? DeliveryFeeSetting::feeFor($request->delivery_municipality) : 0;

        // Determine status and approval based on order type
        if ($request->order_type === 'walkin') {
            $status = 'Completed';
            $approvalStatus = 'approved';
        } else {
            // All other orders require admin approval first
            $status = 'Pending';
            $approvalStatus = 'pending';
        }

        // Validate down payment for pre-orders (minimum 50%)
        $downPayment = $request->down_payment ?? 0;

        if ($request->order_type === 'preorder') {
            $minimumDownPayment = $totalAmount * 0.5; // 50% of total

            if ($downPayment < $minimumDownPayment) {
                return response()->json([
                    'error' => "Down payment must be at least 50% of total amount (₱{$minimumDownPayment}). Your down payment: ₱{$downPayment}"
                ], 400);
            }
        }

        // Validate payment for delivery and pickup orders
        if (in_array($request->order_type, ['delivery', 'pickup'])) {
            if ($request->payment_method === 'GCash') {
                // GCash requires full payment upfront
                if ($downPayment < $totalAmount) {
                    return response()->json([
                        'error' => "For GCash payment, full payment is required. Total: ₱{$totalAmount}, Your payment: ₱{$downPayment}"
                    ], 400);
                }
            } elseif ($request->payment_method === 'Cash') {
                // Cash on delivery/pickup requires at least 20% down payment
                $minimumDownPayment = $totalAmount * 0.2;
                if ($downPayment < $minimumDownPayment) {
                    return response()->json([
                        'error' => "For Cash payment, minimum 20% down payment is required. Total: ₱{$totalAmount}, Minimum: ₱{$minimumDownPayment}, Your payment: ₱{$downPayment}"
                    ], 400);
                }
            }
        }

        // Determine payment status
        if ($request->order_type === 'walkin') {
            // GCash walk-in requires cashier to verify screenshot before marking as Paid
            $paymentStatus = ($request->payment_method === 'GCash') ? 'Unpaid' : 'Paid';
        } elseif (in_array($request->order_type, ['preorder', 'delivery', 'pickup']) && $downPayment > 0) {
            $paymentStatus = 'Partial';
        } else {
            $paymentStatus = 'Unpaid';
        }

        // Get or create customer profile for this user
        $customer = $user->customer ?? Customer::firstOrCreate(
            ['email' => $user->email],
            [
                'full_name' => $user->full_name,
                'first_name' => $user->full_name,
                'last_name' => '',
                'phone' => $user->contact_number,
                'contact_number' => $user->contact_number,
                'address' => $request->delivery_address ?? '',
                'city' => $request->delivery_city ?? '',
                'province' => $request->delivery_province ?? '',
                'postal_code' => $request->delivery_postal_code ?? '',
                'is_active' => true,
            ]
        );

        try {
            $order = DB::transaction(function () use ($request, $user, $customer, $totalAmount, $deliveryFee, $status, $paymentStatus, $downPayment, $approvalStatus, $isDelivery) {
                // Create order
                $order = Order::create([
                    'user_id' => $user->id,
                    'customer_id' => $customer->customer_id,
                    'total_amount' => $totalAmount,
                    'delivery_fee' => $deliveryFee,
                    'overall_total' => $totalAmount + $deliveryFee,
                    'status' => $status,
                    'payment_method' => $request->payment_method,
                    'payment_status' => $paymentStatus,
                    'down_payment' => $downPayment,
                    'approval_status' => $approvalStatus,
                    'order_type' => $request->order_type,
                    'delivery_address' => in_array($request->order_type, ['preorder', 'delivery']) ? $request->delivery_address : null,
                    'delivery_municipality' => $isDelivery ? $request->delivery_municipality : null,
                    'delivery_landmark' => in_array($request->order_type, ['preorder', 'delivery']) ? $request->delivery_landmark : null,
                    'delivery_remarks' => in_array($request->order_type, ['preorder', 'delivery']) ? $request->delivery_remarks : null,
                    'delivery_barangay' => $request->delivery_barangay,
                    'delivery_purok' => $request->delivery_purok,
                    'delivery_city' => in_array($request->order_type, ['preorder', 'delivery']) ? $request->delivery_city : null,
                    'delivery_province' => in_array($request->order_type, ['preorder', 'delivery']) ? $request->delivery_province : null,
                    'delivery_postal_code' => $request->delivery_postal_code,
                    'delivery_latitude' => $request->delivery_latitude,
                    'delivery_longitude' => $request->delivery_longitude,
                    'order_date' => now(),
                ]);

                // Create order items
                foreach ($request->items as $item) {
                    $product = Product::with('inventory')->find($item['product_id']);

                    $unitType = $item['unit_type'] ?? 'kilo';
                    $isCold = $unitType === 'case' && !empty($item['is_cold']) && $product->price_per_case_cold;
                    if ($isCold) {
                        $unitPrice = $product->price_per_case_cold;
                    } elseif ($unitType === 'case' && $product->price_per_case) {
                        $unitPrice = $product->price_per_case;
                    } elseif ($unitType === 'bottle' && $product->price_per_bottle) {
                        $unitPrice = $product->price_per_bottle;
                    } else {
                        $unitPrice = $product->price;
                    }

                    $order->orderItems()->create([
                        'product_id' => $item['product_id'],
                        'quantity' => $item['quantity'],
                        'unit_price' => $unitPrice,
                        'subtotal' => $unitPrice * $item['quantity'],
                    ]);

                    // Walk-in orders are created already Completed/approved with no
                    // separate confirmation step, so their stock must move now. Every
                    // other order type starts Pending and only actually reserves stock
                    // once it's confirmed (admin/cashier approval, or the customer's
                    // own pre-order checkout) — decrementing here too would double-count.
                    if ($request->order_type === 'walkin') {
                        // Re-check under a row lock: the earlier stock check ran
                        // outside any lock, so a concurrent order could have
                        // already consumed the stock we thought was available.
                        $inventory = Inventory::where('product_id', $item['product_id'])
                            ->lockForUpdate()
                            ->first();

                        if (!$inventory || $inventory->current_quantity < $item['quantity']) {
                            throw new \RuntimeException("Insufficient stock for {$product->product_name}.");
                        }

                        $inventory->decrement('current_quantity', $item['quantity']);
                    }
                }

                return $order;
            });
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }

        return response()->json([
            'message' => 'Order placed successfully',
            'order' => $order->load('orderItems.product')
        ], 201);
    }

    public function show($id)
    {
        $order = Order::with(['customer', 'orderItems.product', 'delivery.rider'])
            ->find($id);

        if (!$order) {
            return response()->json(['error' => 'Order not found'], 404);
        }

        return response()->json($order);
    }

    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:Pending,Processing,Completed,Delivered,Cancelled',
        ]);

        $order = Order::find($id);

        if (!$order) {
            return response()->json(['error' => 'Order not found'], 404);
        }

        $order->status = $request->status;
        $order->save();

        return response()->json([
            'message' => 'Order status updated successfully',
            'order' => $order
        ]);
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

        $wasStatusPending = $order->status === 'Pending';

        DB::transaction(function () use ($order, $wasStatusPending) {
            $order->approval_status = 'approved';
            $order->status = 'Processing';
            $order->save();

            // Deduct stock from inventory only when transitioning from Pending
            if ($wasStatusPending) {
                foreach ($order->orderItems as $item) {
                    $inventory = \App\Models\Inventory::where('product_id', $item->product_id)
                        ->lockForUpdate()
                        ->first();
                    if ($inventory) {
                        $inventory->decrement('current_quantity', $item->quantity);
                    }
                }
            }
        });

        return response()->json([
            'message' => 'Order approved successfully',
            'order' => $order->load('orderItems.product')
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
        $order->save();

        // Refund down payment if any (in a real system, this would process a refund)
        if ($order->down_payment > 0) {
            // In a real implementation, this would trigger a refund process
            // For now, we just log it
        }

        return response()->json([
            'message' => 'Order rejected successfully',
            'order' => $order->load('orderItems.product')
        ]);
    }

    public function acceptOrder($id)
    {
        $order = Order::find($id);

        if (!$order) {
            return response()->json(['error' => 'Order not found'], 404);
        }

        if ($order->status !== 'Pending') {
            return response()->json(['error' => 'Order can only be accepted when status is Pending'], 400);
        }

        DB::transaction(function () use ($order) {
            $order->status = 'Processing';
            $order->payment_status = 'Paid';
            $order->save();

            // Deduct stock from inventory with pessimistic lock
            foreach ($order->orderItems as $item) {
                $inventory = \App\Models\Inventory::where('product_id', $item->product_id)
                    ->lockForUpdate()
                    ->first();
                if ($inventory) {
                    $inventory->decrement('current_quantity', $item->quantity);
                }
            }
        });

        return response()->json([
            'message' => 'Order accepted successfully',
            'order' => $order->load('orderItems.product')
        ]);
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

        if ($order->status !== 'Processing') {
            return response()->json(['error' => 'Order must be in Processing status to assign delivery. Current status: ' . $order->status], 400);
        }

        if ($order->approval_status !== 'approved') {
            return response()->json(['error' => 'Order must be approved before assigning delivery'], 400);
        }

        // Check if delivery already exists
        if ($order->delivery && $order->delivery->delivery_status !== 'Failed') {
            return response()->json(['error' => 'Delivery already assigned for this order'], 400);
        }

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

        // Keep order status as Processing so delivery boy can see it
        // The delivery status will track the delivery progress
        $order->save();

        return response()->json([
            'message' => 'Delivery assigned successfully',
            'delivery' => $delivery->load('rider', 'order')
        ]);
    }

    public function updateDeliveryStatus(Request $request, $id)
    {
        $request->validate([
            'delivery_status' => 'required|in:Pending,Out for Delivery,Delivered,Failed',
            'collected_amount' => 'nullable|numeric',
            'rider_notes' => 'nullable|string',
        ]);

        $delivery = Delivery::with('order')->find($id);

        if (!$delivery) {
            return response()->json(['error' => 'Delivery not found'], 404);
        }

        // Validate status transitions
        $currentStatus = $delivery->delivery_status;
        $newStatus = $request->delivery_status;

        $validTransitions = [
            'Pending' => ['Out for Delivery', 'Failed'],
            'Out for Delivery' => ['Delivered', 'Failed'],
            'Failed' => ['Pending'], // Allow retry
            'Delivered' => [], // Cannot change from Delivered
        ];

        if (!in_array($newStatus, $validTransitions[$currentStatus] ?? [])) {
            return response()->json(['error' => "Invalid status transition from {$currentStatus} to {$newStatus}"], 400);
        }

        $delivery->delivery_status = $newStatus;
        $delivery->collected_amount = $request->collected_amount ?? $delivery->collected_amount;
        $delivery->rider_notes = $request->rider_notes ?? $delivery->rider_notes;

        if ($newStatus === 'Delivered') {
            $delivery->actual_delivery_date = now();
            $delivery->order->status = 'Delivered';

            // If collected amount matches or exceeds total, mark as paid
            $totalAmount = $delivery->order->total_amount;
            $collectedAmount = $request->collected_amount ?? 0;

            if ($collectedAmount >= $totalAmount) {
                $delivery->order->payment_status = 'Paid';
            } elseif ($delivery->order->payment_status === 'Partial' && $collectedAmount > 0) {
                // Keep as Partial if down payment was made
                $delivery->order->payment_status = 'Partial';
            }
            $delivery->order->save();
        } elseif ($newStatus === 'Failed') {
            DB::transaction(function () use ($delivery) {
                // Reset order status to Processing for reassignment
                $delivery->order->status = 'Processing';
                $delivery->order->save();

                // Restore inventory that was deducted when the order was approved
                foreach ($delivery->order->orderItems as $item) {
                    $inventory = \App\Models\Inventory::where('product_id', $item->product_id)
                        ->lockForUpdate()
                        ->first();
                    if ($inventory) {
                        $inventory->increment('current_quantity', $item->quantity);
                    }
                }
            });
        }

        $delivery->save();

        return response()->json([
            'message' => 'Delivery status updated successfully',
            'delivery' => $delivery->load('order', 'rider')
        ]);
    }

    public function getPendingOrders()
    {
        $orders = Order::with(['customer', 'orderItems.product'])
            ->where('status', 'Pending')
            ->orderBy('order_date', 'desc')
            ->get();

        return response()->json($orders);
    }

    public function getProcessingOrders()
    {
        $orders = Order::with(['customer', 'orderItems.product', 'delivery.rider'])
            ->where('status', 'Processing')
            ->where('approval_status', 'approved')
            ->orderBy('order_date', 'desc')
            ->get();

        return response()->json($orders);
    }

    public function getDeliveredOrders()
    {
        $orders = Order::with(['customer', 'orderItems.product', 'delivery.rider'])
            ->where('status', 'Delivered')
            ->orderBy('order_date', 'desc')
            ->get();

        return response()->json($orders);
    }

    public function getCompletedOrders()
    {
        $orders = Order::with(['customer', 'orderItems.product', 'delivery.rider'])
            ->where('status', 'Completed')
            ->orderBy('order_date', 'desc')
            ->get();

        return response()->json($orders);
    }

    public function getRiderOrders($riderId)
    {
        $deliveries = Delivery::with(['order.customer', 'order.orderItems.product'])
            ->where('rider_id', $riderId)
            ->whereIn('delivery_status', ['Pending', 'Out for Delivery'])
            ->orderBy('assigned_date', 'desc')
            ->get();

        return response()->json($deliveries);
    }

    public function getCustomerOrders()
    {
        $user = Auth::user();
        $orders = Order::with(['orderItems.product', 'delivery.rider'])
            ->where('user_id', $user->id)
            ->orderBy('order_date', 'desc')
            ->get();

        return response()->json($orders);
    }

    public function checkoutPreOrder(Request $request, $id)
    {
        $order = Order::find($id);

        if (!$order) {
            return response()->json(['error' => 'Order not found'], 404);
        }

        if ($order->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($order->order_type !== 'preorder') {
            return response()->json(['error' => 'This is not a pre-order'], 400);
        }

        if ($order->status !== 'Pending' && $order->status !== 'Processing') {
            return response()->json(['error' => 'Order cannot be checked out in current status'], 400);
        }

        $request->validate([
            'payment_method' => 'required|in:Cash,GCash',
            'delivery_address' => 'required|string',
            'delivery_municipality' => 'required|string',
            'delivery_barangay' => 'nullable|string',
            'delivery_purok' => 'nullable|string',
            'delivery_city' => 'required|string',
            'delivery_province' => 'required|string',
            'delivery_postal_code' => 'nullable|string',
            'delivery_latitude' => 'nullable|numeric',
            'delivery_longitude' => 'nullable|numeric',
        ]);

        $deliveryFee = DeliveryFeeSetting::feeFor($request->delivery_municipality);

        DB::transaction(function () use ($order, $request, $deliveryFee) {
            // An admin/cashier may have already approved this pre-order (which
            // already decremented stock) before the customer got to checkout;
            // only reserve stock here if that hasn't happened yet.
            $wasAlreadyApproved = $order->approval_status === 'approved';

            $order->payment_method = $request->payment_method;
            $order->delivery_address = $request->delivery_address;
            $order->delivery_municipality = $request->delivery_municipality;
            $order->delivery_barangay = $request->delivery_barangay;
            $order->delivery_purok = $request->delivery_purok;
            $order->delivery_city = $request->delivery_city;
            $order->delivery_province = $request->delivery_province;
            $order->delivery_postal_code = $request->delivery_postal_code;
            $order->delivery_latitude = $request->delivery_latitude;
            $order->delivery_longitude = $request->delivery_longitude;
            $order->delivery_fee = $deliveryFee;
            $order->overall_total = $order->total_amount + $deliveryFee;
            $order->status = 'Processing';
            $order->approval_status = 'approved';
            $order->save();

            if (!$wasAlreadyApproved) {
                // Deduct stock from inventory with pessimistic lock
                foreach ($order->orderItems as $item) {
                    $inventory = \App\Models\Inventory::where('product_id', $item->product_id)
                        ->lockForUpdate()
                        ->first();
                    if ($inventory) {
                        $inventory->decrement('current_quantity', $item->quantity);
                    }
                }
            }
        });

        return response()->json([
            'message' => 'Pre-order checkout successful',
            'order' => $order->load('orderItems.product')
        ]);
    }

    public function getDeliveryBoys()
    {
        $deliveryBoys = User::where('role', 'delivery_boy')
            ->select(['id', 'full_name', 'email', 'contact_number'])
            ->get();

        return response()->json($deliveryBoys);
    }

    public function getAssignedOrders()
    {
        $user = Auth::user();
        $deliveries = Delivery::with(['order.customer', 'order.orderItems.product', 'order.user'])
            ->where('rider_id', $user->id)
            ->whereIn('delivery_status', ['Pending', 'Out for Delivery'])
            ->orderBy('assigned_date', 'desc')
            ->get();

        return response()->json($deliveries);
    }

    public function getCompletedDeliveries()
    {
        $user = Auth::user();
        $deliveries = Delivery::with(['order.customer', 'order.orderItems.product', 'order.user'])
            ->where('rider_id', $user->id)
            ->whereIn('delivery_status', ['Delivered', 'Failed'])
            ->orderBy('assigned_date', 'desc')
            ->get();

        return response()->json($deliveries);
    }

    public function markAsSuccessful($id)
    {
        $order = Order::with('delivery')->find($id);

        if (!$order) {
            return response()->json(['error' => 'Order not found'], 404);
        }

        if ($order->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($order->status !== 'Delivered') {
            return response()->json(['error' => 'Order can only be marked as successful when status is Delivered. Current status: ' . $order->status], 400);
        }

        // Update order status to Completed
        $order->status = 'Completed';
        $order->payment_status = 'Paid';
        $order->save();

        return response()->json([
            'message' => 'Order marked as successful successfully',
            'order' => $order->load('orderItems.product', 'delivery.rider')
        ]);
    }

    public function confirmPayment(Request $request, $id)
    {
        $order = Order::find($id);

        if (!$order) {
            return response()->json(['error' => 'Order not found'], 404);
        }

        $request->validate([
            'payment_status' => 'required|in:Paid,Partial,Unpaid',
            'amount' => 'nullable|numeric|min:0',
        ]);

        // Update payment status
        $order->payment_status = $request->payment_status;

        // If payment is confirmed as Paid and order is Delivered, auto-complete
        if ($request->payment_status === 'Paid' && $order->status === 'Delivered') {
            $order->status = 'Completed';
        }

        $order->save();

        return response()->json([
            'message' => 'Payment status updated successfully',
            'order' => $order->load('orderItems.product', 'delivery.rider')
        ]);
    }
}
