import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, KeyboardEventHandler, useRef } from 'react';

import { FieldHint } from '@/components/field-hint';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import AuthLayout from '@/layouts/auth-layout';
import RecaptchaCheckbox, { RecaptchaCheckboxHandle } from '@/components/recaptcha-checkbox';
import { RECAPTCHA_SITE_KEY } from '@/lib/recaptcha';

interface LoginForm {
    login: string;
    password: string;
    remember: boolean;
    recaptcha_token: string;
    [key: string]: any; // Add index signature for Inertia compatibility
}

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const { data, setData, post, processing, errors, reset } = useForm<LoginForm>({
        login: '',
        password: '',
        remember: false,
        recaptcha_token: '',
    });
    const recaptchaRef = useRef<RecaptchaCheckboxHandle>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    // The checkbox only appears once both fields are filled in, rather than
    // being available from the start.
    const readyForRecaptcha = data.login.trim() !== '' && data.password.trim() !== '';

    // Pressing Enter in the username/email field moves to the password
    // field instead of submitting the form early (before a password has
    // even been typed).
    const focusPasswordOnEnter: KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            passwordRef.current?.focus();
        }
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => {
                reset('password');
                recaptchaRef.current?.reset();
            },
        });
    };

    return (
        <AuthLayout title="Welcome Back" description="Sign in to your Mejeck IcePlant account to manage your ice business">
            <Head title="Login - Mejeck IcePlant" />

            <form className="flex flex-col gap-6" onSubmit={submit}>
                <div className="grid gap-6">
                    <div className="grid gap-3">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="login" className="text-slate-700 dark:text-slate-200 font-medium">
                                Username or Email
                            </Label>
                            <FieldHint text="Use the username or email address you registered with." />
                        </div>
                        <Input
                            id="login"
                            type="text"
                            required
                            autoFocus
                            tabIndex={1}
                            autoComplete="username"
                            value={data.login}
                            onChange={(e) => setData('login', e.target.value)}
                            onKeyDown={focusPasswordOnEnter}
                            placeholder="Username or email"
                            className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm"
                        />
                        <InputError message={errors.login} />
                    </div>

                    <div className="grid gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="password" className="text-slate-700 dark:text-slate-200 font-medium">
                                    Password
                                </Label>
                                <FieldHint text="Your password is case-sensitive." />
                            </div>
                            {canResetPassword && (
                                <TextLink
                                    href={route('password.request')}
                                    className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 text-sm transition-colors flex items-center gap-1"
                                    tabIndex={5}
                                >
                                    <span className="whitespace-nowrap">Forgot password?</span>
                                </TextLink>
                            )}
                        </div>
                        <PasswordInput
                            id="password"
                            ref={passwordRef}
                            required
                            tabIndex={2}
                            autoComplete="current-password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="Enter your password"
                            className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm"
                        />
                        <InputError message={errors.password} />
                    </div>

                    <div className="flex items-center py-2 bg-cyan-50/50 dark:bg-cyan-900/20 rounded-lg px-4">
                        <div className="flex items-center space-x-3">
                            <Checkbox
                                id="remember"
                                name="remember"
                                checked={data.remember}
                                onCheckedChange={(checked) => setData('remember', Boolean(checked))}
                                tabIndex={3}
                                className="border-cyan-300 text-cyan-600 focus:ring-cyan-500/20 dark:border-cyan-600 dark:text-cyan-400"
                            />
                            <Label htmlFor="remember" className="text-slate-600 dark:text-slate-300 text-sm font-medium">Remember me</Label>
                        </div>
                    </div>

                    {readyForRecaptcha && (
                        <div className="grid gap-2">
                            <RecaptchaCheckbox ref={recaptchaRef} onChange={(token) => setData('recaptcha_token', token)} />
                            <InputError message={errors.recaptcha_token} />
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="mt-2 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-600 hover:via-blue-600 hover:to-indigo-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 border-0 relative overflow-hidden group"
                        tabIndex={4}
                        disabled={processing || (!!RECAPTCHA_SITE_KEY && (!readyForRecaptcha || !data.recaptcha_token))}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        {processing && <LoaderCircle className="h-4 w-4 animate-spin mr-2" />}
                        <span className="relative flex items-center justify-center gap-2">
                            Sign In to IcePlant
                        </span>
                    </Button>
                </div>

                <div className="text-center text-sm text-slate-600 dark:text-slate-300 pt-4 border-t border-slate-200/50 dark:border-slate-600/50">
                    <span className="inline-flex items-center gap-2">
                        Don't have an account?{' '}
                        <TextLink 
                            href={route('register')} 
                            className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium transition-colors inline-flex items-center gap-1"
                            tabIndex={6}
                        >
                            <span className="whitespace-nowrap">Create account</span>
                        </TextLink>
                    </span>
                </div>
            </form>

            {status && (
                <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-emerald-400/10"></div>
                    <div className="relative text-center text-sm font-medium text-green-700 dark:text-green-300 flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        {status}
                    </div>
                </div>
            )}
        </AuthLayout>
    );
}
