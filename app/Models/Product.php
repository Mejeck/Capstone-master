<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $table = 'products';
    protected $primaryKey = 'product_id';
    
    protected $fillable = [
        'category_id',
        'product_name',
        'description',
        'unit',
        'price',
        'price_per_case',
        'price_per_case_cold',
        'price_per_bottle',
        'image',
        'is_active',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'price_per_case' => 'decimal:2',
        'price_per_case_cold' => 'decimal:2',
        'price_per_bottle' => 'decimal:2',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    /**
     * Products that can be sold: everything except the Bottles category,
     * which is inventory only (empties and returnables).
     */
    public function scopeSellable($query)
    {
        return $query->whereDoesntHave('category', function ($q) {
            $q->where('category_name', Category::BOTTLES);
        });
    }

    public function inventory()
    {
        return $this->hasOne(Inventory::class, 'product_id');
    }

    public function stockLogs()
    {
        return $this->hasMany(StockLog::class, 'product_id');
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class, 'product_id');
    }

    public function activeOrderItems()
    {
        return $this->hasMany(OrderItem::class, 'product_id')
            ->join('orders', 'order_items.order_id', '=', 'orders.order_id')
            ->where('orders.status', '!=', 'Cancelled');
    }
}
