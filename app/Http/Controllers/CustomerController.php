<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\Customer;
use App\Models\User;
use App\Models\Order;
use App\Models\Product;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\StockLog;
use App\Models\UserAddress;
use App\Models\DeliveryFeeSetting;
use App\Services\RefundService;
use Inertia\Inertia;
use Illuminate\Http\RedirectResponse;

class CustomerController extends Controller
{
    public function index(): \Inertia\Response|RedirectResponse
    {
        // Check if user is a customer
        if (Auth::user()->role !== 'Customer') {
            return redirect()->route('home')->with('error', 'Access denied. Customers only.');
        }

        $user = Auth::user();

        // Get customer's recent orders
        $recentOrders = Order::where('user_id', $user->id)
            ->with(['customer', 'orderItems.product'])
            ->orderBy('order_date', 'desc')
            ->take(5)
            ->get()
            ->map(function ($order) {
                return [
                    'order_id'              => $order->order_id,
                    'total_amount'          => $order->total_amount,
                    'status'                => $order->status,
                    'order_date'            => $order->order_date->format('Y-m-d H:i:s'),
                    'payment_method'        => $order->payment_method,
                    'payment_status'        => $order->payment_status,
                    'gcash_screenshot'      => $order->gcash_screenshot,
                    'gcash_resubmit_count'  => $order->gcash_resubmit_count ?? 0,
                    'gcash_rejected_count'  => $order->gcash_rejected_count ?? 0,
                    'gcash_flagged'         => (bool) ($order->gcash_flagged ?? false),
                    'order_type'            => $order->order_type,
                    'customer' => $order->customer ? [
                        'first_name' => $order->customer->first_name,
                        'last_name' => $order->customer->last_name,
                    ] : null,
                ];
            });

        // Get available products
        $products = Product::with('inventory', 'category')
            ->where('is_active', true)
            ->get()
            ->map(function ($product) {
                return [
                    'product_id' => $product->product_id,
                    'product_name' => $product->product_name,
                    'category' => $product->category ? $product->category->category_name : 'Uncategorized',
                    'description' => $product->description,
                    'unit' => $product->unit,
                    'price' => $product->price,
                    'price_per_case' => $product->price_per_case,
                    'price_per_case_cold' => $product->price_per_case_cold,
                    'price_per_bottle' => $product->price_per_bottle,
                    'image' => $product->image,
                    'current_quantity' => $product->inventory ? $product->inventory->current_quantity : 0,
                    'min_stock_level' => $product->inventory ? $product->inventory->min_stock_level : 0,
                    'is_low_stock' => $product->inventory && $product->inventory->isLowStock(),
                ];
            });

        // Get categories
        $categories = Category::all()->map(function ($category) {
            return [
                'id' => $category->category_id,
                'category_name' => $category->category_name,
            ];
        });

        // Customer stats
        $stats = [
            'totalOrders' => Order::where('user_id', $user->id)->count(),
            'pendingOrders' => Order::where('user_id', $user->id)->where('status', 'Processing')->count(),
            'completedOrders' => Order::where('user_id', $user->id)->whereIn('status', ['Completed', 'Delivered'])->count(),
            'totalSpent' => Order::where('user_id', $user->id)->whereIn('status', ['Completed', 'Delivered'])->sum('total_amount'),
        ];

        return Inertia::render('Customer/Dashboard', [
            'recentOrders' => $recentOrders,
            'products' => $products,
            'categories' => $categories,
            'stats' => $stats,
            'addresses' => $user->addresses()->orderByDesc('is_default')->orderByDesc('created_at')->get(),
            'deliveryFeeSettings' => $this->deliveryFeeSettingsPayload(),
        ]);
    }

    private function deliveryFeeSettingsPayload(): array
    {
        $settings = DeliveryFeeSetting::current();

        return [
            'in_town_fee' => (float) $settings->in_town_fee,
            'out_of_town_fee' => (float) $settings->out_of_town_fee,
            'in_town_municipality' => DeliveryFeeSetting::IN_TOWN_MUNICIPALITY,
        ];
    }

