<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\VerifyStaffAccountEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Lets an Admin/SuperAdmin create Cashier, Delivery Boy, and Admin accounts
 * directly — there is no public self-registration or approval queue for
 * these roles. The account is created already active and approved, since an
 * existing admin vouching for it by creating it themselves stands in for
 * that review step.
 *
 * Creating a new Admin account specifically is restricted to SuperAdmin: an
 * Admin creating more Admins would be a privilege-escalation path that
 * bypasses the trust an admin account is supposed to carry.
 */
class StaffAccountController extends Controller
{
    /**
     * Roles assignable through this form at all.
     */
    private const ASSIGNABLE_ROLES = ['cashier', 'delivery_boy', 'Admin'];

    /**
     * Of those, the ones only a SuperAdmin may assign.
     */
    private const SUPERADMIN_ONLY_ROLES = ['Admin'];

    /**
     * List existing staff accounts (Cashier, Delivery Boy, Admin) so they
     * can be deactivated, reactivated, or removed. SuperAdmin accounts are
     * deliberately excluded from this list — there are only ever a handful
     * of them and they must never be manageable through a list UI like
     * this one, to rule out an accidental (or malicious) self-lockout of
     * the whole system.
     */
    public function index(): Response
    {
        $staff = User::whereIn('role', self::ASSIGNABLE_ROLES)
            ->orderBy('role')
            ->orderBy('full_name')
            ->get();

        return Inertia::render('admin/manage-staff-accounts', [
            'staff' => $staff->map(fn (User $user) => [
                'id' => $user->id,
                'username' => $user->username,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'role' => $user->role,
                'is_active' => $user->is_active,
                'created_at' => $user->created_at->format('Y-m-d'),
                // A staff member with sales, deliveries, or stock activity
                'has_activity' => $user->sales()->exists()
                    || $user->deliveriesAsRider()->exists()
                    || $user->deliveriesAsAssigner()->exists()
                    || $user->stockLogs()->exists(),
            ]),
            'canManageAdmins' => Auth::user()->role === 'SuperAdmin',
            'currentUserId' => Auth::id(),
        ]);
    }

    /**
     * Show the staff account creation form.
     */
    public function create(): Response
    {
        return Inertia::render('admin/create-staff-account', [
            'canCreateAdmin' => Auth::user()->role === 'SuperAdmin',
        ]);
    }

    /**
     * Create a new Cashier, Delivery Boy, or (SuperAdmin only) Admin account.
     */
    public function store(Request $request): RedirectResponse
    {
        $allowedRoles = Auth::user()->role === 'SuperAdmin'
            ? self::ASSIGNABLE_ROLES
            : array_values(array_diff(self::ASSIGNABLE_ROLES, self::SUPERADMIN_ONLY_ROLES));

        $validated = $request->validate([
            'username' => 'required|string|min:3|max:50|unique:users,username|regex:/^[a-zA-Z0-9_]+$/',
            'full_name' => 'required|string|max:100',
            'email' => 'required|string|lowercase|email|max:100|unique:users,email',
            'contact_number' => [
                'nullable',
                'string',
                'max:13',
                'regex:/^\+639\d{9}$/',
                'unique:users,contact_number',
            ],
            'role' => ['required', Rule::in($allowedRoles)],
            'password' => [
                'required',
                'confirmed',
                'min:8',
                'regex:/[a-z]/',      // at least one lowercase
                'regex:/[A-Z]/',      // at least one uppercase
                'regex:/[0-9]/',      // at least one number
                'regex:/[@$!%*?&.]/', // at least one special character
            ],
        ], [
            'username.regex' => 'Username can only contain letters, numbers, and underscores.',
            'contact_number.regex' => 'Contact number must be 10 digits after +63, starting with 9.',
            'contact_number.unique' => 'This contact number is already registered to another account.',
            'role.in' => 'You are not allowed to assign that role.',
            'password.regex' => 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&.).',
            'password.confirmed' => 'The password confirmation does not match.',
        ]);

