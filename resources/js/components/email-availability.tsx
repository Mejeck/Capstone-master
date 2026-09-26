import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, LoaderCircle, AlertCircle } from 'lucide-react';

interface EmailAvailabilityProps {
    email: string;
}

/**
 * Loose enough to avoid nagging while someone is mid-address, and to leave
 * the real judgement to the backend's email rule.
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Says whether an email address already has an account, while it is being
 * typed — the counterpart to UsernameAvailability and ContactAvailability.
 *
 * Worth surfacing early here more than anywhere else on this form: the next
 * thing the customer does is ask for an email OTP, and registration only
 * refuses a duplicate address at the very end, once that code has already
 * been sent and typed back in.
 */
export default function EmailAvailability({ email }: EmailAvailabilityProps) {
    const [availability, setAvailability] = useState<{
        status: 'idle' | 'checking' | 'available' | 'taken' | 'error';
        message: string;
    }>({
        status: 'idle',
        message: '',
    });

    useEffect(() => {
        if (!email || !LOOKS_LIKE_EMAIL.test(email)) {
            setAvailability({ status: 'idle', message: '' });
            return;
        }

        let cancelled = false;

        const timeoutId = setTimeout(async () => {
            setAvailability({ status: 'checking', message: 'Checking availability...' });

            try {
                const response = await fetch(`/api/check-email?email=${encodeURIComponent(email)}`, {
                    headers: { Accept: 'application/json' },
                });

                if (cancelled) return;

                if (!response.ok) {
                    setAvailability({ status: 'error', message: 'Unable to verify. Please try again.' });
                    return;
                }

                const data = await response.json();

                setAvailability(
                    data.available
                        ? { status: 'available', message: 'Email address is available!' }
                        : { status: 'taken', message: 'This email already has an account. Try logging in instead.' },
                );
            } catch {
                if (!cancelled) {
                    setAvailability({ status: 'error', message: 'Unable to verify. Please try again.' });
                }
            }
        }, 500); // Debounce, matching the username and contact checks

        // A reply for an address the user has already edited past must not
        // overwrite the state for what is now in the field.
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [email]);

    if (availability.status === 'idle') {
        return null;
    }

    return (
        <div className="mt-1">
            <div
                className={`flex items-center gap-2 text-xs ${
                    availability.status === 'checking'
                        ? 'text-slate-500 dark:text-slate-400'
                        : availability.status === 'available'
                          ? 'text-green-600 dark:text-green-400'
                          : availability.status === 'error'
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400'
                }`}
            >
                {availability.status === 'checking' && <LoaderCircle className="h-3 w-3 animate-spin" />}
                {availability.status === 'available' && <CheckCircle className="h-3 w-3" />}
                {availability.status === 'taken' && <XCircle className="h-3 w-3" />}
                {availability.status === 'error' && <AlertCircle className="h-3 w-3" />}
                <span>{availability.message}</span>
            </div>
        </div>
    );
}
