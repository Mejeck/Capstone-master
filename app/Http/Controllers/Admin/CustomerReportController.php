<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CustomerReport;
use App\Models\CustomerReportEvidence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CustomerReportController extends Controller
{
    public function index()
    {
        $reports = CustomerReport::with(['order', 'customer', 'evidence'])
            ->orderBy('created_at', 'desc')
            ->get();

        return inertia('admin/CustomerReports', [
            'reports' => $reports
        ]);
    }

    public function show($id)
    {
        $report = CustomerReport::with(['order.orderItems.product', 'customer', 'evidence', 'reviewer'])
            ->findOrFail($id);

        return inertia('admin/CustomerReportDetails', [
            'report' => $report
        ]);
    }

    public function updateStatus(Request $request, $id)
    {
        $report = CustomerReport::with('order')->findOrFail($id);

        if (!in_array($report->status, ['submitted', 'under_review'])) {
            return back()->with('error', 'This report has already been reviewed and can no longer be validated or rejected.');
        }

        // `nullable` because the form always submits rejection_reason, and
        // ConvertEmptyStringsToNull turns the blank one into null — without
        // it a validated report would 422 on a field that doesn't apply.
        $request->validate([
            'status' => 'required|in:validated,rejected',
            'admin_notes' => 'nullable|string|max:1000',
            'rejection_reason' => 'nullable|required_if:status,rejected|string|max:500',
        ]);

        // Store policy: a valid report is settled by changing the item, never
        // by a refund, so a validated report is always a replacement.
        $actionType = $request->status === 'validated' ? 'replacement' : null;
        $rejectionReason = $request->status === 'rejected' ? $request->rejection_reason : null;

        $report->update([
            'status' => $request->status,
            'admin_notes' => $request->admin_notes ?: null,
            'rejection_reason' => $rejectionReason,
            'action_type' => $actionType,
            'refund_amount' => null,
            'reviewed_at' => now(),
            'reviewed_by' => Auth::id(),
        ]);

        return back()->with('success', 'Report status updated successfully.');
    }

    public function resolve(Request $request, $id)
    {
        $request->validate([
            'resolution_notes' => 'required|string|max:1000',
        ]);

        $report = CustomerReport::findOrFail($id);

        if ($report->status !== 'validated') {
            return back()->with('error', 'Only validated reports can be marked as resolved.');
        }

        $report->update([
            'status' => 'resolved',
            'resolved_at' => now(),
            'admin_notes' => $request->resolution_notes,
        ]);

        return back()->with('success', 'Report marked as resolved.');
    }

    public function getStats()
    {
        $stats = [
            'total_reports' => CustomerReport::count(),
            'submitted' => CustomerReport::where('status', 'submitted')->count(),
            'under_review' => CustomerReport::where('status', 'under_review')->count(),
            'validated' => CustomerReport::where('status', 'validated')->count(),
            'rejected' => CustomerReport::where('status', 'rejected')->count(),
            'resolved' => CustomerReport::where('status', 'resolved')->count(),
        ];

        return response()->json($stats);
    }
}
