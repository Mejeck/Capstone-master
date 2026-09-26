<?php

use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\POSController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::get('/check-username', [UserController::class, 'checkUsernameAvailability']);

// Throttled: this answers "is this number registered?" to anyone who asks,
// so it must not be usable to walk through a range of numbers at speed.
Route::get('/check-contact', [UserController::class, 'checkContactAvailability'])
    ->middleware('throttle:30,1');

// Throttled for the same reason as the one above: it reports whether an
// address is registered, which must not be answerable in bulk.
Route::get('/check-email', [UserController::class, 'checkEmailAvailability'])
    ->middleware('throttle:30,1');

// Vercel has no artisan scheduler daemon; Vercel Cron (see vercel.json) calls
// this instead of `gcash:cancel-expired` in routes/console.php. The command only
// looks at "rejected more than 24h ago", so it is safe to run at any time.
Route::get('/cron/gcash-cancel-expired', function (Request $request) {
    $secret = config('services.cron.secret');

    abort_unless(
        filled($secret) && hash_equals("Bearer {$secret}", (string) $request->header('Authorization')),
        401,
    );

    Artisan::call('gcash:cancel-expired');

    return response()->json(['message' => trim(Artisan::output())]);
});