        $user = User::create([
            'username' => $validated['username'],
            'full_name' => $validated['full_name'],
            'email' => $validated['email'],
            'contact_number' => $validated['contact_number'] ?? null,
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'is_active' => true,
            // Created directly by an existing admin, so it's already vetted
            // — no separate pending-approval step for this account.
            'is_approved' => true,
            'approved_at' => now(),
            'approved_by' => Auth::id(),
            // Left unverified on purpose: the admin typed this email, not
            // the account owner, so there's no proof yet that it actually
            // belongs to them. LoginRequest blocks login until they click
            // the link this sends.
        ]);

        $user->notify(new VerifyStaffAccountEmail());

        return redirect()->route('admin.staff-accounts.index')
            ->with('success', "{$user->full_name} has been created as {$user->role}. We've emailed them a verification link — they can log in once they click it.");
    }

    /**
     * Flip an account's active status. A deactivated account can no longer
     * log in (see LoginRequest / CheckRole), but every historical record
     * tied to it (sales, deliveries, stock logs) is left completely intact
     * — unlike a hard delete, this is always reversible.
     */
    public function toggleActive(Request $request, User $user): RedirectResponse
    {
        if (! in_array($user->role, self::ASSIGNABLE_ROLES, true)) {
            return back()->with('error', 'This account cannot be managed here.');
        }

        if ($user->id === Auth::id()) {
            return back()->with('error', 'You cannot deactivate your own account.');
        }

        if ($user->role === 'Admin' && Auth::user()->role !== 'SuperAdmin') {
            return back()->with('error', 'Only a SuperAdmin can activate or deactivate an Admin account.');
        }

        $user->update(['is_active' => ! $user->is_active]);

        $status = $user->is_active ? 'activated' : 'deactivated';

        return back()->with('success', "{$user->full_name}'s account has been {$status}.");
    }

    /**
     * Set a new password for a staff account. There is no way to recover or
     * display the account's existing password — it's stored as a one-way
     * hash — so this is the only way an admin can help a cashier or delivery
     * boy who forgot theirs. The admin communicates the new password to the
     * staff member directly.
     */
    public function resetPassword(Request $request, User $user): RedirectResponse
    {
        if (! in_array($user->role, self::ASSIGNABLE_ROLES, true)) {
            return back()->with('error', 'This account cannot be managed here.');
        }

        if ($user->role === 'Admin' && Auth::user()->role !== 'SuperAdmin') {
            return back()->with('error', 'Only a SuperAdmin can reset an Admin account\'s password.');
        }

        $validated = $request->validate([
            'password' => [
                'required',
                'confirmed',
                'min:8',
                'regex:/[a-z]/',      // at least one lowercase
                'regex:/[A-Z]/',      // at least one uppercase
                'regex:/[0-9]/',      // at least one number
                'regex:/[@$!%*?&.]/', // at least one special character
            ],
        ], [
            'password.regex' => 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&.).',
            'password.confirmed' => 'The password confirmation does not match.',
        ]);

        $user->update(['password' => Hash::make($validated['password'])]);

        return back()->with('success', "{$user->full_name}'s password has been reset.");
    }

    /**
     * Permanently remove a staff account. Only allowed when the account has
     * no sales, delivery, or stock activity tied to it — deleting a user
     * with real history would either break those records' foreign keys or
     * silently orphan them, corrupting reports. Deactivate instead of
     * deleting whenever an account has any real activity.
     */
    public function destroy(User $user): RedirectResponse
    {
        if (! in_array($user->role, self::ASSIGNABLE_ROLES, true)) {
            return back()->with('error', 'This account cannot be managed here.');
        }

        if ($user->id === Auth::id()) {
            return back()->with('error', 'You cannot delete your own account.');
        }

        if ($user->role === 'Admin' && Auth::user()->role !== 'SuperAdmin') {
            return back()->with('error', 'Only a SuperAdmin can delete an Admin account.');
        }

        $hasActivity = $user->sales()->exists()
            || $user->deliveriesAsRider()->exists()
            || $user->deliveriesAsAssigner()->exists()
            || $user->stockLogs()->exists();

        if ($hasActivity) {
            return back()->with('error', "{$user->full_name} has existing sales/delivery/stock records and cannot be deleted. Deactivate the account instead.");
        }

        $fullName = $user->full_name;
        $user->delete();

        return back()->with('success', "{$fullName}'s account has been permanently deleted.");
    }
}
