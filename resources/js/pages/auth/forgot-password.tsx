// Components
import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useRef } from 'react';

import { FieldHint } from '@/components/field-hint';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
import RecaptchaCheckbox, { RecaptchaCheckboxHandle } from '@/components/recaptcha-checkbox';
import { RECAPTCHA_SITE_KEY } from '@/lib/recaptcha';

interface ForgotPasswordForm {
    login: string;
    recaptcha_token: string;
    [key: string]: any; // Add index signature for Inertia compatibility
}

export default function ForgotPassword({ status }: { status?: string }) {
    const { data, setData, post, processing, errors } = useForm<ForgotPasswordForm>({
        login: '',
        recaptcha_token: '',
    });
    const recaptchaRef = useRef<RecaptchaCheckboxHandle>(null);
    // The checkbox only appears once the field is filled in.
    const readyForRecaptcha = data.login.trim() !== '';

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('password.email'), {
            onFinish: () => recaptchaRef.current?.reset(),
        });
    };

    return (
        <AuthLayout title="Reset Password" description="Enter your username or email to receive a password reset OTP">
            <Head title="Reset Password - Mejeck IcePlant" />

            {status && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="text-center text-sm font-medium text-green-700 dark:text-green-300">{status}</div>
                </div>
            )}

            <div className="space-y-6">
                <form onSubmit={submit}>
                    <div className="grid gap-3">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="login" className="text-slate-700 dark:text-slate-200 font-medium">Username or Email</Label>
                            <FieldHint text="Use the username or email address you registered with." />
                        </div>
                        <Input
                            id="login"
                            type="text"
                            name="login"
                            autoComplete="off"
                            value={data.login}
                            autoFocus
                            onChange={(e) => setData('login', e.target.value)}
                            placeholder="Enter your username or email address"
                            className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400"
                        />

                        <InputError message={errors.login} />
                    </div>

                    {readyForRecaptcha && (
                        <div className="grid gap-2 mt-4">
                            <RecaptchaCheckbox ref={recaptchaRef} onChange={(token) => setData('recaptcha_token', token)} />
                            <InputError message={errors.recaptcha_token} />
                        </div>
                    )}

                    <div className="my-6 flex items-center justify-start">
                        <Button
                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 border-0"
                            disabled={processing || (!!RECAPTCHA_SITE_KEY && (!readyForRecaptcha || !data.recaptcha_token))}
                        >
                            {processing && <LoaderCircle className="h-4 w-4 animate-spin mr-2" />}
                            Send Reset Link
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
            </div>
        </AuthLayout>
    );
}
