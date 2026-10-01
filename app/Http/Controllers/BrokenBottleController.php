<?php

namespace App\Http\Controllers;

use App\Models\BrokenBottle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class BrokenBottleController extends Controller
{
    public function index()
    {
        $brokenBottles = BrokenBottle::with('reporter')
            ->orderBy('report_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        $this->resolveImageUrls($brokenBottles);

        return response()->json($brokenBottles);
    }

    public function store(Request $request)
    {
        $request->validate([
            'beverage_type' => 'required|in:Red Horse,San Mig Light,San Mig Apple,San Mig Pilsen',
            'quantity' => 'required|integer|min:1',
            'unit_type' => 'required|in:bottle,case',
            'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:' . config('uploads.max_kilobytes'),
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imagePath = $image->store('broken-bottles', 'public');
        }

        $brokenBottle = BrokenBottle::create([
            'beverage_type' => $request->beverage_type,
            'quantity' => $request->quantity,
            'unit_type' => $request->unit_type,
            'reported_by' => Auth::id(),
            'image_path' => $imagePath,
            'report_date' => now(),
        ]);

        return response()->json([
            'message' => 'Broken bottle reported successfully',
            'broken_bottle' => $brokenBottle->load('reporter')
        ], 201);
    }

    public function destroy($id)
    {
        $brokenBottle = BrokenBottle::find($id);

        if (!$brokenBottle) {
            return response()->json(['error' => 'Record not found'], 404);
        }

        // Delete image file if exists
        if ($brokenBottle->image_path && Storage::disk('public')->exists($brokenBottle->image_path)) {
            Storage::disk('public')->delete($brokenBottle->image_path);
        }

        $brokenBottle->delete();

        return response()->json([
            'message' => 'Record deleted successfully'
        ]);
    }

    public function getStats()
    {
        $stats = BrokenBottle::selectRaw('
            beverage_type,
            SUM(quantity) as total_quantity,
            COUNT(*) as report_count
        ')
        ->groupBy('beverage_type')
        ->get();

        $totalBroken = BrokenBottle::sum('quantity');
        $totalReports = BrokenBottle::count();

        return response()->json([
            'by_type' => $stats,
            'total_broken' => $totalBroken,
            'total_reports' => $totalReports,
        ]);
    }

    public function getReports(Request $request)
    {
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');

        $query = BrokenBottle::with('reporter')
            ->orderBy('report_date', 'desc')
            ->orderBy('created_at', 'desc');

        if ($startDate && $endDate) {
            $query->whereBetween('report_date', [
                \Carbon\Carbon::parse($startDate)->startOfDay(),
                \Carbon\Carbon::parse($endDate)->endOfDay()
            ]);
        }

        $brokenBottles = $query->get();
        $this->resolveImageUrls($brokenBottles);

        // Group by beverage type and unit type
        $groupByType = $brokenBottles->groupBy('beverage_type');
        $groupedByUnitType = $brokenBottles->groupBy('unit_type');

        return response()->json([
            'records' => $brokenBottles,
            'by_beverage_type' => $groupByType,
            'by_unit_type' => $groupedByUnitType,
            'total_records' => $brokenBottles->count(),
        ]);
    }

    /**
     * Rewrite each record's stored disk-relative image_path (e.g. "broken-bottles/x.jpg")
     * into the public URL the frontend can actually load (e.g. "/storage/broken-bottles/x.jpg").
     */
    private function resolveImageUrls($brokenBottles): void
    {
        $brokenBottles->each(function ($bottle) {
            if ($bottle->image_path) {
                $bottle->image_path = Storage::url($bottle->image_path);
            }
        });
    }
}
