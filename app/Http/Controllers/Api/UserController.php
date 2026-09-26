<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class UserController extends Controller
{
    /**
     * Check if username is available
     */
    public function checkUsernameAvailability(Request $request): JsonResponse
    {
        $username = $request->get('username');
        
        if (!$username || strlen($username) < 3) {
            return response()->json([
                'available' => false,
                'message' => 'Username must be at least 3 characters long'
            ]);
        }

        $exists = User::where('username', $username)->exists();
        
        return response()->json([
            'available' => !$exists,
            'message' => $exists ? 'Username is already taken' : 'Username is available'
        ]);
    }

    /**
     * Check if a contact number is free to register.
     *
     * Mirrors the unique rule the registration and profile forms enforce:
     * one number, one account, across every role. Anything that is not yet
     * a complete +639XXXXXXXXX is reported as unavailable but never as
     * taken, since a prefix of somebody else's number is not a collision.
     */
    public function checkContactAvailability(Request $request): JsonResponse
    {
        $contactNumber = (string) $request->get('contact_number');

        if (!preg_match('/^\+639\d{9}$/', $contactNumber)) {
            return response()->json([
                'available' => false,
                'message' => 'Enter the 10 digits after +63, starting with 9.',
            ]);
        }

        $exists = User::where('contact_number', $contactNumber)->exists();

        return response()->json([
            'available' => !$exists,
            'message' => $exists
                ? 'This number is already registered to another account'
                : 'Contact number is available',
        ]);
    }
}
