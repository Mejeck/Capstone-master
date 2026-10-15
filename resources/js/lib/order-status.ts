// One source for the status an order is shown with, so the admin, cashier and
// customer pages all name an order's state the same way.
//
// orders.status never holds "Out for Delivery" — that lives on the delivery
// row — so it is folded in here. Every other value is shown exactly as stored.
type OrderStatusSource = {
    status: string;
    delivery?: { delivery_status?: string | null } | null;
};

export function getOrderDisplayStatus(order: OrderStatusSource): string {
    if (['Cancelled', 'Delivered', 'Completed'].includes(order.status)) return order.status;
    if (order.delivery?.delivery_status === 'Out for Delivery') return 'Out for Delivery';
    return order.status;
}

// Status pill colors, keyed by getOrderDisplayStatus's output.
export function getStatusColor(status: string): string {
    switch (status) {
        case 'Pending': return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300';
        case 'Processing': return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
        case 'Ready to Deliver': return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300';
        case 'Ready for Pickup': return 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300';
        case 'Out for Delivery': return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300';
        case 'Delivered': return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
        case 'Completed': return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300';
        case 'Cancelled': return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
        default: return 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300';
    }
}
