<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\Delivery;
use App\Models\Order;
use Inertia\Inertia;
use Illuminate\Http\RedirectResponse;

class DeliveryBoyController extends Controller
{
    public function index(): \Inertia\Response|RedirectResponse
    {
        // Check if user is a delivery boy
        if (Auth::user()->role !== 'delivery_boy') {
            return redirect()->route('home')->with('error', 'Access denied. Delivery boys only.');
        }

        return Inertia::render('DeliveryBoy/Dashboard');
    }

    public function getAssignedOrders()
    {
        $user = Auth::user();

        $deliveries = Delivery::with(['order.customer', 'order.user', 'order.orderItems.product'])
            ->where('rider_id', $user->id)
            ->whereIn('delivery_status', ['Pending', 'Out for Delivery'])
            ->orderBy('assigned_date', 'desc')
            ->get();

        return response()->json($deliveries);
    }

    public function getCompletedDeliveries()
    {
        $user = Auth::user();
        $deliveries = Delivery::with(['order.customer', 'order.user', 'order.orderItems.product'])
            ->where('rider_id', $user->id)
            ->whereIn('delivery_status', ['Delivered', 'Failed', 'Cancelled'])
            ->orderBy('assigned_date', 'desc')
            ->get();

        return response()->json($deliveries);
    }

    public function updateDeliveryStatus(Request $request, $id)
    {
        try {
            $deliveryStatus = $request->delivery_status;

            if (!$deliveryStatus) {
                return response()->json(['error' => 'Delivery status is required'], 422);
            }

            $delivery = Delivery::find($id);

            if (!$delivery) {
                return response()->json(['error' => 'Delivery not found'], 404);
            }

            if ($delivery->rider_id !== Auth::id()) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            // Validate status transition
            if (!$this->isValidStatusTransition($delivery->delivery_status, $deliveryStatus)) {
                return response()->json([
                    'error' => "Invalid status transition from '{$delivery->delivery_status}' to '{$deliveryStatus}'"
                ], 400);
            }

            // Update delivery status
            $delivery->delivery_status = $deliveryStatus;

            // Save collected_amount if provided
            if ($request->has('collected_amount') && $request->collected_amount !== null) {
                $delivery->collected_amount = $request->collected_amount;
            }

            // Save rider_notes if provided
            if ($request->has('rider_notes') && $request->rider_notes) {
                $delivery->rider_notes = $request->rider_notes;
            }

            // Handle proof of delivery photos
            if ($request->hasFile('photos')) {
                // Unlike every other upload endpoint in this app, this one had
                // no type/size validation, so any file type/size could be
                // stored to the public disk. Match the validation used
                // elsewhere (e.g. CustomerController's payment screenshots).
                $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
                    'photos.*' => 'image|mimes:jpeg,png,jpg|max:5120',
                ]);

                if ($validator->fails()) {
                    return response()->json(['error' => $validator->errors()->first()], 422);
                }

                $photoPaths = [];
                foreach ($request->file('photos') as $photo) {
                    $path = $photo->store('delivery_photos', 'public');
                    $photoPaths[] = $path;
                }
                $delivery->proof_of_delivery = json_encode($photoPaths);
            }

            // Update order status if needed
            if ($deliveryStatus === 'Out for Delivery') {
                $order = Order::find($delivery->order_id);
                if ($order) {
                    $this->createOrderStatusNotification($order, 'Out for Delivery', $delivery->assigned_by);
                }
            } elseif ($deliveryStatus === 'Delivered') {
                $delivery->actual_delivery_date = now();
                $order = Order::find($delivery->order_id);
                if ($order) {
                    $order->status = 'Delivered';
                    $order->payment_status = 'Paid';
                    $order->save();
                    $this->createOrderStatusNotification($order, 'Delivered', $delivery->assigned_by);
                }
            } elseif ($deliveryStatus === 'Failed') {
                $order = null;
                \DB::transaction(function () use ($delivery, &$order) {
                    $order = Order::with('orderItems.product.inventory')->find($delivery->order_id);
                    if ($order) {
                        $order->status = 'Processing';
                        $order->save();
                        foreach ($order->orderItems as $item) {
                            $inventory = \App\Models\Inventory::where('product_id', $item->product_id)
                                ->lockForUpdate()
                                ->first();
                            if ($inventory) {
                                $inventory->increment('current_quantity', $item->quantity);
                            }
                        }
                    }
                });
            }

            $delivery->save();

            // Create delivery issue report if issues were reported
            if ($request->has('delivery_issues') && $deliveryStatus === 'Delivered') {
                $this->createDeliveryIssueReport($delivery, $request);
            }

            return response()->json([
                'message' => 'Delivery status updated successfully',
                'delivery_status' => $delivery->delivery_status
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Server error: ' . $e->getMessage()], 500);
        }
    }

