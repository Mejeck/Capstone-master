import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import AuthLayout from '@/layouts/auth-layout';
import PasswordStrengthIndicator from '@/components/password-strength-indicator';
import PasswordConfirmationCheck from '@/components/password-confirmation-check';

interface ResetPasswordProps {
    otp?: string;
    email: string;
    status?: string;
}

interface ResetPasswordForm {
    otp: string;
    email: string;
    password: string;
    password_confirmation: string;
    [key: string]: any; // Add index signature for Inertia compatibility
}

export default function ResetPassword({ otp, email, status }: ResetPasswordProps) {
    const { data, setData, post, processing, errors, reset } = useForm<ResetPasswordForm>({
        otp: otp || '',
        email: email,
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <AuthLayout title="Reset Password" description="Create a new strong password for your Mejeck IcePlant account">
            <Head title="Reset Password - Mejeck IcePlant" />

            {status && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="text-center text-sm font-medium text-green-700 dark:text-green-300">{status}</div>
                </div>
            )}

            <form onSubmit={submit}>
                <div className="grid gap-6">
                    {/* Hidden OTP field - already verified */}
                    <input type="hidden" name="otp" value={data.otp} />

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
                        <Label htmlFor="password" className="text-slate-700 dark:text-slate-200 font-medium">New Password</Label>
                        <PasswordInput
                            id="password"
                            name="password"
                            autoComplete="new-password"
                            value={data.password}
                            className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400"
                            autoFocus
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="Create password"
                        />
                        <InputError message={errors.password} />
                        <PasswordStrengthIndicator password={data.password} />
                    </div>

                    <div className="grid gap-3">
                        <Label htmlFor="password_confirmation" className="text-slate-700 dark:text-slate-200 font-medium">Confirm New Password</Label>
                        <PasswordInput
                            id="password_confirmation"
                            name="password_confirmation"
                            autoComplete="new-password"
                            value={data.password_confirmation}
                            className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400"
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            placeholder="Confirm your new password"
                        />
                        <InputError message={errors.password_confirmation} />
                        <PasswordConfirmationCheck password={data.password} passwordConfirmation={data.password_confirmation} />
                    </div>

                    <Button 
                        type="submit" 
                        className="mt-4 w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 border-0" 
                        disabled={processing}
                    >
                        {processing && <LoaderCircle className="h-4 w-4 animate-spin mr-2" />}
                        Reset Password
                    </Button>
                </div>
            </form>

            <div className="text-center text-sm text-slate-600 dark:text-slate-300 pt-4 border-t border-slate-200 dark:border-slate-600">
                <div className="flex flex-col gap-3">
                    <div>
                        <span>Remember your password? </span>
                        <TextLink 
                            href={route('login')} 
                            className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium transition-colors whitespace-nowrap"
                        >
                            Sign in here
                        </TextLink>
                    </div>
                    <div>
                        <span>Don't have an account? </span>
                        <TextLink 
                            href={route('register')} 
                            className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium transition-colors whitespace-nowrap"
                        >
                            Create account
                        </TextLink>
                    </div>
                </div>
            </div>
        </AuthLayout>
    );
}
