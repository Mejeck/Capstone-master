import * as React from 'react';
import { router } from '@inertiajs/react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TOAST_EVENT, type ToastType } from '@/lib/toast';

interface FlashProps {
    success?: string | null;
    error?: string | null;
}

interface ToastItem {
    id: number;
    type: ToastType;
    message: string;
}

const AUTO_DISMISS_MS = 4000;

/**
 * Watches every Inertia page visit for a `flash.success` / `flash.error`
 * message set by the backend (e.g. "Login successful! Welcome back, ...")
 * and shows it as a brief toast in the corner of the screen. Mounted once
 * at the app root so it works after any redirect, on any dashboard.
 */
export default function FlashToaster({ initialFlash }: { initialFlash?: FlashProps }) {
    const [toasts, setToasts] = React.useState<ToastItem[]>([]);

    const pushToast = React.useCallback((type: ToastType, message: string) => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, type, message }]);
        window.setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, AUTO_DISMISS_MS);
    }, []);

    // Covers the page that was already rendered when the app mounted
    // (e.g. the dashboard Inertia navigated to right after login).
    React.useEffect(() => {
        if (initialFlash?.success) pushToast('success', initialFlash.success);
        if (initialFlash?.error) pushToast('error', initialFlash.error);
        // Only run once, on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Covers every subsequent Inertia visit (client-side navigation).
    React.useEffect(() => {
        return router.on('success', (event) => {
            const flash = (event.detail.page.props as { flash?: FlashProps }).flash;
            if (flash?.success) pushToast('success', flash.success);
            if (flash?.error) pushToast('error', flash.error);
        });
    }, [pushToast]);

    // Covers code paths that never go through an Inertia visit — raw
    // fetch() calls (e.g. admin order approve/reject, cashier GCash/COD
    // confirm/reject) that have no flash.success/flash.error page prop to
    // key off of, so they call showToast() from '@/lib/toast' directly.
    React.useEffect(() => {
        const handler = (event: Event) => {
            const { type, message } = (event as CustomEvent<{ type: ToastType; message: string }>).detail;
            pushToast(type, message);
        };
        window.addEventListener(TOAST_EVENT, handler);
        return () => window.removeEventListener(TOAST_EVENT, handler);
    }, [pushToast]);

    const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-20 inset-x-4 z-[100] flex flex-col gap-2 sm:inset-x-0 sm:mx-auto sm:w-full sm:max-w-md">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    role="status"
                    onClick={() => dismiss(toast.id)}
                    className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm animate-in slide-in-from-top-2 fade-in duration-300 sm:gap-4 sm:px-5 sm:py-4',
                        toast.type === 'success' &&
                            'border-green-200 bg-green-50/95 text-green-800 dark:border-green-800 dark:bg-green-900/90 dark:text-green-200',
                        toast.type === 'warning' &&
                            'border-amber-200 bg-amber-50/95 text-amber-800 dark:border-amber-800 dark:bg-amber-900/90 dark:text-amber-200',
                        toast.type === 'error' &&
                            'border-red-200 bg-red-50/95 text-red-800 dark:border-red-800 dark:bg-red-900/90 dark:text-red-200',
                    )}
                >
                    {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500 dark:text-green-400 sm:h-6 sm:w-6" />}
                    {toast.type === 'warning' && <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400 sm:h-6 sm:w-6" />}
                    {toast.type === 'error' && <XCircle className="h-5 w-5 shrink-0 text-red-500 dark:text-red-400 sm:h-6 sm:w-6" />}
                    <p className="text-sm font-medium leading-snug sm:text-base">{toast.message}</p>
                </div>
            ))}
        </div>
    );
}
