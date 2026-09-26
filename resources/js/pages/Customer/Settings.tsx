import { Head, Link, usePage, useForm, router } from '@inertiajs/react';
import { User, Mail, Lock, AlertTriangle, Save, Trash2, Cake, LockKeyhole, MapPin, Plus, Star, Pencil, X, LogOut } from 'lucide-react';
import { useState } from 'react';
import { type SharedData } from '@/types';
import CustomerNav from '@/components/CustomerNav';
import PasswordStrengthIndicator from '@/components/password-strength-indicator';
import { PhoneInput } from '@/components/phone-input';
import { PasswordInput } from '@/components/ui/password-input';
import { MUNICIPALITIES } from '@/constants/municipalities';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirmModal } from '@/hooks/useConfirmModal';
import { EARLIEST_BIRTHDATE, latestAllowedBirthdate } from '@/lib/birthdate';

const PASSWORD_RULES = {
    minLength: 8,
    lowercase: /[a-z]/,
    uppercase: /[A-Z]/,
    number: /[0-9]/,
    special: /[@$!%*?&.]/,
};

function isStrongPassword(password: string): boolean {
    return (
        password.length >= PASSWORD_RULES.minLength &&
        PASSWORD_RULES.lowercase.test(password) &&
        PASSWORD_RULES.uppercase.test(password) &&
        PASSWORD_RULES.number.test(password) &&
        PASSWORD_RULES.special.test(password)
    );
}

interface UserAddress {
    id: number;
    label: string | null;
    house_no: string | null;
    street: string | null;
    barangay_name: string | null;
    municipality: string | null;
    landmark: string | null;
    barangay: string | null;
    purok: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
    is_default: boolean;
    full_address: string;
}

const emptyAddressForm = {
    house_no: '',
    street: '',
    barangay_name: '',
    municipality: '',
    landmark: '',
    is_default: false,
};

