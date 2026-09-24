import React from 'react';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { LayoutGrid, Shield, UserPlus, Package, FileText, Users, Settings, History, ShoppingCart, Wine, CircleDollarSign, AlertTriangle, Truck } from 'lucide-react';
import PesoSign from '@/components/icons/peso-sign';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        url: '/admin/dashboard#dashboard',
        icon: LayoutGrid,
        roles: ['Admin', 'SuperAdmin'], // Only visible to Admin and SuperAdmin
    },
    {
        title: 'Inventory',
        url: '/admin/dashboard#inventory',
        icon: Package,
        roles: ['Admin', 'SuperAdmin'], // Only visible to Admin and SuperAdmin
    },
    {
        title: 'POS',
        url: '/admin/pos',
        icon: PesoSign,
        roles: ['Admin', 'SuperAdmin'], // Admin POS
    },
    {
        // "Verify Payments" (GCash/COD proof review) lives inside this page
        // as its own tab now, instead of a separate nav item/page — one
        // place for everything order-related.
        title: 'Pre-Orders',
        url: '/admin/pre-orders',
        icon: ShoppingCart,
        roles: ['Admin', 'SuperAdmin'], // Only visible to Admin and SuperAdmin
    },
    {
        title: 'Damaged Beverages',
        url: '/admin/broken-bottles',
        icon: AlertTriangle,
        roles: ['Admin', 'SuperAdmin'],
    },
    {
        title: 'Suppliers',
        url: '/admin/suppliers',
        icon: CircleDollarSign,
        roles: ['Admin', 'SuperAdmin'], // Only visible to Admin and SuperAdmin
    },
    {
        title: 'Purchase Orders',
        url: '/admin/purchase-orders',
        icon: Package,
        roles: ['Admin', 'SuperAdmin'], // Only visible to Admin and SuperAdmin
    },
    {
        title: 'Reports',
        url: '/admin/reports',
        icon: FileText,
        roles: ['Admin', 'SuperAdmin'], // Only visible to Admin and SuperAdmin
    },
    {
        title: 'Recent Activities',
        url: '/admin/transactions',
        icon: History,
        roles: ['Admin', 'SuperAdmin'], // Only visible to Admin and SuperAdmin
    },
    {
        title: 'Delivery Fee',
        url: '/admin/delivery-fee',
        icon: Truck,
        roles: ['Admin', 'SuperAdmin'], // Only visible to Admin and SuperAdmin
    },
    {
        title: 'Staff Accounts',
        url: '/admin/staff-accounts',
        icon: UserPlus,
        roles: ['Admin', 'SuperAdmin'], // Only visible to Admin and SuperAdmin; Admin-role creation/management inside the page is further restricted to SuperAdmin
    },
    // {
    //     title: 'Customers',
    //     url: '/admin/dashboard#customers',
    //     icon: Users,
    // },
        ];

// Cashier specific navigation items
const cashierNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        url: '/cashier/dashboard',
        icon: LayoutGrid,
        roles: ['cashier'], // Only visible to Cashier
    },
    {
        title: 'POS',
        url: '/cashier/pos',
        icon: PesoSign,
        roles: ['cashier'], // Only visible to Cashier
    },
    {
        title: 'Sales History',
        url: '/cashier/sales-history',
        icon: History,
        roles: ['cashier'], // Only visible to Cashier
    },
];

const footerNavItems: NavItem[] = [];

export function AppSidebar() {
    const page = usePage();
    const currentUser = (page.props.auth as any)?.user;
    
    // Determine which navigation items to show based on user role
    let navItems: NavItem[] = [];
    let dashboardUrl = '/admin/dashboard';
    
    if (currentUser?.role === 'cashier') {
        navItems = cashierNavItems;
        dashboardUrl = '/cashier/dashboard';
    } else {
        navItems = mainNavItems;
        dashboardUrl = '/admin/dashboard';
    }
    
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboardUrl} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={navItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