    public function cart(): \Inertia\Response
    {
        $products = Product::with('inventory', 'category')
            ->where('is_active', true)
            ->get()
            ->map(function ($product) {
                return [
                    'product_id'       => $product->product_id,
                    'product_name'     => $product->product_name,
                    'category'         => $product->category ? $product->category->category_name : 'Uncategorized',
                    'description'      => $product->description,
                    'unit'             => $product->unit,
                    'price'            => $product->price,
                    'price_per_case'   => $product->price_per_case,
                    'price_per_case_cold' => $product->price_per_case_cold,
                    'price_per_bottle' => $product->price_per_bottle,
                    'image'            => $product->image,
                    'current_quantity' => $product->inventory ? $product->inventory->current_quantity : 0,
                    'min_stock_level'  => $product->inventory ? $product->inventory->min_stock_level : 0,
                    'is_low_stock'     => $product->inventory && $product->inventory->isLowStock(),
                ];
            });

        return Inertia::render('Customer/Cart', [
            'products' => $products,
            'addresses' => Auth::user()->addresses()->orderByDesc('is_default')->orderByDesc('created_at')->get(),
            'deliveryFeeSettings' => $this->deliveryFeeSettingsPayload(),
        ]);
    }

    public function createOrder(Request $request)
    {
        $request->validate([
            'items' => 'required|array',
            'items.*.product_id' => 'required|exists:products,product_id',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        $user = Auth::user();

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
                return back()->with('error', 'Sorry, you cannot order beverages because you are still a minor. You must be 18 years old or above to order beverages.');
            }
        }

        $totalAmount = 0;

        // Calculate total and check stock
        foreach ($request->items as $item) {
            $product = Product::with('inventory')->find($item['product_id']);
            if (!$product->inventory || $product->inventory->current_quantity < $item['quantity']) {
                return back()->with('error', "Insufficient stock for {$product->product_name}");
            }
            $totalAmount += $product->price * $item['quantity'];
        }

        // Get or create customer profile for this user
        $customer = $user->customer ?? Customer::firstOrCreate(
            ['email' => $user->email],
            [
                'first_name' => $user->full_name,
                'last_name' => '',
                'phone' => $user->contact_number,
                'address' => $request->delivery_address,
                'city' => $request->delivery_city,
                'province' => $request->delivery_province,
                'postal_code' => $request->delivery_postal_code,
                'is_active' => true,
            ]
        );

        // Create order
        $order = Order::create([
            'user_id' => $user->id,
            'customer_id' => $customer->customer_id,
            'total_amount' => $totalAmount,
            'status' => 'Processing',
            'order_date' => now(),
            'delivery_address' => $request->delivery_address,
            'delivery_barangay' => $request->delivery_barangay,
            'delivery_purok' => $request->delivery_purok,
            'delivery_city' => $request->delivery_city,
            'delivery_province' => $request->delivery_province,
            'delivery_postal_code' => $request->delivery_postal_code,
            'delivery_latitude' => $request->delivery_latitude,
            'delivery_longitude' => $request->delivery_longitude,
            'payment_method' => $request->payment_method,
        ]);

        // Create order items and update stock
        foreach ($request->items as $item) {
            $product = Product::with('inventory')->find($item['product_id']);

            $order->orderItems()->create([
                'product_id' => $item['product_id'],
                'quantity' => $item['quantity'],
                'unit_price' => $product->price,
                'subtotal' => $product->price * $item['quantity'],
            ]);

            // Update stock in inventory
            if ($product->inventory) {
                $product->inventory->decrement('current_quantity', $item['quantity']);
            }
        }

        return redirect()->route('customer.dashboard')->with('success', 'Order placed successfully!');
    }

    public function uploadCodProof(Request $request, $id)
    {
        $user = Auth::user();

        $request->validate([
            'screenshot' => 'required|image|mimes:jpeg,png,jpg|max:5120',
        ]);

        $order = Order::where('order_id', $id)
            ->where('user_id', $user->id)
            ->where('payment_method', 'Cash')
            ->where('order_type', 'delivery')
            ->firstOrFail();

        if ($order->status === 'Cancelled') {
            return response()->json(['error' => 'This order has been cancelled.'], 422);
        }

        $path = $request->file('screenshot')->store('gcash_proofs', 'public');

        $order->update([
            'gcash_screenshot' => $path,
            'payment_status' => 'Awaiting Verification',
        ]);

        return response()->json(['success' => true]);
    }

