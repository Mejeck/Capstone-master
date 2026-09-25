<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    use HasFactory;

    protected $table = 'sales';
    protected $primaryKey = 'sale_id';
    
    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($sale) {
            if (!$sale->sale_id) {
                // Get the maximum sale_id and increment by 1
                $maxSaleId = static::max('sale_id') ?? 0;
                $sale->sale_id = $maxSaleId + 1;
            }
        });
    }
    
    protected $fillable = [
        'order_id',
        'sale_date',
        'total_amount',
        'payment_received',
        'change_amount',
        'recorded_by',
        'payment_proof_type',
        'payment_proof_path',
        'transaction_id',
        'payment_status',
        'payment_notes',
        'confirmed_by',
        'rejected_by',
        'confirmed_at',
        'rejected_at',
        'voided_at',
        'voided_by',
        'void_reason',
    ];

    protected $casts = [
        'sale_date' => 'date',
        'total_amount' => 'decimal:2',
        'payment_received' => 'decimal:2',
        'change_amount' => 'decimal:2',
        'created_at' => 'datetime',
        'voided_at' => 'datetime',
    ];

    public $timestamps = false;

    public function order()
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    public function recordedByUser()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function voidedByUser()
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function isVoided(): bool
    {
        return $this->voided_at !== null;
    }

    public function scopeToday($query)
    {
        return $query->whereDate('sale_date', today());
    }

    /**
     * Sales that count as real income: a 'pending' one hasn't actually been
     * paid yet and a voided one was reversed. Same definition every other
     * revenue figure uses (see DashboardController::buildSalesReport).
     */
    public function scopeRevenue($query)
    {
        return $query->where('payment_status', 'confirmed')->whereNull('voided_at');
    }

    /**
     * All-time takings across every cashier and admin, shown on the admin
     * Dashboard and on the POS screen so the overall figure is visible
     * without opening Sales History.
     */
    public static function overallSummary(): array
    {
        return [
            'total_sales' => (float) static::revenue()->sum('total_amount'),
            'total_transactions' => static::revenue()->count(),
            'today_sales' => (float) static::revenue()->today()->sum('total_amount'),
        ];
    }

    public function scopeThisWeek($query)
    {
        return $query->whereBetween('sale_date', [now()->startOfWeek(), now()->endOfWeek()]);
    }

    public function scopeThisMonth($query)
    {
        return $query->whereMonth('sale_date', now()->month)
            ->whereYear('sale_date', now()->year);
    }
}
