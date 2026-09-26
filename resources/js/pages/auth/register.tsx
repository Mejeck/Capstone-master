import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

import { FieldHint } from '@/components/field-hint';
import InputError from '@/components/input-error';
import { PhoneInput } from '@/components/phone-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import AuthLayout from '@/layouts/auth-layout';
import PasswordStrengthIndicator from '@/components/password-strength-indicator';
import UsernameAvailability from '@/components/username-availability';
import PasswordConfirmationCheck from '@/components/password-confirmation-check';
import OtpVerificationModal from '@/components/otp-verification-modal';
import { EARLIEST_BIRTHDATE, MINIMUM_SIGNUP_AGE, latestAllowedBirthdate } from '@/lib/birthdate';

interface RegisterForm {
    username: string;
    full_name: string;
    email: string;
    contact_number: string;
    birthdate: string;
    password: string;
    password_confirmation: string;
    [key: string]: any; // Add index signature for Inertia compatibility
}

export default function Register() {
    const { data, setData, post, processing, errors, setError, reset } = useForm<RegisterForm>({
        username: '',
        full_name: '',
        email: '',
        contact_number: '',
        birthdate: '',
        password: '',
        password_confirmation: '',
    });

    const [showOtpModal, setShowOtpModal] = useState(false);
    const [isEmailVerified, setIsEmailVerified] = useState(false);

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        // Validate required fields and surface errors to the user
        const fieldLabels: Record<string, string> = {
            username: 'Username is required.',
            full_name: 'Full name is required.',
            email: 'Email address is required.',
            birthdate: 'Birthdate is required.',
            password: 'Password is required.',
            password_confirmation: 'Please confirm your password.',
        };
        const fieldErrors: Partial<Record<keyof RegisterForm, string>> = {};
        for (const field of Object.keys(fieldLabels) as (keyof RegisterForm)[]) {
            if (!data[field]) {
                fieldErrors[field] = fieldLabels[field as string];
            }
        }
        if (Object.keys(fieldErrors).length > 0) {
            setError(fieldErrors as any);
            return;
        }

        // Show OTP verification modal
        setShowOtpModal(true);
    };

    const handleEmailVerified = () => {
        setIsEmailVerified(true);
        
        // Proceed with registration after email verification
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <AuthLayout title="Create Account" description="Join Mejeck IcePlant and manage your ice business with ease">
            <Head title="Register - Mejeck IcePlant" />

            <form className="flex flex-col gap-6" onSubmit={submit}>
                <div className="grid gap-6">
                    <div className="grid gap-3">
                        <Label htmlFor="username" className="text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2">
                            <span>Username</span>
                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                        </Label>
                        <Input
                            id="username"
                            type="text"
                            required
                            autoFocus
                            tabIndex={1}
                            autoComplete="username"
                            value={data.username}
                            onChange={(e) => setData('username', e.target.value)}
                            disabled={processing}
                            placeholder="Choose a username"
                            className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm"
                        />
                        <InputError message={errors.username} />
                        <UsernameAvailability username={data.username} />
                    </div>

                    <div className="grid gap-3">
                        <Label htmlFor="full_name" className="text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2">
                            <span>Full Name</span>
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                        </Label>
                        <Input
                            id="full_name"
                            type="text"
                            required
                            tabIndex={2}
                            autoComplete="name"
                            value={data.full_name}
                            onChange={(e) => setData('full_name', e.target.value)}
                            disabled={processing}
                            placeholder="Your full name"
                            className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm"
                        />
                        <InputError message={errors.full_name} />
                    </div>

                    <div className="grid gap-3">
                        <Label htmlFor="email" className="text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2">
                            <span>Email Address</span>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            required
                            tabIndex={3}
                            autoComplete="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            disabled={processing}
                            placeholder="your@email.com"
                            className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm"
                        />
                        <InputError message={errors.email} />
                    </div>

                    <div className="grid gap-3">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="contact_number" className="text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2">
                                <span>Contact Number</span>
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            </Label>
                            <FieldHint text="10-digit mobile number after +63, starting with 9." />
                        </div>
                        <PhoneInput
                            id="contact_number"
                            tabIndex={4}
                            value={data.contact_number}
                            onChange={(value) => setData('contact_number', value)}
                            disabled={processing}
                            className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm"
                        />
                        <InputError message={errors.contact_number} />
                    </div>

                    <div className="grid gap-3">
                        <Label htmlFor="birthdate" className="text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2">
                            <span>Birthdate</span>
                            <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
                        </Label>
                        <Input
                            id="birthdate"
                            type="date"
                            required
                            tabIndex={5}
                            autoComplete="bday"
                            min={EARLIEST_BIRTHDATE}
                            max={latestAllowedBirthdate()}
                            value={data.birthdate}
                            onChange={(e) => setData('birthdate', e.target.value)}
                            disabled={processing}
                            className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm"
                        />
                        <InputError message={errors.birthdate} />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            You must be at least {MINIMUM_SIGNUP_AGE} to create an account, and 18 or older to order
                            beverages. We ask this so we can enforce that at checkout.
                        </p>
                    </div>

                    <div className="grid gap-3">
                        <Label htmlFor="password" className="text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2">
                            <span>Password</span>
                            <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                        </Label>
                        <PasswordInput
                            id="password"
                            required
                            tabIndex={6}
                            autoComplete="new-password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            disabled={processing}
                            placeholder="Create a strong password"
                            className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm"
                        />
                        <InputError message={errors.password} />
                        <PasswordStrengthIndicator password={data.password} />
                    </div>

                    <div className="grid gap-3">
                        <Label htmlFor="password_confirmation" className="text-slate-700 dark:text-slate-200 font-medium flex items-center gap-2">
                            <span>Confirm Password</span>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                        </Label>
                        <PasswordInput
                            id="password_confirmation"
                            required
                            tabIndex={7}
                            autoComplete="new-password"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            disabled={processing}
                            placeholder="Confirm your password"
                            className="border-cyan-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-cyan-700 dark:focus:border-cyan-400 bg-white/50 dark:bg-slate-700/50 backdrop-blur-sm"
                        />
                        <InputError message={errors.password_confirmation} />
                        <PasswordConfirmationCheck 
                            password={data.password} 
                            passwordConfirmation={data.password_confirmation} 
                        />
                    </div>

                    <Button 
                        type="submit" 
                        className="mt-4 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-600 hover:via-blue-600 hover:to-indigo-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 border-0 relative overflow-hidden group" 
                        tabIndex={8}
                        disabled={processing}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        {processing && <LoaderCircle className="h-4 w-4 animate-spin mr-2" />}
                        <span className="relative flex items-center justify-center gap-2">
                            Create IcePlant Account
                        </span>
                    </Button>
                </div>

                <div className="text-center text-sm text-slate-600 dark:text-slate-300 pt-4 border-t border-slate-200/50 dark:border-slate-600/50">
                    <span className="inline-flex items-center gap-2">
                        Already have an account?{' '}
                        <TextLink 
                            href={route('login')} 
                            className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium transition-colors inline-flex items-center gap-1"
                            tabIndex={9}
                        >
                            <span>Sign in</span>
                        </TextLink>
                    </span>
                </div>
            </form>

            {/* OTP Verification Modal */}
            <OtpVerificationModal
                isOpen={showOtpModal}
                onClose={() => setShowOtpModal(false)}
                email={data.email}
                onVerified={handleEmailVerified}
            />
        </AuthLayout>
    );
}