    public function uploadGcashProof(Request $request, $id)
    {
        $user = Auth::user();

        // Check if the customer's account is blocked
        if ($user->is_blocked) {
            return response()->json([
                'error' => 'Your account has been blocked. You cannot submit payment proofs.',
                'blocked' => true,
            ], 403);
        }

        $request->validate([
            'screenshot' => 'required|image|mimes:jpeg,png,jpg|max:5120',
        ]);

        $order = Order::where('order_id', $id)
            ->where('user_id', $user->id)
            ->where('payment_method', 'GCash')
            ->firstOrFail();

        // Block cancelled orders
        if ($order->status === 'Cancelled') {
            return response()->json(['error' => 'This order has been cancelled.'], 422);
        }

        // Enforce max 3 resubmits
        if ($order->gcash_resubmit_count >= 3) {
            return response()->json([
                'error' => 'Maximum resubmissions reached (3/3). This order cannot accept more payment proofs.',
            ], 422);
        }

        $path = $request->file('screenshot')->store('gcash_proofs', 'public');

        $isResubmit = !is_null($order->gcash_rejected_at);

        $order->update([
            'gcash_screenshot' => $path,
            'payment_status' => 'Awaiting Verification',
            'gcash_resubmit_count' => $isResubmit ? $order->gcash_resubmit_count + 1 : $order->gcash_resubmit_count,
        ]);

        return response()->json(['success' => true]);
    }

    public function preOrders()
    {
        // This method would handle pre-orders logic
        return Inertia::render('Customer/PreOrders');
    }

    public function cancelPreOrder(Request $request, $id)
    {
        $user = Auth::user();

        $order = Order::where('order_id', $id)
            ->where('user_id', $user->id)
            ->whereIn('order_type', ['preorder', 'delivery'])
            ->with('orderItems')
            ->firstOrFail();

        if (!in_array($order->status, ['Processing', 'Pending'])) {
            return back()->with('error', 'This pre-order can no longer be cancelled.');
        }

        // Server recomputes and stamps the refund request itself — never trusts
        // a client-supplied flag, since that can't tell "customer paid" apart
        // from "cashier actually confirmed the payment was received".
        (new RefundService())->requestForCancellation($order);

        // Stock was deducted at checkout, not at delivery — give it back now that
        // the order never went out, otherwise it stays permanently missing from inventory.
        foreach ($order->orderItems as $item) {
            $inventory = Inventory::where('product_id', $item->product_id)->first();
            if ($inventory) {
                $inventory->increment('current_quantity', $item->quantity);

                StockLog::create([
                    'product_id' => $item->product_id,
                    'user_id' => $user->id,
                    'transaction_type' => 'RETURN',
                    'quantity' => $item->quantity,
                    'reference' => 'Order #' . $order->order_id,
                    'transaction_date' => now(),
                    'notes' => 'Customer cancelled pre-order',
                ]);
            }
        }

        // Otherwise a customer-cancelled order stays approval_status='pending'
        // forever (there's no 'cancelled' value in that enum), which makes it
        // look — to every query and to the admin order-details modal alike —
        // like it's still awaiting an approve/reject decision, even though
        // it's already Cancelled. Already-approved orders keep 'approved' as
        // an accurate record of what happened before the customer cancelled.
        if ($order->approval_status === 'pending') {
            $order->approval_status = 'rejected';
        }

        $order->status = 'Cancelled';
        $order->save();

        $message = $order->refund_status === 'requested'
            ? sprintf('Pre-order cancelled. A refund of ₱%s will be processed manually by our team.', number_format((float) $order->refund_amount, 2))
            : 'Pre-order cancelled successfully.';

        return back()->with('success', $message);
    }

    public function myOrders()
    {
        $user = Auth::user();

        $deliveredOrders = Order::where('user_id', $user->id)
            ->where('status', 'Delivered')
            ->whereHas('delivery', function ($q) {
                $q->where('delivery_status', 'Delivered');
            })
            ->with(['orderItems.product', 'delivery'])
            ->orderBy('order_date', 'desc')
            ->get()
            ->map(function ($order) {
                return [
                    'order_id'       => $order->order_id,
                    'total_amount'   => $order->total_amount,
                    'status'         => $order->status,
                    'order_date'     => $order->order_date->format('Y-m-d H:i:s'),
                    'order_type'     => $order->order_type ?? 'delivery',
                    'payment_status' => $order->payment_status,
                    'items'          => $order->orderItems->map(function ($item) {
                        return [
                            'product_name' => $item->product->product_name,
                            'quantity'     => $item->quantity,
                            'unit_price'   => $item->unit_price,
                            'subtotal'     => $item->subtotal,
                            'image'        => $item->product->image,
                        ];
                    }),
                ];
            });

        return Inertia::render('Customer/MyOrders', [
            'deliveredOrders' => $deliveredOrders,
        ]);
    }