    private function createDeliveryIssueReport($delivery, $request)
    {
        // Create a customer report for delivery issues
        $reportType = $this->mapDeliveryIssuesToReportType($request->delivery_issues);
        
        $report = new \App\Models\CustomerReport();
        $report->order_id = $delivery->order_id;
        $report->description = $request->issue_details;
        $report->report_type = $reportType;
        $report->status = 'submitted';
        $report->delivery_boy_name = Auth::user()->full_name;
        $report->delivery_boy_issue_details = 'Issues reported during delivery: ' . implode(', ', $request->delivery_issues);
        $report->created_at = now();
        $report->updated_at = now();
        
        // Save the report
        $report->save();

        // Attach delivery photos as evidence if available
        if ($delivery->proof_of_delivery) {
            $photoPaths = json_decode($delivery->proof_of_delivery);
            foreach ($photoPaths as $photoPath) {
                $evidence = new \App\Models\CustomerReportEvidence();
                $evidence->report_id = $report->id;
                $evidence->file_type = 'image';
                $evidence->original_name = basename($photoPath);
                $evidence->file_path = $photoPath;
                $evidence->file_size = \Illuminate\Support\Facades\Storage::disk('public')->size($photoPath);
                $evidence->save();
            }
        }
    }

    private function createOrderStatusNotification($order, $status, $assignedBy = null)
    {
        try {
            // Notify customer
            if ($order->user_id) {
                $customerMsg = $status === 'Out for Delivery'
                    ? "Your order #{$order->order_id} is now out for delivery! The rider is on the way to your location."
                    : "Your order #{$order->order_id} has been successfully delivered! Thank you for your order.";

                $notification = new \App\Models\Notification();
                $notification->user_id = $order->user_id;
                $notification->title = 'Order Status Update';
                $notification->message = $customerMsg;
                $notification->type = 'order_status';
                $notification->data = json_encode(['order_id' => $order->order_id, 'status' => $status, 'total_amount' => $order->total_amount]);
                $notification->read = false;
                $notification->created_at = now();
                $notification->updated_at = now();
                $notification->save();
            }

            // Notify cashier (the one who assigned this delivery)
            if ($assignedBy) {
                $cashierMsg = $status === 'Out for Delivery'
                    ? "Rider started delivery for Order #{$order->order_id}."
                    : "Order #{$order->order_id} has been delivered successfully.";

                $cashierNotif = new \App\Models\Notification();
                $cashierNotif->user_id = $assignedBy;
                $cashierNotif->title = 'Delivery Update';
                $cashierNotif->message = $cashierMsg;
                $cashierNotif->type = 'order_status';
                $cashierNotif->data = json_encode(['order_id' => $order->order_id, 'status' => $status]);
                $cashierNotif->read = false;
                $cashierNotif->created_at = now();
                $cashierNotif->updated_at = now();
                $cashierNotif->save();
            }
        } catch (\Exception $e) {
            \Log::error('Failed to create notification: ' . $e->getMessage());
        }
    }

    private function isValidStatusTransition($oldStatus, $newStatus)
    {
        // Define valid status transitions
        $validTransitions = [
            'Pending' => ['Out for Delivery', 'Cancelled'],
            'Out for Delivery' => ['Delivered', 'Failed', 'Cancelled'],
            'Delivered' => [], // Terminal state
            'Failed' => [], // Terminal state
            'Cancelled' => [], // Terminal state
        ];

        return in_array($newStatus, $validTransitions[$oldStatus] ?? []);
    }

    private function getValidTransitions($oldStatus)
    {
        $validTransitions = [
            'Pending' => ['Out for Delivery', 'Cancelled'],
            'Out for Delivery' => ['Delivered', 'Failed', 'Cancelled'],
            'Delivered' => [], // Terminal state
            'Failed' => [], // Terminal state
            'Cancelled' => [], // Terminal state
        ];

        return $validTransitions[$oldStatus] ?? [];
    }

    private function mapDeliveryIssuesToReportType($issues)
    {
        // Map delivery issues to customer report types
        if (in_array('damaged_items', $issues)) {
            return 'damaged_beverages';
        } elseif (in_array('wrong_items', $issues)) {
            return 'wrong_product';
        } elseif (in_array('missing_items', $issues)) {
            return 'missing_items';
        } else {
            return 'other';
        }
    }

    public function settings(): \Inertia\Response|RedirectResponse
    {
        if (Auth::user()->role !== 'delivery_boy') {
            return redirect()->route('home')->with('error', 'Access denied.');
        }

        return Inertia::render('DeliveryBoy/Settings');
    }

    public function updateProfile(Request $request)
    {
        if (Auth::user()->role !== 'delivery_boy') {
            return redirect()->route('home')->with('error', 'Access denied.');
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . Auth::id(),
            'contact_number' => [
                'required',
                'string',
                'max:13',
                'regex:/^\+639\d{9}$/',
                'unique:users,contact_number,' . Auth::id(),
            ],
        ], [
            'contact_number.required' => 'Contact number is required — customers and the store need a way to reach you on a delivery.',
            'contact_number.regex' => 'Contact number must be 10 digits after +63, starting with 9.',
            'contact_number.unique' => 'This contact number is already registered to another account.',
        ]);

        $user = Auth::user();
        $user->full_name = $request->name;
        $user->email = $request->email;
        $user->contact_number = $request->contact_number;
        $user->save();

        return back()->with('success', 'Profile updated successfully!');
    }

    public function updatePassword(Request $request)
    {
        if (Auth::user()->role !== 'delivery_boy') {
            return redirect()->route('home')->with('error', 'Access denied.');
        }

        $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
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
}
