<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory;

    // Empty/returnable bottles: tracked in inventory, never sold.
    const BOTTLES = 'Bottles';

    protected $table = 'categories';
    protected $primaryKey = 'category_id';
    
    protected $fillable = [
        'category_name',
        'description',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public $timestamps = false;

    public function products()
    {
        return $this->hasMany(Product::class, 'category_id');
    }

    public function activeProducts()
    {
        return $this->hasMany(Product::class, 'category_id')
            ->where('is_active', true);
    }

    public function inventoryStats()
    {
        return $this->hasManyThrough(
            Inventory::class,
            Product::class,
            'categories.category_id',
            'products.category_id',
            'products.product_id',
            'inventory.product_id'
        );
    }
}
