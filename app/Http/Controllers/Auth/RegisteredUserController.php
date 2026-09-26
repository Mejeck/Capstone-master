<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Show registration page.
     */
    public function create(): Response|RedirectResponse
    {
        // A visitor opening the registration page wants a new account, even
        // if a previous session is still active on this browser. Log that
        // stale session out instead of silently redirecting into it. We
        // deliberately don't invalidate the whole session here: an
        // in-progress email OTP verification (stored in this same session)
        // must survive so the registration form can still be completed.
        if (Auth::check()) {
            Auth::logout();
        }

        return Inertia::render('auth/register');
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        // A visitor submitting the registration form wants a new account,
        // even if a previous session is still active on this browser. Log
        // that stale session out instead of silently redirecting into it.
        // The session itself is left intact (not invalidated) because the
        // email OTP verification flag set moments ago lives in it and is
        // still needed by the check below.
        if (Auth::check()) {
            \Log::info('Logging out stale session before processing registration', ['user_id' => Auth::id()]);
            Auth::logout();
        }

        \Log::info('Processing registration request', ['email' => $request->email, 'username' => $request->username]);

        // Check if email has been verified (via OTP session)
        $emailVerifiedKey = 'email_verified_' . $request->email;
        $emailVerifiedUntil = session('email_verified_until');

        if (!session($emailVerifiedKey) || !$emailVerifiedUntil || now()->gt($emailVerifiedUntil)) {
            return back()->with('error', 'Please verify your email address before creating an account.');
        }

        $request->validate([
            'username' => 'required|string|min:3|max:50|unique:users,username|regex:/^[a-zA-Z0-9_]+$/',
            'full_name' => 'required|string|max:100',
            'email' => 'required|string|lowercase|email|max:100|unique:users,email',
            'contact_number' => 'nullable|string|max:13|regex:/^\+639\d{9}$/',
            'birthdate' => [
                'required',
                'date',
                'before_or_equal:' . now()->subYears(User::MINIMUM_SIGNUP_AGE)->toDateString(),
                'after_or_equal:' . User::EARLIEST_BIRTHDATE,
            ],
            'password' => [
                'required',
                'confirmed',
                'min:8',
                'regex:/[a-z]/',      // at least one lowercase
                'regex:/[A-Z]/',      // at least one uppercase
                'regex:/[0-9]/',      // at least one number
                'regex:/[@$!%*?&.]/',  // at least one special character
            ],
        ], [
            'username.regex' => 'Username can only contain letters, numbers, and underscores.',
            'contact_number.regex' => 'Contact number must be 10 digits after +63, starting with 9.',
            'birthdate.before_or_equal' => 'You must be at least ' . User::MINIMUM_SIGNUP_AGE . ' years old to create an account.',
            'birthdate.after_or_equal' => 'Please enter a valid birthdate.',
            'password.regex' => 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&.).',
            'password.confirmed' => 'The password confirmation does not match.',
        ]);

        try {
            // Force Customer role for all registrations
            $user = User::create([
                'username' => $request->username,
                'full_name' => $request->full_name,
                'email' => $request->email,
                'contact_number' => $request->contact_number,
                'birthdate' => $request->birthdate,
                'password' => Hash::make($request->password),
                'role' => 'Customer',
                'is_active' => 1,
                'is_approved' => true,
                'approved_at' => now(),
                'approved_by' => null,
                // Already proved ownership of this address via the OTP step
                // above (the gate at the top of this method) — no need to
                // also make them click a link on top of that.
                'email_verified_at' => now(),
            ]);

            \Log::info('User created successfully', ['user_id' => $user->id, 'email' => $user->email]);

            // Clean up email verification record
            DB::table('email_verification_tokens')
                ->where('email', $request->email)
                ->delete();

            event(new Registered($user));

            $message = 'Customer account created successfully! Please log in with your credentials.';

            \Log::info('Redirecting to login with success message');

            return redirect()->route('login')->with('status', $message);
        } catch (\Exception $e) {
            \Log::error('Registration failed', ['error' => $e->getMessage()]);
            return back()->with('error', 'Registration failed: ' . $e->getMessage());
        }
    }
}
