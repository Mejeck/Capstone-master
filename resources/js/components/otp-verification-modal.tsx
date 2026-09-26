import { useEffect, useRef, useState } from 'react';
import { X, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/input-error';
import RecaptchaCheckbox, { RecaptchaCheckboxHandle } from '@/components/recaptcha-checkbox';
import { showToast } from '@/lib/toast';
import { RECAPTCHA_SITE_KEY } from '@/lib/recaptcha';

interface OtpVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    email: string;
    onVerified: () => void;
}

export default function OtpVerificationModal({
    isOpen,
    onClose,
    email,
    onVerified,
}: OtpVerificationModalProps) {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [recaptchaToken, setRecaptchaToken] = useState('');
    const recaptchaRef = useRef<RecaptchaCheckboxHandle>(null);

    // Close with the Escape key — self-contained so any future caller gets
    // this for free, the same way GCashProofModal owns its own Esc guard.
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSendOtp = async () => {
        setSendingOtp(true);
        setError('');

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

            if (!csrfToken) {
                showToast('error', 'CSRF token not found. Please refresh the page.');
                return;
            }

            const response = await fetch(route('email-verification.send-otp'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ email, recaptcha_token: recaptchaToken }),
            });

            recaptchaRef.current?.reset();

            if (!response.ok) {
                showToast('error', 'Server error. Please try again.');
                return;
            }

            const data = await response.json();

            if (data.success) {
                setOtpSent(true);
                setError('');
                showToast('success', `We sent a 6-digit code to ${email}.`);
            } else {
                showToast('error', data.message || 'Failed to send OTP. Please try again.');
            }
        } catch (err) {
            showToast('error', 'Network error. Please check your connection.');
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            
            if (!csrfToken) {
                setError('CSRF token not found. Please refresh the page.');
                return;
            }
            
            const response = await fetch(route('email-verification.verify-otp'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ email, otp }),
            });

            if (!response.ok) {
                setError('Server error. Please try again.');
                return;
            }

            const data = await response.json();

            if (data.success) {
                onVerified();
                onClose();
            } else {
                setError(data.message || 'Invalid OTP. Please try again.');
            }
        } catch (err) {
            setError('Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setOtp('');
        setError('');
        setOtpSent(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Email Verification</h2>
                                <p className="text-sm text-white/90">Verify your email address</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Rendered once, outside both branches below, so the same
                        checkbox instance (and its token) stays valid whether
                        this is the first send or a resend from the OTP screen —
                        a v2 token can only be used once, so each send needs a
                        freshly-checked box either way. */}
                    <div className="flex justify-center mb-4">
                        <RecaptchaCheckbox ref={recaptchaRef} onChange={setRecaptchaToken} />
                    </div>

                    {!otpSent ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg">
                                <Mail className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                                <div className="text-sm">
                                    <p className="font-medium text-cyan-900 dark:text-cyan-100">
                                        We'll send a 6-digit code to:
                                    </p>
                                    <p className="text-cyan-700 dark:text-cyan-300 font-mono">{email}</p>
                                </div>
                            </div>

                            <Button
                                onClick={handleSendOtp}
                                disabled={sendingOtp || (!!RECAPTCHA_SITE_KEY && !recaptchaToken)}
                                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 border-0"
                            >
                                {sendingOtp ? (
                                    <>
                                        <LoaderCircle className="h-4 w-4 animate-spin mr-2" />
                                        Sending OTP...
                                    </>
                                ) : (
                                    'Send Verification Code'
                                )}
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                <Mail className="w-5 h-5 text-green-600 dark:text-green-400" />
                                <div className="text-sm">
                                    <p className="font-medium text-green-900 dark:text-green-100">
                                        OTP sent to:
                                    </p>
                                    <p className="text-green-700 dark:text-green-300 font-mono">{email}</p>
                                </div>
                            </div>

                            <div className="grid gap-3">
                                <Label htmlFor="otp" className="text-slate-700 dark:text-slate-200 font-medium">
                                    Enter 6-Digit Code
                                </Label>
                                <Input
                                    id="otp"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                    value={otp}
                                    autoFocus
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                        setOtp(value);
                                    }}
                                    placeholder="000000"
                                    className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400 text-center text-2xl tracking-widest font-mono"
                                />
                                <InputError message={error} />
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setOtpSent(false)}
                                    disabled={loading}
                                    className="flex-1 border-cyan-200 hover:bg-cyan-50 dark:border-cyan-700 dark:hover:bg-cyan-900/20"
                                >
                                    Back
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading || otp.length !== 6}
                                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 border-0"
                                >
                                    {loading ? (
                                        <>
                                            <LoaderCircle className="h-4 w-4 animate-spin mr-2" />
                                            Verifying...
                                        </>
                                    ) : (
                                        'Verify'
                                    )}
                                </Button>
                            </div>

                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={handleSendOtp}
                                    disabled={sendingOtp || (!!RECAPTCHA_SITE_KEY && !recaptchaToken)}
                                    className="text-sm text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium transition-colors disabled:opacity-50"
                                >
                                    {sendingOtp ? 'Sending...' : 'Resend Code'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
