<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

// Customers already prove ownership of their email through the OTP flow
// before their account is even created (see RegisteredUserController /
// EmailVerificationController), which stamps email_verified_at immediately.
// Admin-created staff accounts (StaffAccountController) skip that OTP step
// — the admin, not the account owner, types the email — so this interface
// is what makes LoginRequest block them from logging in until they click
// the verification link mailed to that address.
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, \Illuminate\Auth\MustVerifyEmail;

    /**
     * Age limits for a birthdate a customer types in themselves.
     *
     * MINIMUM_SIGNUP_AGE is the floor for holding an account at all. It is
     * deliberately lower than the beverage age: minors can buy ice, and only
     * beverages are gated, by is_adult (18) further down this class.
     *
     * EARLIEST_BIRTHDATE matches what the date pickers already offer and
     * rejects a mistyped year such as 1899 for 1989. Birthdate is write-once
     * (see CustomerController::updateProfile), and no screen lets an admin
     * correct one, so a typo that gets saved can never be undone by the
     * customer. Catching it at entry is the only chance.
     */
    public const MINIMUM_SIGNUP_AGE = 13;
    public const EARLIEST_BIRTHDATE = '1900-01-01';

    
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'username',
        'password',
        'full_name',
        'email',
        'contact_number',
        'birthdate',
        'role',
        'email_verified_at',
        'is_active',
        'is_approved',
        'approved_at',
        'approved_by',
        'is_blocked',
        'blocked_reason',
        'blocked_at',
        'blocked_by',
    ];

    /**
     * @var list<string>
     */
    protected $appends = [
        'name',
        'age',
        'is_adult',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'birthdate' => 'date',
            'is_active' => 'boolean',
            'is_approved' => 'boolean',
            'approved_at' => 'datetime',
        ];
    }

    /**
     * Age in whole years, derived from birthdate. Null if birthdate is unknown.
     */
    public function getAgeAttribute(): ?int
    {
        return $this->birthdate?->age;
    }

    /**
     * Whether this user has a verified birthdate showing they are 18+.
     * Defaults to false (not adult) when birthdate is unknown, so age-restricted
     * items stay blocked until the user provides their birthdate.
     */
    public function getIsAdultAttribute(): bool
    {
        return $this->age !== null && $this->age >= 18;
    }

    /**
     * Get the user's name for display purposes.
     * This provides compatibility with frontend expecting 'name' field.
     */
    public function getNameAttribute()
    {
        return $this->full_name;
    }

    // Relationships
    public function stockLogs()
    {
        return $this->hasMany(StockLog::class, 'user_id');
    }

    public function orders()
    {
        return $this->hasMany(Order::class, 'user_id');
    }

    public function customer()
    {
        return $this->hasOne(Customer::class, 'email', 'email');
    }

    public function addresses()
    {
        return $this->hasMany(UserAddress::class);
    }

    public function defaultAddress()
    {
        return $this->hasOne(UserAddress::class)->where('is_default', true);
    }

    public function sales()
    {
        return $this->hasMany(Sale::class, 'recorded_by');
    }

    public function deliveriesAsRider()
    {
        return $this->hasMany(Delivery::class, 'rider_id');
    }

    public function deliveriesAsAssigner()
    {
        return $this->hasMany(Delivery::class, 'assigned_by');
    }

    // Approval relationships
    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function approvedUsers()
    {
        return $this->hasMany(User::class, 'approved_by');
    }

    // Approval helper methods
    public function isApproved()
    {
        return $this->is_approved;
    }

    public function needsApproval()
    {
        return $this->role === 'Admin' && !$this->is_approved;
    }

    public function canApproveUsers()
    {
        return ($this->role === 'Admin' || $this->role === 'SuperAdmin') && $this->is_approved && $this->is_active;
    }

    public function isSuperAdmin()
    {
        return $this->role === 'SuperAdmin';
    }

    public function approve(User $approver)
    {
        $this->update([
            'is_approved' => true,
            'approved_at' => now(),
            'approved_by' => $approver->id,
        ]);
    }

    // Scopes
    public function scopePendingApproval(\Illuminate\Database\Eloquent\Builder $query)
    {
        return $query->where('role', 'Admin')->where('is_approved', false);
    }

    public function scopeApproved(\Illuminate\Database\Eloquent\Builder $query)
    {
        return $query->where('is_approved', true);
    }

    public function scopeCustomers(\Illuminate\Database\Eloquent\Builder $query)
    {
        return $query->where('role', 'Customer');
    }

    public function scopeAdmins(\Illuminate\Database\Eloquent\Builder $query)
    {
        return $query->whereIn('role', ['Admin', 'SuperAdmin']);
    }

    public function scopeSuperAdmins(\Illuminate\Database\Eloquent\Builder $query)
    {
        return $query->where('role', 'SuperAdmin');
    }

    public function scopeDeliveryBoys(\Illuminate\Database\Eloquent\Builder $query)
    {
        return $query->where('role', 'delivery_boy');
    }

    public function scopeCashiers(\Illuminate\Database\Eloquent\Builder $query)
    {
        return $query->where('role', 'cashier');
    }

    public function isCashier()
    {
        return $this->role === 'cashier';
    }

    public function canAccessPOS()
    {
        return in_array($this->role, ['Admin', 'SuperAdmin', 'cashier']) && $this->is_active;
    }

    public function canApproveOrders()
    {
        return in_array($this->role, ['Admin', 'SuperAdmin', 'cashier']) && $this->is_active;
    }

    public function canManageInventory()
    {
        return in_array($this->role, ['Admin', 'SuperAdmin']) && $this->is_active;
    }

    public function canAccessAdminFunctions()
    {
        return in_array($this->role, ['Admin', 'SuperAdmin']) && $this->is_active;
    }
}
