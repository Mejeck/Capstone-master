import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, LoaderCircle, AlertCircle } from 'lucide-react';

interface ContactAvailabilityProps {
    /** The full stored value from PhoneInput, e.g. "+639171234567" or "". */
    contactNumber: string;
}

/** Same shape the backend enforces: +63, then 9, then nine more digits. */
const COMPLETE_NUMBER = /^\+639\d{9}$/;

/**
 * Tells the customer, while they type, whether a contact number is already
 * registered — the phone equivalent of UsernameAvailability, checked against
 * the same unique rule the registration request enforces.
 *
 * The number is optional, so an empty field says nothing at all. A partly
 * typed number is not reported as taken either: it just asks for the rest of
 * the digits, since a prefix of someone else's number is not a collision.
 */
export default function ContactAvailability({ contactNumber }: ContactAvailabilityProps) {
    const [availability, setAvailability] = useState<{
        status: 'idle' | 'incomplete' | 'checking' | 'available' | 'taken' | 'error';
        message: string;
    }>({
        status: 'idle',
        message: '',
    });

    useEffect(() => {
        if (!contactNumber) {
            setAvailability({ status: 'idle', message: '' });
            return;
        }

        if (!COMPLETE_NUMBER.test(contactNumber)) {
            setAvailability({
                status: 'incomplete',
                message: 'Enter all 10 digits after +63.',
            });
            return;
        }

        let cancelled = false;

        const timeoutId = setTimeout(async () => {
            setAvailability({ status: 'checking', message: 'Checking availability...' });

            try {
                const response = await fetch(
                    `/api/check-contact?contact_number=${encodeURIComponent(contactNumber)}`,
                    { headers: { Accept: 'application/json' } },
                );

                if (cancelled) return;

                if (!response.ok) {
                    setAvailability({ status: 'error', message: 'Unable to verify. Please try again.' });
                    return;
                }

                const data = await response.json();

                setAvailability(
                    data.available
                        ? { status: 'available', message: 'Contact number is available!' }
                        : { status: 'taken', message: 'This number is already registered to another account' },
                );
            } catch {
                if (!cancelled) {
                    setAvailability({ status: 'error', message: 'Unable to verify. Please try again.' });
                }
            }
        }, 500); // Debounce, matching UsernameAvailability

        // A reply for a number the user has already edited past must not
        // overwrite the state for what is now in the field.
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [contactNumber]);

    if (availability.status === 'idle') {
        return null;
    }

    return (
        <div className="mt-1">
            <div
                className={`flex items-center gap-2 text-xs ${
                    availability.status === 'checking' || availability.status === 'incomplete'
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