export default function CustomerSettings({ addresses = [] }: { addresses?: UserAddress[] }) {
    const { auth } = usePage<SharedData>().props;
    const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'addresses' | 'delete'>('profile');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showAddressForm, setShowAddressForm] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
    // Centered confirm() replacement, used for "Delete this address?" below.
    const { confirm, confirmModalProps } = useConfirmModal();

    const addressForm = useForm(emptyAddressForm);

    const openNewAddressForm = () => {
        setEditingAddressId(null);
        addressForm.reset();
        addressForm.setData(emptyAddressForm);
        setShowAddressForm(true);
    };

    const openEditAddressForm = (address: UserAddress) => {
        setEditingAddressId(address.id);
        addressForm.setData({
            house_no: address.house_no || '',
            street: address.street || '',
            barangay_name: address.barangay_name || '',
            municipality: address.municipality || '',
            landmark: address.landmark || '',
            is_default: address.is_default,
        });
        setShowAddressForm(true);
    };

    const closeAddressForm = () => {
        setShowAddressForm(false);
        setEditingAddressId(null);
        addressForm.reset();
        addressForm.clearErrors();
    };

    // No manual showToast on any of the three actions below — every one of
    // these backend endpoints already flashes 'success' with its own
    // message, which FlashToaster (mounted at the app root) picks up
    // automatically from the same Inertia visit. Adding one here would just
    // show the same thing twice.
    const submitAddress = (e: React.FormEvent) => {
        e.preventDefault();
        const onSuccess = () => closeAddressForm();

        if (editingAddressId) {
            addressForm.put(`/customer/settings/addresses/${editingAddressId}`, { onSuccess });
        } else {
            addressForm.post('/customer/settings/addresses', { onSuccess });
        }
    };

    const setDefaultAddress = (id: number) => {
        router.put(`/customer/settings/addresses/${id}/default`, {}, { preserveScroll: true });
    };

    const deleteAddress = async (id: number) => {
        if (await confirm({ message: 'Delete this address?', danger: true })) {
            router.delete(`/customer/settings/addresses/${id}`, { preserveScroll: true });
        }
    };

    // Profile form
    const profileForm = useForm({
        name: auth.user?.full_name || '',
        email: auth.user?.email || '',
        contact_number: (auth.user as any)?.contact_number || '',
        birthdate: (auth.user as any)?.birthdate || '',
    });

    // Once a birthdate is on file, it's locked — it's used for the beverage
    // age check, so it can't be self-edited afterward (the backend enforces
    // this too; this just keeps the UI honest about it).
    const birthdateLocked = !!(auth.user as any)?.birthdate;

    // Password form
    const passwordForm = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    // Same as above — the backend already flashes 'success' with this exact
    // message for both of these.
    const updateProfile = (e: React.FormEvent) => {
        e.preventDefault();
        profileForm.put('/customer/settings/profile', {
            onSuccess: () => profileForm.reset(),
        });
    };

    const updatePassword = (e: React.FormEvent) => {
        e.preventDefault();
        passwordForm.put('/customer/settings/password', {
            onSuccess: () => passwordForm.reset(),
        });
    };

    // Delete-account form (requires re-entering the current password)
    const deleteForm = useForm({ password: '' });

    const submitDeleteAccount = (e: React.FormEvent) => {
        e.preventDefault();
        deleteForm.delete('/customer/settings/account', {
            onSuccess: () => {
                window.location.href = '/';
            },
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
            <Head title="Settings - Mejeck Ice Plant" />
            <CustomerNav currentPage="profile" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
                {/* Tabs */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 mb-6">
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 p-2">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                                    activeTab === 'profile'
                                        ? 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-200'
                                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                                }`}
                            >
                                <User className="w-4 h-4 mr-2" />
                                Profile
                            </button>
                            <button
                                onClick={() => setActiveTab('password')}
                                className={`flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                                    activeTab === 'password'
                                        ? 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-200'
                                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                                }`}
                            >
                                <Lock className="w-4 h-4 mr-2" />
                                Password
                            </button>
                            <button
                                onClick={() => setActiveTab('addresses')}
                                className={`flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                                    activeTab === 'addresses'
                                        ? 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-200'
                                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                                }`}
                            >
                                <MapPin className="w-4 h-4 mr-2" />
                                Addresses
                            </button>
                            <Link
                                href={route('logout')}
                                method="post"
                                as="button"
                                className="flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Logout
                            </Link>
                            <button
                                onClick={() => setActiveTab('delete')}
                                className={`flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap col-span-2 sm:col-span-1 ${
                                    activeTab === 'delete'
                                        ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                                }`}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Account
                            </button>
                    </div>
                </div>

                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Profile Information</h2>
                        <form onSubmit={updateProfile} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Full Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={profileForm.data.name}
                                        onChange={(e) => profileForm.setData('name', e.target.value)}
                                        className="pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
                                        placeholder="Enter your full name"
                                    />
                                </div>
                                {profileForm.errors.name && (
                                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{profileForm.errors.name}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        value={profileForm.data.email}
                                        onChange={(e) => profileForm.setData('email', e.target.value)}
                                        className="pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
                                        placeholder="Enter your email address"
                                    />
                                </div>
                                {profileForm.errors.email && (
                                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{profileForm.errors.email}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Contact Number
                                </label>
                                <PhoneInput
                                    value={profileForm.data.contact_number}
                                    onChange={(value) => profileForm.setData('contact_number', value)}
                                    className="py-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                />
                                {(profileForm.errors as any).contact_number && (
                                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{(profileForm.errors as any).contact_number}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Birthdate
                                </label>
                                <div className="relative">
                                    {birthdateLocked ? (
                                        <LockKeyhole className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    ) : (
                                        <Cake className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    )}
                                    <input
                                        type="date"
                                        min={EARLIEST_BIRTHDATE}
                                        max={latestAllowedBirthdate()}
                                        value={profileForm.data.birthdate}
                                        onChange={(e) => profileForm.setData('birthdate', e.target.value)}
                                        disabled={birthdateLocked}
                                        className="pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {birthdateLocked
                                        ? 'Your birthdate is locked and cannot be changed. Contact the store if this was entered incorrectly.'
                                        : 'Required to order beverages (18+ only). This cannot be changed once saved, so enter it carefully.'}
                                </p>
                                {(profileForm.errors as any).birthdate && (
                                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{(profileForm.errors as any).birthdate}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={profileForm.processing}
                                className="flex items-center justify-center w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-5 h-5 mr-2" />
                                {profileForm.processing ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                )}

                {/* Password Tab */}
                {activeTab === 'password' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Change Password</h2>
                        <form onSubmit={updatePassword} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Current Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                                    <PasswordInput
                                        value={passwordForm.data.current_password}
                                        onChange={(e) => passwordForm.setData('current_password', e.target.value)}
                                        className="pl-10 pr-10 py-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus-visible:ring-cyan-500 focus:border-transparent"
                                        placeholder="Enter your current password"
                                    />
                                </div>
                                {passwordForm.errors.current_password && (
                                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordForm.errors.current_password}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    New Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                                    <PasswordInput
                                        value={passwordForm.data.password}
                                        onChange={(e) => passwordForm.setData('password', e.target.value)}
                                        className="pl-10 pr-10 py-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus-visible:ring-cyan-500 focus:border-transparent"
                                        placeholder="Enter your new password"
                                    />
                                </div>
                                {passwordForm.errors.password && (
                                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordForm.errors.password}</p>
                                )}
                                <PasswordStrengthIndicator password={passwordForm.data.password} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                                    <PasswordInput
                                        value={passwordForm.data.password_confirmation}
                                        onChange={(e) => passwordForm.setData('password_confirmation', e.target.value)}
                                        className="pl-10 pr-10 py-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus-visible:ring-cyan-500 focus:border-transparent"
                                        placeholder="Confirm your new password"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={
                                    passwordForm.processing ||
                                    !isStrongPassword(passwordForm.data.password) ||
                                    passwordForm.data.password !== passwordForm.data.password_confirmation
                                }
                                className="flex items-center justify-center w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-5 h-5 mr-2" />
                                {passwordForm.processing ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>
                    </div>
                )}

                {/* Addresses Tab */}
                {activeTab === 'addresses' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Addresses</h2>
                            {!showAddressForm && (
                                <button
                                    onClick={openNewAddressForm}
                                    className="flex items-center px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Address
                                </button>
                            )}
                        </div>

                        {!showAddressForm && (
                            <>
                                {addresses.length === 0 ? (
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                                        You don't have any saved addresses yet. Add one so you don't have to type it in every time you order.
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {addresses.map((address) => (
                                            <div
                                                key={address.id}
                                                className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 flex items-start justify-between gap-4"
                                            >
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <MapPin className="w-5 h-5 text-cyan-500 mt-0.5 flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold text-gray-900 dark:text-white">
                                                                {address.label || 'Address'}
                                                            </span>
                                                            {address.is_default && (
                                                                <span className="flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-200">
                                                                    <Star className="w-3 h-3 mr-1" />
                                                                    Default
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 break-words">
                                                            {address.full_address}
                                                        </p>
                                                        {address.landmark && (
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                                Landmark: {address.landmark}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => openEditAddressForm(address)}
                                                            className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteAddress(address.id)}
                                                            className="p-2 rounded-lg bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    {!address.is_default && (
                                                        <button
                                                            onClick={() => setDefaultAddress(address.id)}
                                                            className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap"
                                                        >
                                                            Set as default
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {showAddressForm && (
                            <form onSubmit={submitAddress} className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {editingAddressId ? 'Edit Address' : 'New Address'}
                                    </h3>
                                    <button type="button" onClick={closeAddressForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">House No.</label>
                                        <input
                                            type="text"
                                            value={addressForm.data.house_no}
                                            onChange={(e) => addressForm.setData('house_no', e.target.value)}
                                            className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
                                        />
                                        {addressForm.errors.house_no && (
                                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{addressForm.errors.house_no}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Street</label>
                                        <input
                                            type="text"
                                            value={addressForm.data.street}
                                            onChange={(e) => addressForm.setData('street', e.target.value)}
                                            className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
                                        />
                                        {addressForm.errors.street && (
                                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{addressForm.errors.street}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Barangay</label>
                                        <input
                                            type="text"
                                            value={addressForm.data.barangay_name}
                                            onChange={(e) => addressForm.setData('barangay_name', e.target.value)}
                                            className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
                                        />
                                        {addressForm.errors.barangay_name && (
                                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{addressForm.errors.barangay_name}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Municipality/City</label>
                                        <select
                                            value={addressForm.data.municipality}
                                            onChange={(e) => addressForm.setData('municipality', e.target.value)}
                                            className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
                                        >
                                            <option value="" disabled>Select municipality</option>
                                            {MUNICIPALITIES.map((m) => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                        {addressForm.errors.municipality && (
                                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{addressForm.errors.municipality}</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Landmark</label>
                                    <input
                                        type="text"
                                        value={addressForm.data.landmark}
                                        onChange={(e) => addressForm.setData('landmark', e.target.value)}
                                        className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent w-full"
                                    />
                                </div>

                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                    <input
                                        type="checkbox"
                                        checked={addressForm.data.is_default}
                                        onChange={(e) => addressForm.setData('is_default', e.target.checked)}
                                        className="rounded border-gray-300 dark:border-gray-600 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    Set as default address
                                </label>

                                <div className="flex gap-3">
                                    <button
                                        type="submit"
                                        disabled={addressForm.processing}
                                        className="flex items-center justify-center flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Save className="w-5 h-5 mr-2" />
                                        {addressForm.processing ? 'Saving...' : 'Save Address'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeAddressForm}
                                        className="px-6 py-3 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-lg font-semibold transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* Delete Account Tab */}
                {activeTab === 'delete' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-red-200 dark:border-red-900 p-6">
                        <div className="flex items-center mb-6">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mr-4">
                                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">Delete Account</h2>
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-4 mb-6">
                            <p className="text-red-800 dark:text-red-300 font-medium mb-2">Warning: This action cannot be undone!</p>
                            <p className="text-red-700 dark:text-red-400 text-sm">
                                Deleting your account will permanently remove all your data including:
                            </p>
                            <ul className="list-disc list-inside text-red-700 dark:text-red-400 text-sm mt-2 space-y-1">
                                <li>Your profile information</li>
                                <li>Order history</li>
                                <li>Delivery addresses</li>
                                <li>All account settings</li>
                            </ul>
                        </div>

                        {!showDeleteConfirm ? (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="flex items-center justify-center w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-all"
                            >
                                <Trash2 className="w-5 h-5 mr-2" />
                                Delete My Account
                            </button>
                        ) : (
                            <form onSubmit={submitDeleteAccount} className="space-y-4">
                                <p className="text-gray-700 dark:text-gray-300">
                                    Enter your password to confirm. This action cannot be undone.
                                </p>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                                        <PasswordInput
                                            value={deleteForm.data.password}
                                            onChange={(e) => deleteForm.setData('password', e.target.value)}
                                            className="pl-10 pr-10 py-3 border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus-visible:ring-red-500 focus:border-transparent"
                                            placeholder="Enter your current password"
                                            autoFocus
                                        />
                                    </div>
                                    {deleteForm.errors.password && (
                                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{deleteForm.errors.password}</p>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={deleteForm.processing || !deleteForm.data.password}
                                    className="flex items-center justify-center w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Trash2 className="w-5 h-5 mr-2" />
                                    {deleteForm.processing ? 'Deleting...' : 'Yes, Delete My Account Permanently'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        deleteForm.reset();
                                        deleteForm.clearErrors();
                                    }}
                                    className="flex items-center justify-center w-full bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white py-3 rounded-lg font-semibold transition-all"
                                >
                                    Cancel
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>

            <ConfirmModal {...confirmModalProps} />
        </div>
    );
}
