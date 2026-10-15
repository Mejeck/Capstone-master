<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $table = 'orders';
    protected $primaryKey = 'order_id';
    
    protected $fillable = [
        'customer_id',
        'user_id',
        'order_date',
        'total_amount',
        'delivery_fee',
        'overall_total',
        'status',
        'payment_method',
        'payment_status',
        'down_payment',
        'approval_status',
        'notes',
        'order_type',
        'delivery_address',
        'delivery_municipality',
        'delivery_landmark',
        'delivery_remarks',
        'delivery_barangay',
        'delivery_purok',
        'delivery_city',
        'delivery_province',
        'delivery_postal_code',
        'delivery_latitude',
        'delivery_longitude',
        'gcash_screenshot',
        'gcash_resubmit_count',
        'gcash_rejected_count',
        'gcash_rejected_at',
        'gcash_flagged',
        'cod_rejected_at',
        'refund_status',
        'refund_amount',
        'refund_requested_at',
        'refund_completed_at',
        'refund_completed_by',
        'refund_note',
    ];

    protected $casts = [
        'order_date' => 'datetime',
        'total_amount' => 'decimal:2',
        'delivery_fee' => 'decimal:2',
        'overall_total' => 'decimal:2',
        'collected_amount' => 'decimal:2',
        'delivery_latitude' => 'decimal:8',
        'delivery_longitude' => 'decimal:8',
        'refund_amount' => 'decimal:2',
        'refund_requested_at' => 'datetime',
        'refund_completed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class, 'order_id');
    }

    public function delivery()
    {
        return $this->hasOne(Delivery::class, 'order_id');
    }

    public function sale()
    {
        return $this->hasOne(Sale::class, 'order_id');
    }

    public function refundCompletedBy()
    {
        return $this->belongsTo(User::class, 'refund_completed_by');
    }

    public function totalItems()
    {
        return $this->orderItems()->sum('quantity');
    }

    public function totalProducts()
    {
        return $this->orderItems()->count();
    }

    public function isCompleted()
    {
        return in_array($this->status, ['Completed', 'Delivered']);
    }

    public function isPending()
    {
        return in_array($this->status, ['Pending', 'Processing']);
    }

    /**
     * Whether the money in down_payment has actually been confirmed received
     * by a cashier — not just charged/claimed by the customer. payment_status
     * alone is ambiguous ('Partial' is set both immediately on order creation,
     * before anything is paid, and after a cashier confirms a down payment);
     * gcash_screenshot being present is what disambiguates the two.
     */
    public function hasConfirmedPayment(): bool
    {
        return !empty($this->gcash_screenshot)
            && in_array($this->payment_status, ['Paid', 'Partial'], true);
    }

    /**
     * Single source of truth for "how much should be refunded if this order
     * is cancelled/rejected right now". down_payment already unifies "down
     * payment vs full payment" into one field (GCash orders charge the full
     * total up front), so this is just that value, gated on confirmed receipt.
     */
    public function calculateRefundAmount(): float
    {
        return $this->hasConfirmedPayment() ? (float) $this->down_payment : 0.0;
    }

    /**
     * True when the confirmed payment covers the whole order — used only to
     * pick refund-confirmation wording ("full payment" vs "down payment").
     */
    public function refundCoversFullPayment(): bool
    {
        return $this->hasConfirmedPayment()
            && (float) $this->down_payment > 0
            && (float) $this->down_payment >= (float) $this->total_amount;
    }

    public function scopeActive($query)
    {
        return $query->where('status', '!=', 'Cancelled');
    }

    public function scopeCompleted($query)
    {
        return $query->whereIn('status', ['Completed', 'Delivered']);
    }
}
