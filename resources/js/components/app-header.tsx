import { Breadcrumbs } from '@/components/breadcrumbs';
import { Icon } from '@/components/icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NavigationMenu, NavigationMenuItem, NavigationMenuList, navigationMenuTriggerStyle } from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppearance } from '@/hooks/use-appearance';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { storageUrl } from '@/lib/storage-url';
import { type BreadcrumbItem, type NavItem, type SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { Bell, CheckCircle2, CreditCard, History, LayoutGrid, LogOut, MapPin, Menu, Monitor, Moon, Package, Phone, Settings, ShoppingCart, Sun, Wallet, X, ZoomIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import PesoSign from './icons/peso-sign';
import { PAYMENT_PROOF_REJECTION_REASONS, OTHER_REJECTION_REASON } from '@/constants/rejectionReasons';
import { showToast } from '@/lib/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PENDING_PAYMENTS_UPDATED_EVENT, notifyPendingPaymentsUpdated } from '@/lib/cashier-events';
import { getCsrfHeaders } from '@/lib/csrf';

interface PendingNotificationItem {
    product_name: string;
    quantity: number;
}

interface PendingNotification {
    order_id: number;
    type: 'gcash' | 'cod';
    customer_name: string;
    amount: number;
    order_date: string;
    proof_image: string | null;
    contact_number: string | null;
    delivery_address: string | null;
    order_items: PendingNotificationItem[];
}

// AppHeader (and this nav list) is currently only used by the cashier
// portal (pos.tsx, dashboard.tsx, orders.tsx, sales-history.tsx all use
// AppHeaderLayout) — these were previously left empty, which meant cashiers
// had no persistent navigation menu at all, on desktop or mobile.
const mainNavItems: NavItem[] = [
    { title: 'Dashboard', url: '/cashier/dashboard', icon: LayoutGrid },
    { title: 'POS', url: '/cashier/pos', icon: PesoSign },
    { title: 'Orders', url: '/cashier/orders', icon: ShoppingCart },
    { title: 'Sales History', url: '/cashier/sales-history', icon: History },
];

const rightNavItems: NavItem[] = [];

const activeItemStyles = 'text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100';

interface AppHeaderProps {
    breadcrumbs?: BreadcrumbItem[];
}

export function AppHeader({ breadcrumbs = [] }: AppHeaderProps) {
    const page = usePage<SharedData>();
    const { auth, cashier_pending_count } = page.props;
    const getInitials = useInitials();
    const { appearance, updateAppearance } = useAppearance();
    const logoHref = auth.user?.role === 'cashier' ? '/cashier/dashboard' : '/';

    const [notifOpen, setNotifOpen] = useState(false);
    const [notifLoading, setNotifLoading] = useState(false);
    const [notifications, setNotifications] = useState<PendingNotification[]>([]);

    const [activeNotification, setActiveNotification] = useState<PendingNotification | null>(null);
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    // Which dropdown option is picked — a preset reason (used verbatim as
    // rejectReason) or OTHER_REJECTION_REASON, which instead reveals a
    // free-text box for whatever isn't already covered by a preset.
    const [rejectReasonPreset, setRejectReasonPreset] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const loadNotifications = () => {
        setNotifLoading(true);
        Promise.all([
            fetch('/cashier/api/gcash-pending').then((r) => r.json()).catch(() => []),
            fetch('/cashier/api/cod-pending').then((r) => r.json()).catch(() => []),
        ])
            .then(([gcash, cod]) => {
                const items: PendingNotification[] = [
                    ...(Array.isArray(gcash) ? gcash : []).map((o: { order_id: number; customer_name: string; total_amount: number; order_date: string; gcash_screenshot: string | null; contact_number: string | null; delivery_address: string | null; order_items?: PendingNotificationItem[] }) => ({
                        order_id: o.order_id,
                        type: 'gcash' as const,
                        customer_name: o.customer_name,
                        amount: o.total_amount,
                        order_date: o.order_date,
                        proof_image: o.gcash_screenshot,
                        contact_number: o.contact_number,
                        delivery_address: o.delivery_address,
                        order_items: o.order_items ?? [],
                    })),
                    ...(Array.isArray(cod) ? cod : []).map((o: { order_id: number; customer_name: string; down_payment: number; order_date: string; proof_image: string | null; contact_number: string | null; delivery_address: string | null; order_items?: PendingNotificationItem[] }) => ({
                        order_id: o.order_id,
                        type: 'cod' as const,
                        customer_name: o.customer_name,
                        amount: o.down_payment,
                        order_date: o.order_date,
                        proof_image: o.proof_image,
                        contact_number: o.contact_number,
                        delivery_address: o.delivery_address,
                        order_items: o.order_items ?? [],
                    })),
                ].sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
                setNotifications(items);
            })
            .finally(() => setNotifLoading(false));
    };

    useEffect(() => {
        if (!notifOpen) return;
        loadNotifications();
    }, [notifOpen]);

    useEffect(() => {
        // Keeps the bell badge in sync when a payment gets confirmed/rejected
        // from somewhere other than this dropdown — the Orders page, most
        // likely — since cashier_pending_count is an Inertia shared prop
        // that only a real visit (not orders.tsx's raw fetch calls) refreshes.
        const onPendingPaymentsUpdated = () => {
            if (notifOpen) loadNotifications();
            router.reload({ only: ['cashier_pending_count'] });
        };
        window.addEventListener(PENDING_PAYMENTS_UPDATED_EVENT, onPendingPaymentsUpdated);
        return () => window.removeEventListener(PENDING_PAYMENTS_UPDATED_EVENT, onPendingPaymentsUpdated);
    }, [notifOpen]);

    useEffect(() => {
        if (!lightboxImage) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLightboxImage(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [lightboxImage]);

    const submitNotificationAction = async (action: 'confirm' | 'reject') => {
        if (!activeNotification) return;
        setActionLoading(true);

        let res: Response;
        try {
            res = await fetch(`/cashier/api/${activeNotification.type}/${activeNotification.order_id}/${action}`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    ...getCsrfHeaders(),
                    ...(action === 'reject' ? { 'Content-Type': 'application/json' } : {}),
                },
                body: action === 'reject' ? JSON.stringify({ reason: rejectReason.trim() }) : undefined,
            });
        } catch {
            alert('Could not reach the server. Please check your connection and try again.');
            setActionLoading(false);
            return;
        }

        if (res.ok) {
            const typeLabel = activeNotification.type === 'gcash' ? 'GCash' : 'COD';
            setActiveNotification(null);
            setShowRejectInput(false);
            setRejectReason('');
            setRejectReasonPreset('');
            loadNotifications();
            // Also refreshes cashier_pending_count via the listener effect
            // above, and lets any other mounted UI (the dashboard's Action
            // Needed cards) refetch its own copy of these counts too.
            notifyPendingPaymentsUpdated();
            showToast(
                action === 'confirm' ? 'success' : 'warning',
                action === 'confirm' ? `${typeLabel} payment confirmed.` : `${typeLabel} payment rejected.`,
            );
            setActionLoading(false);
            return;
        }

        // Same distinct-message handling as the Orders page's identical
        // confirm/reject calls (postVerificationAction in orders.tsx) — a
        // bare "Something went wrong" used to fire for every non-2xx
        // response, hiding whether it was a stale session, another cashier
        // already handling the order, or an actual validation error.
        if (res.status === 419) {
            alert('Your session has expired. The page will reload — please try the action again after it does.');
            window.location.reload();
            setActionLoading(false);
            return;
        }

        if (res.status === 404) {
            alert('This order was already processed. Refreshing the list.');
            setActiveNotification(null);
            loadNotifications();
            router.reload({ only: ['cashier_pending_count'] });
            setActionLoading(false);
            return;
        }

        let message = 'Action failed. Please try again.';
        try {
            const data = await res.json();
            const firstValidationError = data?.errors && Object.values(data.errors)[0];
            message = (Array.isArray(firstValidationError) ? firstValidationError[0] : null) || data?.message || message;
        } catch {
            // Response wasn't JSON — keep the generic message.
        }
        alert(message);
        setActionLoading(false);
    };
    return (
        <>
            <div className="border-sidebar-border border-b-2 shadow-sm">
                <div className="mx-auto flex h-20 items-center px-4 md:max-w-7xl">
                    {/* Mobile Menu */}
                    <div className="lg:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="mr-2 h-[34px] w-[34px]">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="flex h-full w-64 flex-col items-stretch justify-between bg-sidebar">
                                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                                <SheetHeader className="flex flex-row items-center gap-2 justify-start text-left">
                                    <img src="/images/LOGO.jpg" alt="Mejeck Ice Plant Logo" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                                    {/* Matches the brand name shown next to the logo in the
                                        main header bar, so the drawer reads the same way. */}
                                    <span className="font-semibold text-sm truncate">Mejeck Ice Plant</span>
                                </SheetHeader>
                                <div className="mt-6 flex h-full flex-1 flex-col space-y-4">
                                    <div className="flex h-full flex-col justify-between text-sm">
                                        <div className="flex flex-col space-y-4">
                                            {mainNavItems.map((item) => (
                                                <Link key={item.title} href={item.url} className="flex items-center space-x-2 font-medium">
                                                    {item.icon && <Icon iconNode={item.icon} className="h-5 w-5" />}
                                                    <span>{item.title}</span>
                                                </Link>
                                            ))}
                                        </div>

                                        <div className="flex flex-col space-y-4">
                                            {rightNavItems.map((item) => (
                                                <a
                                                    key={item.title}
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center space-x-2 font-medium"
                                                >
                                                    {item.icon && <Icon iconNode={item.icon} className="h-5 w-5" />}
                                                    <span>{item.title}</span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    {/* Matches the plain rounded-lg logo + text sizing used on the
                        customer header and the public welcome page nav, so the
                        header bar looks the same across every part of the site. */}
                    <Link href={logoHref} prefetch className="hidden items-center space-x-3 lg:flex">
                        <img src="/images/LOGO.jpg" alt="Mejeck Ice Plant Logo" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        <span className="text-2xl font-bold whitespace-nowrap">Mejeck Ice Plant</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="ml-8 hidden h-full items-center space-x-6 lg:flex">
                        <NavigationMenu className="flex h-full items-stretch">
                            <NavigationMenuList className="flex h-full items-stretch space-x-2">
                                {mainNavItems.map((item, index) => (
                                    <NavigationMenuItem key={index} className="relative flex h-full items-center">
                                        <Link
                                            href={item.url}
                                            className={cn(
                                                navigationMenuTriggerStyle(),
                                                page.url === item.url && activeItemStyles,
                                                'h-9 cursor-pointer px-3 text-sm',
                                            )}
                                        >
                                            {item.icon && <Icon iconNode={item.icon} className="mr-2 h-4 w-4" />}
                                            {item.title}
                                        </Link>
                                        {page.url === item.url && (
                                            <div className="absolute bottom-0 left-0 h-0.5 w-full translate-y-px bg-black dark:bg-white"></div>
                                        )}
                                    </NavigationMenuItem>
                                ))}
                            </NavigationMenuList>
                        </NavigationMenu>
                    </div>

                    <div className="ml-auto flex items-center space-x-2">
                        <div className="relative flex items-center space-x-1">
                            {cashier_pending_count !== null && cashier_pending_count !== undefined && (
                                <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            title={cashier_pending_count > 0 ? `Notifications (${cashier_pending_count})` : 'Notifications'}
                                            className="relative inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors"
                                        >
                                            <Bell className="size-5 opacity-80" />
                                            {cashier_pending_count > 0 && (
                                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                                                    {cashier_pending_count > 99 ? '99+' : cashier_pending_count}
                                                </span>
                                            )}
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-80" align="end">
                                        <DropdownMenuLabel className="flex items-center justify-between">
                                            <span>Notifications</span>
                                            {cashier_pending_count > 0 && (
                                                <span className="text-xs font-normal text-muted-foreground">{cashier_pending_count} pending</span>
                                            )}
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <div className="max-h-72 overflow-y-auto pr-1">
                                            {notifLoading && (
                                                <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading…</p>
                                            )}
                                            {!notifLoading && notifications.length === 0 && (
                                                <div className="flex flex-col items-center gap-1.5 px-2 py-6 text-center">
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                    <p className="text-sm text-muted-foreground">You're all caught up</p>
                                                </div>
                                            )}
                                            {!notifLoading &&
                                                notifications.map((n) => (
                                                    <DropdownMenuItem
                                                        key={`${n.type}-${n.order_id}`}
                                                        onSelect={() => setActiveNotification(n)}
                                                        className="flex items-start gap-2.5 py-2 cursor-pointer"
                                                    >
                                                        <span
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                                n.type === 'gcash' ? 'bg-cyan-100 dark:bg-cyan-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                                                            }`}
                                                        >
                                                            {n.type === 'gcash' ? (
                                                                <CreditCard className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                                            ) : (
                                                                <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                                            )}
                                                        </span>
                                                        <span className="flex flex-col min-w-0">
                                                            <span className="text-sm font-medium truncate">{n.customer_name}</span>
                                                            <span className="text-xs text-muted-foreground truncate">
                                                                {n.type === 'gcash' ? 'GCash proof' : 'COD down payment'} · ₱{Number(n.amount).toFixed(2)}
                                                            </span>
                                                        </span>
                                                    </DropdownMenuItem>
                                                ))}
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            <div className="hidden lg:flex">
                                {rightNavItems.map((item) => (
                                    <TooltipProvider key={item.title} delayDuration={0}>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <a
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group text-accent-foreground ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md bg-transparent p-0 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                                                >
                                                    <span className="sr-only">{item.title}</span>
                                                    {item.icon && <Icon iconNode={item.icon} className="size-5 opacity-80 group-hover:opacity-100" />}
                                                </a>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{item.title}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ))}
                            </div>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="size-10 rounded-full p-1">
                                    <Avatar className="size-8 overflow-hidden rounded-full">
                                        <AvatarImage src={auth.user?.avatar} alt={auth.user?.name} />
                                        <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                            {getInitials(auth.user?.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end">
                                <DropdownMenuLabel className="p-0 font-normal">
                                    <div className="px-2 py-1.5">
                                        <p className="text-sm font-semibold truncate">{auth.user?.name}</p>
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">{auth.user?.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Theme</p>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => updateAppearance('light')}
                                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                                appearance === 'light'
                                                    ? 'bg-cyan-500 text-white border-cyan-500'
                                                    : 'bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            <Sun className="w-3.5 h-3.5" /> Light
                                        </button>
                                        <button
                                            onClick={() => updateAppearance('dark')}
                                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                                appearance === 'dark'
                                                    ? 'bg-cyan-500 text-white border-cyan-500'
                                                    : 'bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            <Moon className="w-3.5 h-3.5" /> Dark
                                        </button>
                                        <button
                                            onClick={() => updateAppearance('system')}
                                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                                appearance === 'system'
                                                    ? 'bg-cyan-500 text-white border-cyan-500'
                                                    : 'bg-transparent text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700'
                                            }`}
                                        >
                                            <Monitor className="w-3.5 h-3.5" /> System
                                        </button>
                                    </div>
                                </div>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link className="flex w-full items-center gap-2.5" href={route('profile.edit')} prefetch>
                                        <Settings className="w-4 h-4" />
                                        Settings
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link
                                        className="flex w-full items-center gap-2.5 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                        method="post"
                                        href={route('logout')}
                                        as="button"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Logout
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
            {breadcrumbs.length > 1 && (
                <div className="border-sidebar-border/70 flex w-full border-b">
                    <div className="mx-auto flex h-12 w-full items-center justify-start px-4 text-neutral-500 md:max-w-7xl">
                        <Breadcrumbs breadcrumbs={breadcrumbs} />
                    </div>
                </div>
            )}

            {/* Notification action modal — lets the cashier accept/reject the
                selected payment proof right from the notification instead of
                just dumping them on the Orders page (which already has its
                own identical-looking GCash/COD action cards, so clicking a
                specific notification should act on that specific payment). */}
            {activeNotification && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {activeNotification.type === 'gcash' ? 'GCash Payment Proof' : 'COD Down Payment'}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Order #{activeNotification.order_id} — {activeNotification.customer_name}
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {activeNotification.type === 'gcash' ? 'Amount' : 'Down Payment'}
                                </span>
                                <span className="font-bold text-gray-900 dark:text-white">₱{Number(activeNotification.amount).toFixed(2)}</span>
                            </div>
                            {(activeNotification.contact_number || activeNotification.delivery_address) && (
                                <div className="text-sm space-y-1 bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                                    {activeNotification.contact_number && (
                                        <p className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                            <Phone className="w-3.5 h-3.5 flex-shrink-0" /> {activeNotification.contact_number}
                                        </p>
                                    )}
                                    {activeNotification.delivery_address && (
                                        <p className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> {activeNotification.delivery_address}
                                        </p>
                                    )}
                                </div>
                            )}
                            {activeNotification.order_items.length > 0 && (
                                <div>
                                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Items Ordered</span>
                                    <ul className="mt-1 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                                        {activeNotification.order_items.map((item, idx) => (
                                            <li key={idx} className="flex items-center gap-1.5">
                                                <Package className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                                                {item.product_name}
                                                <span className="text-gray-400 dark:text-gray-500">× {item.quantity}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {activeNotification.proof_image ? (
                                <button
                                    onClick={() => setLightboxImage(storageUrl(activeNotification.proof_image))}
                                    className="relative group block w-full focus:outline-none"
                                    title="Click to enlarge"
                                >
                                    <img
                                        src={storageUrl(activeNotification.proof_image)!}
                                        alt="Payment proof"
                                        className="w-full max-h-56 object-contain rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-slate-900 group-hover:opacity-80 transition-opacity"
                                    />
                                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ZoomIn className="w-6 h-6 text-white drop-shadow" />
                                    </span>
                                </button>
                            ) : (
                                <div className="w-full h-32 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
                                    <span className="text-sm text-gray-400 dark:text-gray-500">No proof image</span>
                                </div>
                            )}

                            {showRejectInput && (
                                <div>
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Reason (optional)</label>
                                    <Select
                                        value={rejectReasonPreset}
                                        onValueChange={(value) => {
                                            setRejectReasonPreset(value);
                                            setRejectReason(value === OTHER_REJECTION_REASON ? '' : value);
                                        }}
                                    >
                                        <SelectTrigger className="mt-1 w-full text-sm">
                                            <SelectValue placeholder="Select a reason..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PAYMENT_PROOF_REJECTION_REASONS.map((reason) => (
                                                <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                                            ))}
                                            <SelectItem value={OTHER_REJECTION_REASON}>Others (please specify)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {rejectReasonPreset === OTHER_REJECTION_REASON && (
                                        <textarea
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            rows={2}
                                            maxLength={500}
                                            className="mt-2 w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-slate-900 px-3 py-2 text-gray-900 dark:text-white"
                                            placeholder="Enter your own reason..."
                                            autoFocus
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-6 pt-0 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setActiveNotification(null);
                                    setShowRejectInput(false);
                                    setRejectReason('');
                                    setRejectReasonPreset('');
                                }}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            {showRejectInput ? (
                                <button
                                    onClick={() => submitNotificationAction('reject')}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {actionLoading ? 'Rejecting…' : 'Confirm Reject'}
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setShowRejectInput(true)}
                                        disabled={actionLoading}
                                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => submitNotificationAction('confirm')}
                                        disabled={actionLoading}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {actionLoading ? 'Confirming…' : 'Confirm Payment'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {lightboxImage && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]" onClick={() => setLightboxImage(null)}>
                    <div className="relative max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                        <img src={lightboxImage} alt="Payment proof" className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl" />
                        <button
                            onClick={() => setLightboxImage(null)}
                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