    public function deliveredOrders()
    {
        $user = Auth::user();

        // Get customer's delivered and completed orders with items
        $orders = Order::where('user_id', $user->id)
            ->whereIn('status', ['Delivered', 'Completed'])
            ->with(['orderItems.product'])
            ->orderBy('order_date', 'desc')
            ->get()
            ->map(function ($order) {
                return [
                    'order_id' => $order->order_id,
                    'total_amount' => $order->total_amount,
                    'status' => $order->status,
                    'order_date' => $order->order_date->format('Y-m-d H:i:s'),
                    'order_type' => $order->order_type ?? 'delivery',
                    'payment_status' => $order->payment_status,
                    'items' => $order->orderItems->map(function ($item) {
                        return [
                            'product_name' => $item->product->product_name,
                            'quantity' => $item->quantity,
                            'unit_price' => $item->unit_price,
                            'image' => $item->product->image,
                        ];
                    }),
                ];
            });

        return Inertia::render('Customer/DeliveredOrders', [
            'orders' => $orders,
        ]);
    }

    public function showOrder($id)
    {
        $user = Auth::user();

        $order = Order::where('order_id', $id)
            ->where('user_id', $user->id)
            ->with(['orderItems.product', 'delivery'])
            ->firstOrFail();

        return Inertia::render('Customer/OrderDetail', [
            'order' => [
                'order_id' => $order->order_id,
                'order_date' => $order->order_date->format('Y-m-d H:i:s'),
                'order_type' => $order->order_type,
                'status' => $order->status,
                'approval_status' => $order->approval_status,
                'payment_method' => $order->payment_method,
                'payment_status' => $order->payment_status,
                'total_amount' => $order->total_amount,
                'down_payment' => $order->down_payment,
                'delivery_address' => $order->delivery_address,
                'delivery_barangay' => $order->delivery_barangay,
                'delivery_purok' => $order->delivery_purok,
                'delivery_city' => $order->delivery_city,
                'delivery_province' => $order->delivery_province,
                'delivery_postal_code' => $order->delivery_postal_code,
                'notes' => $order->notes,
                'items' => $order->orderItems->map(function ($item) {
                    return [
                        'product_name' => $item->product->product_name,
                        'image' => $item->product->image,
                        'quantity' => $item->quantity,
                        'unit_price' => $item->unit_price,
                        'subtotal' => $item->subtotal,
                    ];
                }),
                'delivery' => $order->delivery ? [
                    'delivery_status' => $order->delivery->delivery_status,
                    'assigned_date' => $order->delivery->assigned_date,
                    'actual_delivery_date' => $order->delivery->actual_delivery_date,
                    'rider_notes' => $order->delivery->rider_notes,
                    'proof_of_delivery' => $order->delivery->proof_of_delivery
                        ? json_decode($order->delivery->proof_of_delivery)
                        : [],
                ] : null,
            ],
        ]);
    }

    public function settings()
    {
        $user = Auth::user();

        return Inertia::render('Customer/Settings', [
            'auth' => [
                'user' => [
                    'id' => $user->id,
                    'full_name' => $user->full_name,
                    'email' => $user->email,
                    'contact_number' => $user->contact_number,
                    'birthdate' => $user->birthdate?->format('Y-m-d'),
                ],
            ],
            'addresses' => $user->addresses()->orderByDesc('is_default')->orderByDesc('created_at')->get(),
        ]);
    }

    private function addressValidationRules(): array
    {
        return [
            'label' => 'nullable|string|max:255',
            'house_no' => 'required|string|max:255',
            'street' => 'required|string|max:255',
            'barangay_name' => 'required|string|max:255',
            'municipality' => 'required|string|max:255',
            'landmark' => 'nullable|string|max:255',
            'barangay' => 'nullable|string|max:255',
            'purok' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'province' => 'nullable|string|max:255',
            'postal_code' => 'nullable|string|max:20',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'is_default' => 'nullable|boolean',
        ];
    }

