<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\RedirectIfAuthenticated;
use App\Http\Middleware\AdminApprovalMiddleware;
use App\Http\Middleware\CheckRole;
use App\Http\Middleware\CashierMiddleware;
use App\Support\ErrorReference;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Hosted behind a TLS-terminating proxy (Vercel): trust X-Forwarded-*
        // so requests, redirects and asset URLs are seen as https on the real host.
        $middleware->trustProxies(at: '*');

        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->alias([
            'auth' => \Illuminate\Auth\Middleware\Authenticate::class,
            'guest' => RedirectIfAuthenticated::class,
            'admin.approval' => AdminApprovalMiddleware::class,
            'role' => CheckRole::class,
            'cashier' => CashierMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // A friendly page for a genuine server failure (500/502/503/504, or
        // any uncaught exception — which defaults to 500). 404/403/419/422/429
        // and the rest of the 4xx family return null here and fall through to
        // Laravel's own handling, untouched: those are the user's mistake or
        // a normal access rule, not something to apologise for.
        //
        // Returning an Inertia response (not a plain Blade view) from here
        // means the SAME component renders the error whether the failure
        // happened on a full page load (the response is real HTML, this IS
        // the page) or during a client-side visit (Inertia sees a properly
        // formatted Inertia response and swaps it in as the next page,
        // instead of falling back to its own raw-HTML error modal).
        $exceptions->renderable(function (Throwable $e, Request $request) {
            $status = $e instanceof HttpExceptionInterface ? $e->getStatusCode() : 500;

            if ($status < 500) {
                return null;
            }

            $reference = ErrorReference::generate();

            Log::error("[{$reference}] {$e->getMessage()}", [
                'reference' => $reference,
                'exception' => get_class($e),
                'at' => $e->getFile() . ':' . $e->getLine(),
                'url' => $request->fullUrl(),
                'method' => $request->method(),
            ]);

            // Working out where to send the user is itself DB/auth-dependent
            // (a session lookup, a role check) — if the database is what
            // actually failed, that lookup can throw too, and this handler
            // must never become a second, uncaught exception on top of the
            // first. Fall back to "nowhere, not signed in" rather than risk it.
            $signedIn = false;
            $redirectUrl = null;

            try {
                $signedIn = Auth::check();

                // Dashboard routes across every role, by their actual path —
                // not by name, so this doesn't depend on route resolution
                // having succeeded for whatever just failed.
                $dashboardPaths = [
                    'dashboard',
                    'admin/dashboard',
                    'customer/dashboard',
                    'cashier/dashboard',
                    'delivery-boy/dashboard',
                ];

                $path = $request->path();

                if ($path === '/') {
                    // Home itself just failed. Nowhere further to fall back
                    // to — offer "Try again" only, no automatic redirect.
                    $redirectUrl = null;
                } elseif (in_array($path, $dashboardPaths, true)) {
                    // The user's own dashboard is what failed — sending them
                    // straight back there would just fail again. Home is a
                    // step away from whatever role-specific query broke.
                    $redirectUrl = route('home');
                } else {
                    // route('dashboard') does the same role lookup
                    // routes/web.php's own post-login redirect does, so this
                    // can't drift from where "my dashboard" actually means
                    // for a given role.
                    $redirectUrl = $signedIn ? route('dashboard') : route('home');
                }
            } catch (Throwable) {
                $signedIn = false;
                $redirectUrl = null;
            }

            $props = [
                'reference' => $reference,
                'signedIn' => $signedIn,
                'redirectUrl' => $redirectUrl,
                // Never sent in production: config('app.debug') is false
                // there, so a file path or exception class name never
                // reaches a real customer's browser.
                'debug' => config('app.debug') ? [
                    'message' => $e->getMessage(),
                    'exception' => get_class($e),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ] : null,
            ];

            try {
                return Inertia::render('errors/server', $props)
                    ->toResponse($request)
                    ->setStatusCode($status);
            } catch (Throwable) {
                // Inertia itself couldn't render (a second, unrelated
                // failure) — fall through to Laravel's default rendering
                // instead of this handler being the thing that breaks.
                return null;
            }
        });
    })->create();
