<?php

namespace App\Http\Controllers;

use App\Models\CustomerReport;
use App\Models\CustomerReportEvidence;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CustomerReportController extends Controller
{
    public function index()
    {
        $customer = Auth::user();
        $reports = CustomerReport::where('customer_id', $customer->id)
            ->with(['order', 'evidence'])
            ->orderBy('created_at', 'desc')
            ->get();

        return inertia('Customer/Reports', [
            'reports' => $reports
        ]);
    }

    public function create(Request $request, $orderId)
    {
        $order = Order::where('order_id', $orderId)
            ->where('user_id', Auth::id())
            ->with('orderItems.product')
            ->firstOrFail();

        // Check if order is delivered/completed and doesn't already have a report
        if (!in_array($order->status, ['Delivered', 'Completed'])) {
            return back()->with('error', 'Reports can only be submitted for delivered orders.');
        }

        $existingReport = CustomerReport::where('order_id', $orderId)
            ->where('customer_id', Auth::id())
            ->first();
        if ($existingReport) {
            return back()->with('error', 'A report already exists for this order.');
        }

        $validTypes = ['damaged_beverages', 'wrong_product', 'delivery_boy_issue', 'other'];
        $defaultType = in_array($request->query('report_type'), $validTypes)
            ? $request->query('report_type')
            : '';

        return inertia('Customer/CreateReport', [
            'order'       => $order,
            'defaultType' => $defaultType,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'order_id' => 'required|exists:orders,order_id',
            'description' => 'required|string|min:10|max:1000',
            'report_type' => 'required|in:damaged_beverages,wrong_product,delivery_boy_issue,other',
            'delivery_boy_name' => 'nullable|string|max:255',
            'delivery_boy_issue_details' => 'nullable|string|max:1000',
            'evidence' => 'required|array|min:1',
            'evidence.*' => 'required|file|mimes:jpeg,png,jpg,mp4,mov,avi|max:' . config('uploads.max_kilobytes'),
        ]);

        $order = Order::where('order_id', $request->order_id)
            ->where('user_id', Auth::id())
            ->firstOrFail();

        if (!in_array($order->status, ['Delivered', 'Completed'])) {
            return back()->with('error', 'Reports can only be submitted for delivered orders.');
        }

        $existingReport = CustomerReport::where('order_id', $request->order_id)->first();
        if ($existingReport) {
            return back()->with('error', 'A report already exists for this order.');
        }

        $report = CustomerReport::create([
            'order_id' => $request->order_id,
            'customer_id' => Auth::id(),
            'report_number' => CustomerReport::generateReportNumber(),
            'description' => $request->description,
            'report_type' => $request->report_type,
            'delivery_boy_name' => $request->delivery_boy_name,
            'delivery_boy_issue_details' => $request->delivery_boy_issue_details,
            'status' => 'submitted',
        ]);

        // Handle evidence uploads
        foreach ($request->file('evidence') as $file) {
            $fileType = $this->getFileType($file);
            $filePath = $file->store('customer-reports/' . $report->id, 'public');

            CustomerReportEvidence::create([
                'customer_report_id' => $report->id,
                'file_path' => $filePath,
                'file_type' => $fileType,
                'original_name' => $file->getClientOriginalName(),
                'file_size' => $file->getSize(),
            ]);
        }

        return redirect()->route('customer.reports')
            ->with('success', 'Report submitted successfully. We will review it within 24-48 hours.');
    }

    public function show($id)
    {
        $report = CustomerReport::where('id', $id)
            ->where('customer_id', Auth::id())
            ->with(['order', 'evidence', 'reviewer'])
            ->firstOrFail();

        return inertia('Customer/ReportDetails', [
            'report' => $report
        ]);
    }

    private function getFileType($file): string
    {
        $mimeType = $file->getMimeType();
        
        if (str_contains($mimeType, 'image/')) {
            return 'image';
        } elseif (str_contains($mimeType, 'video/')) {
            return 'video';
        }
        
        return 'unknown';
    }
}