    public function storeAddress(Request $request)
    {
        $data = $request->validate($this->addressValidationRules());

        $user = Auth::user();
        $makeDefault = !empty($data['is_default']) || $user->addresses()->count() === 0;

        if ($makeDefault) {
            $user->addresses()->update(['is_default' => false]);
        }

        $data['is_default'] = $makeDefault;
        $user->addresses()->create($data);

        return back()->with('success', 'Address saved successfully!');
    }

    public function updateAddress(Request $request, $id)
    {
        $data = $request->validate($this->addressValidationRules());

        $user = Auth::user();
        $address = $user->addresses()->findOrFail($id);
        $makeDefault = !empty($data['is_default']);

        if ($makeDefault) {
            $user->addresses()->where('id', '!=', $address->id)->update(['is_default' => false]);
        } else {
            $data['is_default'] = $address->is_default;
        }

        $address->update($data);

        return back()->with('success', 'Address updated successfully!');
    }

    public function destroyAddress($id)
    {
        $user = Auth::user();
        $address = $user->addresses()->findOrFail($id);
        $wasDefault = $address->is_default;
        $address->delete();

        if ($wasDefault) {
            $next = $user->addresses()->orderByDesc('created_at')->first();
            $next?->update(['is_default' => true]);
        }

        return back()->with('success', 'Address deleted successfully!');
    }

    public function setDefaultAddress($id)
    {
        $user = Auth::user();
        $address = $user->addresses()->findOrFail($id);

        $user->addresses()->where('id', '!=', $address->id)->update(['is_default' => false]);
        $address->update(['is_default' => true]);

        return back()->with('success', 'Default address updated!');
    }

    public function updateProfile(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . Auth::id(),
            'contact_number' => [
                'nullable',
                'string',
                'max:13',
                'regex:/^\+639\d{9}$/',
                'unique:users,contact_number,' . Auth::id(),
            ],
            'birthdate' => [
                'nullable',
                'date',
                'before_or_equal:' . now()->subYears(User::MINIMUM_SIGNUP_AGE)->toDateString(),
                'after_or_equal:' . User::EARLIEST_BIRTHDATE,
            ],
        ], [
            'contact_number.regex' => 'Contact number must be 10 digits after +63, starting with 9.',
            'contact_number.unique' => 'This contact number is already registered to another account.',
            'birthdate.before_or_equal' => 'You must be at least ' . User::MINIMUM_SIGNUP_AGE . ' years old.',
            'birthdate.after_or_equal' => 'Please enter a valid birthdate.',
        ]);

        $user = Auth::user();
        $user->full_name = $request->name;
        $user->email = $request->email;
        $user->contact_number = $request->contact_number;

        // Birthdate can only be set once (e.g. by a pre-existing account that
        // registered before this field existed). Once present, it's locked
        // so a customer can't edit their way past the beverage age check.
        if (!$user->birthdate && $request->filled('birthdate')) {
            $user->birthdate = $request->birthdate;
        }

        $user->save();

        return back()->with('success', 'Profile updated successfully!');
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'password' => [
                'required',
                'confirmed',
                'min:8',
                'regex:/[a-z]/',      // at least one lowercase
                'regex:/[A-Z]/',      // at least one uppercase
                'regex:/[0-9]/',      // at least one number
                'regex:/[@$!%*?&.]/',  // at least one special character
            ],
        ], [
            'password.regex' => 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&.).',
            'password.confirmed' => 'The password confirmation does not match.',
        ]);

        $user = Auth::user();

        if (!Hash::check($request->current_password, $user->password)) {
            return back()->withErrors([
                'current_password' => 'The current password is incorrect.',
            ]);
        }

        $user->password = Hash::make($request->password);
        $user->save();

        return back()->with('success', 'Password updated successfully!');
    }

    public function deleteAccount(Request $request)
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = Auth::user();

        if (!Hash::check($request->password, $user->password)) {
            return back()->withErrors([
                'password' => 'The password is incorrect.',
            ]);
        }

        // Delete user's orders
        $user->orders()->delete();

        // Delete customer record if exists
        if ($user->customer) {
            $user->customer->delete();
        }

        // Delete user
        $user->delete();

        Auth::logout();

        return redirect()->route('home')->with('success', 'Account deleted successfully.');
    }
}
