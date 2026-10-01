import { AlertTriangle } from 'lucide-react';
import type { OrderFormState } from '@/types/customer-order';

interface DeliveryMinimumNoticeProps {
    orderForm: OrderFormState;
    /** Line-item total, before the delivery fee — the figure the server checks. */
    total: number;
    /** From the server, so this cannot drift from the amount actually enforced. */
    minimumOrder?: number;
}

/**
 * Warns while the order is still being built that it is below the minimum for
 * delivery.
 *
 * Api\OrderController refuses a delivery under MIN_DELIVERY_ORDER_AMOUNT, but
 * nothing said so until the order was submitted — by which point the customer
 * had already chosen an address and a payment method. This says it at the
 * moment delivery is picked, and keeps saying it until the order clears.
 */
export default function DeliveryMinimumNotice({ orderForm, total, minimumOrder }: DeliveryMinimumNoticeProps) {
    if (orderForm.order_type !== 'delivery' || !minimumOrder || total >= minimumOrder) {
        return null;
    }

    const shortfall = minimumOrder - total;

    return (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                    Delivery needs at least ₱{minimumOrder.toFixed(2)}
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Your items come to ₱{total.toFixed(2)}. Add ₱{shortfall.toFixed(2)} more to have this delivered, or
                    choose pickup instead.
                </p>
            </div>
        </div>
    );
}
