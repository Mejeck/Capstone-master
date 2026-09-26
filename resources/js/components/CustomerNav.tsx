import { Link, usePage } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import {
    Home,
    ShoppingCart,
    Package,
    FileText,
    User,
    LogOut,
    Settings,
    ChevronDown,
    Sun,
    Moon,
    Monitor,
    MapPin,
} from 'lucide-react';
import AppearanceToggleDropdown from '@/components/appearance-dropdown';
import { useAppearance } from '@/hooks/use-appearance';
import { type SharedData } from '@/types';
import { getCartStorageKey } from '@/lib/cart';

type NavPage = 'home' | 'orders' | 'reports' | 'profile' | 'cart' | 'visit-us';

interface CustomerNavProps {
    currentPage: NavPage;
}

export default function CustomerNav({ currentPage }: CustomerNavProps) {
    const { auth } = usePage<SharedData>().props;
    const { appearance, updateAppearance } = useAppearance();
    const [cartCount, setCartCount] = useState(0);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    // Keep cart badge in sync with localStorage (same-tab and cross-tab)
    const cartStorageKey = getCartStorageKey(auth.user?.id);
    useEffect(() => {
        const readCount = () => {
            try {
                const saved = localStorage.getItem(cartStorageKey);
                const items: Array<{ quantity: number }> = saved ? JSON.parse(saved) : [];
                setCartCount(items.reduce((s, i) => s + (i.quantity || 0), 0));
            } catch {
                setCartCount(0);
            }
        };
        readCount();
        window.addEventListener('storage', readCount);
        // Poll every 600 ms so same-tab cart updates reflect in the badge
        const id = setInterval(readCount, 600);
        return () => {
            window.removeEventListener('storage', readCount);
            clearInterval(id);
        };
    }, [cartStorageKey]);

    // Close profile dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const desktopLink = (page: NavPage) =>
        `flex items-center gap-1.5 text-sm font-medium transition-colors ${
            currentPage === page
                ? 'text-cyan-600 dark:text-cyan-400'
                : 'text-gray-600 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400'
        }`;

    const bottomLink = (page: NavPage) =>
        `flex flex-col items-center gap-0.5 py-2 px-4 min-w-0 transition-colors ${
            currentPage === page
                ? 'text-cyan-600 dark:text-cyan-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-cyan-600 dark:hover:text-cyan-400'
        }`;

    const CartBadge = () =>
        cartCount > 0 ? (
            <span className="absolute -top-2 -right-2 bg-cyan-500 text-white text-[10px] font-bold rounded-full min-w-[17px] h-[17px] flex items-center justify-center px-1 leading-none">
                {cartCount > 99 ? '99+' : cartCount}
            </span>
        ) : null;

    return (
        <>
            {/* ═══════════���═══ DESKTOP TOP NAV (md+) ═══════════════ */}
            <header className="hidden md:block bg-slate-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between h-20">
                    {/* Logo - near the left edge of the screen on desktop, with breathing room */}
                    <Link href="/customer/dashboard" className="flex items-center gap-3 flex-shrink-0 pl-8 sm:pl-12 lg:pl-16">
                        <img
                            src="/images/LOGO.jpg"
                            alt="Mejeck Ice Plant Logo"
                            className="w-10 h-10 rounded-lg object-cover"
                        />
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                            Mejeck Ice Plant
                        </span>
                    </Link>

                    <div className="flex flex-1 items-center justify-between max-w-7xl mx-auto pl-8 pr-4 sm:pr-6 lg:pr-8">
                        {/* Center links */}
                        <nav className="flex items-center gap-7">
                            <Link href="/customer/dashboard" className={desktopLink('home')}>
                                <Home className="w-4 h-4" />
                                Home
                            </Link>
                            <Link href="/customer/my-orders" className={desktopLink('orders')}>
                                <Package className="w-4 h-4" />
                                My Orders
                            </Link>
                            <Link href={route('customer.reports')} className={desktopLink('reports')}>
                                <FileText className="w-4 h-4" />
                                My Reports
                            </Link>
                            <Link href={route('customer.visit-us')} className={desktopLink('visit-us')}>
                                <MapPin className="w-4 h-4" />
                                Visit Us
                            </Link>
                        </nav>

                        {/* Right: Cart + Profile */}
                        <div className="flex items-center gap-5">
                            {/* Cart icon */}
                            <Link
                                href="/customer/cart"
                                title="My Cart"
                                className={`relative flex items-center transition-colors ${
                                    currentPage === 'cart'
                                        ? 'text-cyan-600 dark:text-cyan-400'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400'
                                }`}
                            >
                                <ShoppingCart className="w-6 h-6" />
                                <CartBadge />
                            </Link>

                            {/* Profile dropdown */}
                            <div className="relative" ref={profileRef}>
                                <button
                                    onClick={() => setProfileOpen(p => !p)}
                                    className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                    </div>
                                    <span className="hidden lg:block max-w-[130px] truncate">
                                        {auth.user?.full_name}
                                    </span>
                                    <ChevronDown
                                        className={`w-4 h-4 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {profileOpen && (
                                    <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 py-1 z-50">
                                        {/* Name + email */}
                                        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                {auth.user?.full_name}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                {auth.user?.email}
                                            </p>
                                        </div>
                                        {/* Theme */}
                                        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-slate-700">
                                            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Theme</p>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => updateAppearance('light')}
                                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${appearance === 'light' ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                                                >
                                                    <Sun className="w-3.5 h-3.5" /> Light
                                                </button>
                                                <button
                                                    onClick={() => updateAppearance('dark')}
                                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${appearance === 'dark' ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                                                >
                                                    <Moon className="w-3.5 h-3.5" /> Dark
                                                </button>
                                                <button
                                                    onClick={() => updateAppearance('system')}
                                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${appearance === 'system' ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                                                >
                                                    <Monitor className="w-3.5 h-3.5" /> System
                                                </button>
                                            </div>
                                        </div>
                                        {/* Settings */}
                                        <Link
                                            href="/customer/settings"
                                            onClick={() => setProfileOpen(false)}
                                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            <Settings className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                            Settings
                                        </Link>
                                        {/* Logout */}
                                        <Link
                                            href={route('logout')}
                                            method="post"
                                            onClick={() => setProfileOpen(false)}
                                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Logout
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* ═══════════════ MOBILE TOP BAR (<md) ═══════════════ */}
            <header className="md:hidden sticky top-0 z-40 bg-slate-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between px-4 h-14">
                    {/* Branding, mirroring the desktop header above — without it
                        the bar is empty apart from the two icons on the right. */}
                    <Link href="/customer/dashboard" className="flex items-center gap-2 min-w-0">
                        <img
                            src="/images/LOGO.jpg"
                            alt="Mejeck Ice Plant Logo"
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                        />
                        <span className="text-base font-bold text-gray-900 dark:text-white truncate">
                            Mejeck Ice Plant
                        </span>
                    </Link>

                    <div className="flex items-center gap-3 flex-shrink-0">
                        <AppearanceToggleDropdown />
                        <Link
                            href="/customer/cart"
                            title="My Cart"
                            className={`relative flex items-center transition-colors ${
                                currentPage === 'cart'
                                    ? 'text-cyan-600 dark:text-cyan-400'
                                    : 'text-gray-600 dark:text-gray-300'
                            }`}
                        >
                            <ShoppingCart className="w-6 h-6" />
                            <CartBadge />
                        </Link>
                    </div>
                </div>
            </header>

            {/* ═══════════════ MOBILE BOTTOM NAV (<md) ═══════════════ */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 z-50">
                <div className="flex items-stretch justify-around h-16">
                    <Link href="/customer/dashboard" className={bottomLink('home')}>
                        <Home className="w-5 h-5" />
                        <span className="text-[11px] font-medium">Home</span>
                    </Link>
                    <Link href="/customer/my-orders" className={bottomLink('orders')}>
                        <Package className="w-5 h-5" />
                        <span className="text-[11px] font-medium">Orders</span>
                    </Link>
                    <Link href={route('customer.reports')} className={bottomLink('reports')}>
                        <FileText className="w-5 h-5" />
                        <span className="text-[11px] font-medium">Reports</span>
                    </Link>
                    <Link href={route('customer.visit-us')} className={bottomLink('visit-us')}>
                        <MapPin className="w-5 h-5" />
                        <span className="text-[11px] font-medium">Visit Us</span>
                    </Link>
                    <Link href="/customer/settings" className={bottomLink('profile')}>
                        <Settings className="w-5 h-5" />
                        <span className="text-[11px] font-medium">Settings</span>
                    </Link>
                </div>
            </nav>
        </>
    );
}
