<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Models\PurchaseOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class SupplierController extends Controller
{
    public function index(): Response
    {
        $suppliers = Supplier::withCount(['purchaseOrders', 'activePurchaseOrders'])
            ->orderBy('supplier_name')
            ->get()
            ->map(function ($supplier) {
                return [
                    'id' => $supplier->id,
                    'supplier_code' => $supplier->supplier_code,
                    'supplier_name' => $supplier->supplier_name,
                    'contact_person' => $supplier->contact_person,
                    'phone' => $supplier->phone,
                    'email' => $supplier->email,
                    'address' => $supplier->address,
                    'city' => $supplier->city,
                    'province' => $supplier->province,
                    'payment_terms' => $supplier->payment_terms,
                    'delivery_lead_time' => $supplier->delivery_lead_time,
                    'is_active' => $supplier->is_active,
                    'total_purchase_orders' => $supplier->purchase_orders_count,
                    'active_purchase_orders' => $supplier->active_purchase_orders_count,
                    'created_at' => $supplier->created_at->format('M d, Y'),
                ];
            });

        return Inertia::render('admin/suppliers', [
            'suppliers' => $suppliers,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'supplier_name' => 'required|string|max:255',
            'contact_person' => ['required', 'string', 'max:255', 'regex:/^[\p{L}\s.\'-]+$/u'],
            'phone' => 'required|string|max:20',
            'email' => 'nullable|email|max:255',
            'address' => 'required|string|max:500',
            'city' => 'required|string|max:100',
            'province' => 'required|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'payment_terms' => 'required|string|max:50',
            'delivery_lead_time' => 'required|string|max:50',
            'notes' => 'nullable|string|max:1000',
        ], [
            'contact_person.regex' => 'Contact person can only contain letters, spaces, and basic punctuation (no numbers).',
        ]);

        try {
            $supplier = Supplier::create([
                'supplier_name' => $request->supplier_name,
                'contact_person' => $request->contact_person,
                'phone' => $request->phone,
                'email' => $request->email,
                'address' => $request->address,
                'city' => $request->city,
                'province' => $request->province,
                'postal_code' => $request->postal_code,
                'payment_terms' => $request->payment_terms,
                'delivery_lead_time' => $request->delivery_lead_time,
                'notes' => $request->notes,
                'is_active' => true,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Supplier created successfully',
                'supplier' => $supplier
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error creating supplier: ' . $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, Supplier $supplier)
    {
        $request->validate([
            'supplier_name' => 'required|string|max:255',
            'contact_person' => ['required', 'string', 'max:255', 'regex:/^[\p{L}\s.\'-]+$/u'],
            'phone' => 'required|string|max:20',
            'email' => 'nullable|email|max:255',
            'address' => 'required|string|max:500',
            'city' => 'required|string|max:100',
            'province' => 'required|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'payment_terms' => 'required|string|max:50',
            'delivery_lead_time' => 'required|string|max:50',
            'notes' => 'nullable|string|max:1000',
        ], [
            'contact_person.regex' => 'Contact person can only contain letters, spaces, and basic punctuation (no numbers).',
        ]);

        try {
            $supplier->update([
                'supplier_name' => $request->supplier_name,
                'contact_person' => $request->contact_person,
                'phone' => $request->phone,
                'email' => $request->email,
                'address' => $request->address,
                'city' => $request->city,
                'province' => $request->province,
                'postal_code' => $request->postal_code,
                'payment_terms' => $request->payment_terms,
                'delivery_lead_time' => $request->delivery_lead_time,
                'notes' => $request->notes,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Supplier updated successfully',
                'supplier' => $supplier
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error updating supplier: ' . $e->getMessage()
            ], 500);
        }
    }

    public function toggleStatus(Supplier $supplier)
    {
        try {
            $supplier->is_active = !$supplier->is_active;
            $supplier->save();

            $status = $supplier->is_active ? 'activated' : 'deactivated';

            return response()->json([
                'success' => true,
                'message' => "Supplier {$status} successfully",
                'supplier' => $supplier
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error updating supplier status: ' . $e->getMessage()
            ], 500);
        }
    }

    public function destroy(Supplier $supplier)
    {
        try {
            // Check if supplier has purchase orders
            if ($supplier->purchaseOrders()->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete supplier with existing purchase orders'
                ], 400);
            }

            $supplier->delete();

            return response()->json([
                'success' => true,
                'message' => 'Supplier deleted successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error deleting supplier: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getSuppliers()
    {
        $suppliers = Supplier::active()
            ->orderBy('supplier_name')
            ->get(['id', 'supplier_code', 'supplier_name', 'contact_person', 'phone', 'delivery_lead_time']);

        return response()->json([
            'suppliers' => $suppliers->map(function ($supplier) {
                return [
                    'id' => $supplier->id,
                    'supplier_code' => $supplier->supplier_code,
                    'supplier_name' => $supplier->supplier_name,
                    'contact_person' => $supplier->contact_person,
                    'phone' => $supplier->phone,
                    'delivery_lead_time' => $supplier->delivery_lead_time,
                ];
            })
        ]);
    }

    public function getSupplierDetails(Supplier $supplier)
    {
        $supplier->load(['purchaseOrders' => function ($query) {
            $query->orderBy('created_at', 'desc')->limit(10);
        }]);

        return response()->json([
            'supplier' => $supplier
        ]);
    }
}
