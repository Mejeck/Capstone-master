<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\RecaptchaVerifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EmailVerificationController extends Controller
{
    /**
     * Send OTP to email for verification.
     */
    public function sendOtp(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'email' => 'required|email|max:100',
                'recaptcha_token' => 'nullable|string',
            ]);

            // Sending an OTP email has a real cost (mail quota, and it can
            // be pointed at a stranger's inbox as spam/harassment), so a bot
            // must not be able to trigger it in bulk even under the request
            // rate limit below. Block on a failing reCAPTCHA score first.
            if (! app(RecaptchaVerifier::class)->verify($request->input('recaptcha_token'), 'send_otp', $request->ip())) {
                return response()->json([
                    'success' => false,
                    'message' => 'We could not verify this request. Please refresh the page and try again.',
                ], 422);
            }

            // An address that already has an account has nothing to
            // verify: the registration request refuses it at the end
            // anyway, by which point a code has been mailed to somebody
            // else's inbox and the visitor has typed it back in for
            // nothing. Checked after reCAPTCHA on purpose, so this
            // cannot be used to find out which addresses are registered
            // without solving one first.
            if (User::where('email', $request->email)->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This email address is already registered. Try logging in instead.',
                ], 422);
            }

            $email = $request->email;

            // Generate 6-digit OTP
            $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            // Set expiration time (5 minutes)
            $expiresAt = now()->addMinutes(5);

            // Store or update OTP in database
            $existingRecord = DB::table('email_verification_tokens')->where('email', $email)->first();
        
            if ($existingRecord) {
                // Update existing record
                DB::table('email_verification_tokens')
                    ->where('email', $email)
                    ->update([
                        'token' => $otp,
                        'expires_at' => $expiresAt,
                        'created_at' => now(),
                    ]);
            } else {
                // Insert new record (rely on auto_increment primary key)
                DB::table('email_verification_tokens')->insert([
                    'email' => $email,
                    'token' => $otp,
                    'expires_at' => $expiresAt,
                    'created_at' => now(),
                ]);
            }

            try {
                Mail::raw("Your verification code is: {$otp}\n\nThis code will expire in 5 minutes.", function ($message) use ($email) {
                    $message->to($email)
                        ->subject('Email Verification - Mejeck IcePlant');
                });
            } catch (\Exception $e) {
                \Log::error('Failed to send OTP email: ' . $e->getMessage());
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to send OTP email. Please check mail configuration.',
                ], 500);
            }

            return response()->json([
                'success' => true,
                'message' => 'OTP sent successfully',
            ]);
        } catch (\Exception $e) {
            \Log::error('sendOtp error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to send OTP: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Verify OTP for email.
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email|max:100',
            'otp' => 'required|digits:6',
        ], [
            'otp.digits' => 'The OTP must be exactly 6 digits.',
        ]);

        // Find the OTP record
        $verificationRecord = DB::table('email_verification_tokens')
            ->where('email', $request->email)
            ->where('token', $request->otp)
            ->first();

        // Validate OTP exists
        if (!$verificationRecord) {
            throw ValidationException::withMessages([
                'otp' => ['Invalid OTP. Please check your email and try again.'],
            ]);
        }

        // Check if OTP has expired
        if (now()->gt($verificationRecord->expires_at)) {
            DB::table('email_verification_tokens')
                ->where('email', $request->email)
                ->delete();
            
            throw ValidationException::withMessages([
                'otp' => ['This OTP has expired. Please request a new one.'],
            ]);
        }

        // OTP is valid, delete it to prevent reuse and mark as verified
        DB::table('email_verification_tokens')
            ->where('email', $request->email)
            ->delete();

        // Store verification status in session for 30 minutes
        session(['email_verified_' . $request->email => true, 'email_verified_until' => now()->addMinutes(30)]);

        return response()->json([
            'success' => true,
            'message' => 'Email verified successfully',
        ]);
    }
}
