// Components
import { Head, useForm, usePage } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

interface VerifyOtpProps {
    email: string;
    status?: string;
}

interface VerifyOtpForm {
    email: string;
    otp: string;
    [key: string]: any; // Add index signature for Inertia compatibility
}

export default function VerifyOtp({ email, status }: VerifyOtpProps) {
    const { props } = usePage();
    const { data, setData, post, processing, errors } = useForm<VerifyOtpForm>({
        email: email || '',
        otp: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('otp.verify.submit'));
    };

    return (
        <AuthLayout title="Verify OTP" description="Enter the 6-digit code sent to your email">
            <Head title="Verify OTP - Mejeck IcePlant" />

            {status && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="text-center text-sm font-medium text-green-700 dark:text-green-300">{status}</div>
                </div>
            )}

            <div className="space-y-6">
                <form onSubmit={submit}>
                    <div className="grid gap-6">
                        <div className="grid gap-3">
                            <Label htmlFor="email" className="text-slate-700 dark:text-slate-200 font-medium">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                autoComplete="email"
                                value={data.email}
                                className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400 bg-slate-50 dark:bg-slate-800"
                                readOnly
                                onChange={(e) => setData('email', e.target.value)}
                            />
                            <InputError message={errors.email} />
                        </div>

                        <div className="grid gap-3">
                            <Label htmlFor="otp" className="text-slate-700 dark:text-slate-200 font-medium">6-Digit OTP Code</Label>
                            <Input
                                id="otp"
                                type="text"
                                name="otp"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                autoComplete="one-time-code"
                                value={data.otp}
                                autoFocus
                                onChange={(e) => {
                                    // Only allow numbers
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                    setData('otp', value);
                                }}
                                placeholder="000000"
                                className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400 text-center text-2xl tracking-widest font-mono"
                            />
                            <InputError message={errors.otp} />
                        </div>

                        <div className="my-6 flex items-center justify-start">
                            <Button 
                                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 border-0" 
                                disabled={processing}
                            >
                                {processing && <LoaderCircle className="h-4 w-4 animate-spin mr-2" />}
                                Verify OTP
                            </Button>
                        </div>
                    </div>
                </form>

                <div className="text-center text-sm text-slate-600 dark:text-slate-300 pt-4 border-t border-slate-200 dark:border-slate-600">
                    <div className="flex flex-col gap-3">
                        <div>
                            <span>Didn't receive the code? </span>
                            <TextLink 
                                href={route('password.request')} 
                                className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium transition-colors whitespace-nowrap"
                            >
                                Request a new one
                            </TextLink>
                        </div>
                        <div>
                            <span>Remember your password? </span>
                            <TextLink 
                                href={route('login')} 
                                className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium transition-colors whitespace-nowrap"
                            >
                                Sign in here
                            </TextLink>
                        </div>
                    </div>
                </div>
            </div>
        </AuthLayout>
    );
}
