<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response;

trait HasPOSProducts
{
    /**
     * Get products formatted for POS
     *
     * Must be public: this is wired up directly as a route controller
     * action (GET admin/api/products), and Laravel's ControllerDispatcher
     * can only invoke public methods. Declared protected, it 500s for every
     * role including Admin with "Call to protected method ... from scope
     * Illuminate\Routing\ControllerDispatcher" the moment anything (the
     * search box, or the post-sale stock refresh) calls this endpoint.
     */
    public function getPOSProducts(Request $request = null): \Illuminate\Http\JsonResponse
    {
        $search = $request ? $request->input('search', '') : '';
        
        $products = Product::with(['category', 'inventory'])
            ->where('is_active', true)
            ->sellable()
            ->where(function ($query) use ($search) {
                // whereLike() stays case-insensitive on PostgreSQL (ILIKE), like MySQL's LIKE.
                $query->whereLike('product_name', "%{$search}%")
                      ->orWhereHas('category', function ($q) use ($search) {
                          $q->whereLike('category_name', "%{$search}%");
                      });
            })
            ->get()
            ->map(function ($product) {
                // Determine unit type based on category
                $isIceTube = str_contains(strtolower($product->product_name), 'ice tube');
                $unitType = $isIceTube ? 'kilos' : 'bottle';
                
                return [
                    'product_id' => $product->product_id,
                    'product_name' => $product->product_name,
                    'price' => $product->price,
                    'price_per_case' => $product->price_per_case,
                    'price_per_case_cold' => $product->price_per_case_cold,
                    'price_per_bottle' => $product->price_per_bottle,
                    'current_quantity' => $product->inventory ? $product->inventory->current_quantity : 0,
                    'is_low_stock' => $product->inventory && $product->inventory->isLowStock(),
                    'unit' => $product->unit,
                    'category' => $product->category ? $product->category->category_name : 'Unknown',
                    'unit_type' => $unitType,
                ];
            });

        return Response::json($products);
    }

    /**
     * Get POS view data (for Inertia rendering)
     */
    protected function getPOSViewData(string $cashierName = null): array
    {
        $products = Product::with(['category', 'inventory'])
            ->where('is_active', true)
            ->sellable()
            ->get()
            ->map(function ($product) {
                $isIceTube = str_contains(strtolower($product->product_name), 'ice tube');
                $unitType = $isIceTube ? 'kilos' : 'bottle';
                
                return [
                    'product_id' => $product->product_id,
                    'product_name' => $product->product_name,
                    'price' => $product->price,
                    'price_per_case' => $product->price_per_case,
                    'price_per_case_cold' => $product->price_per_case_cold,
                    'price_per_bottle' => $product->price_per_bottle,
                    'current_quantity' => $product->inventory ? $product->inventory->current_quantity : 0,
                    'is_low_stock' => $product->inventory && $product->inventory->isLowStock(),
                    'unit' => $product->unit,
                    'category' => $product->category ? $product->category->category_name : 'Unknown',
                    'unit_type' => $unitType,
                ];
            });

        $data = [
            'products' => $products,
        ];

        if ($cashierName) {
            $data['cashier_name'] = $cashierName;
        }

        return $data;
    }
}