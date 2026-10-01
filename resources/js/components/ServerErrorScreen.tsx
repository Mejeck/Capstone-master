import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

export interface ServerErrorDebugInfo {
    message: string;
    exception: string;
    file: string;
    line: number;
}

export interface ServerErrorScreenProps {
    /** Shown to the visitor, and is what they'd quote back when reporting the problem. */
    reference: string | null;
    signedIn: boolean;
    /** Where the countdown sends them. Null means: no redirect, "Try again" only. */
    redirectUrl: string | null;
    /** Only ever present when config('app.debug') is true on the server. */
    debug?: ServerErrorDebugInfo | null;
}

const COUNTDOWN_SECONDS = 5;

/**
 * The page shown for a genuine server failure (500/502/503/504, or any
 * uncaught exception) — never for a 404, a permission error, an expired
 * session or a validation mistake, which all keep their own normal handling.
 *
 * Rendered two different ways by two different callers, deliberately sharing
 * this one component so the message is identical either way:
 *   - bootstrap/app.php's exception renderable, via pages/errors/server.tsx,
 *     for any failure Laravel's own exception handler catches — the common
 *     case, and the only one with a reference and a real redirect target.
 *   - GlobalErrorOverlay, mounted once in app.tsx, for the residual case
 *     where Inertia receives something that isn't a valid Inertia response
 *     at all (a raw platform crash page, a dropped connection) — nothing
 *     here ever reached the server's own handler, so there is no reference
 *     and no server-computed redirect; it offers to go home only.
 */
export default function ServerErrorScreen({ reference, signedIn, redirectUrl, debug }: ServerErrorScreenProps) {
    const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
    const [showDetails, setShowDetails] = useState(false);
    const navigatedRef = useRef(false);

    useEffect(() => {
        if (!redirectUrl) {
            return;
        }

        if (secondsLeft <= 0) {
            if (!navigatedRef.current) {
                navigatedRef.current = true;
                router.visit(redirectUrl);
            }
            return;
        }

        const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [secondsLeft, redirectUrl]);

    const goNow = () => {
        if (!redirectUrl || navigatedRef.current) {
            return;
        }
        navigatedRef.current = true;
        router.visit(redirectUrl);
    };

    const tryAgain = () => {
        window.location.reload();
    };

    const goNowLabel = signedIn ? 'Go to Dashboard now' : 'Go to Home now';

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 px-4 py-10">
            <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-amber-200 dark:border-amber-900/50 p-6 sm:p-8">
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white pt-1.5">
                        Something went wrong on our side
                    </h1>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                    Your work was not lost — nothing was half-saved.
                </p>

                {redirectUrl && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        We're taking you to your {signedIn ? 'dashboard' : 'home page'} in {secondsLeft} second
                        {secondsLeft === 1 ? '' : 's'}…
                    </p>
                )}

                {reference && (
                    <div className="mb-5 px-3 py-2.5 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Error reference: <span className="font-mono font-semibold text-gray-700 dark:text-gray-200">{reference}</span>
                            {' '}(quote it when you report the problem)
                        </p>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                    {redirectUrl && (
                        <button
                            type="button"
                            onClick={goNow}
                            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg font-semibold text-white bg-cyan-600 hover:bg-cyan-700 transition-colors"
                        >
                            {goNowLabel}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={tryAgain}
                        className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-colors ${
                            redirectUrl
                                ? 'text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                                : 'text-white bg-cyan-600 hover:bg-cyan-700'
                        }`}
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try again
                    </button>
                </div>

                {debug && (
                    <div className="mt-5 pt-4 border-t border-gray-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => setShowDetails((v) => !v)}
                            className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        >
                            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            Show details (only visible because APP_DEBUG is on)
                        </button>
                        {showDetails && (
                            <pre className="mt-2 p-3 bg-gray-900 text-gray-100 text-xs rounded-lg overflow-x-auto whitespace-pre-wrap break-words">
                                {debug.exception}: {debug.message}
                                {'\n'}at {debug.file}:{debug.line}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
