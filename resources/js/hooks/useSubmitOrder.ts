import { useState } from 'react';
import { getCsrfHeaders } from '@/lib/csrf';
import { MIN_DELIVERY_ORDER_AMOUNT } from '@/constants/order';
import { computeOrderTotal } from '@/hooks/useOrderTotals';
import type { CartItem, OrderFormState, PricingProduct } from '@/types/customer-order';

interface UseSubmitOrderParams {
    items: CartItem[];
    products: PricingProduct[];
    orderForm: OrderFormState;
    // Whether the delivery address currently in the form came from the Saved
    // Address dropdown (a number) or is being typed fresh ('new' / ''). Only
    // a fresh address with orderForm.save_address checked gets persisted.
    selectedAddressId: number | 'new' | '';
    // Server responded with a GCash order — page should open its GCash proof modal.
    onGCashCreated: (data: any) => void;
    // Server responded with a Cash/COD order needing a down-payment-via-GCash
    // screenshot — page should open its COD proof modal.
    onCodRequired: (data: any) => void;
    // Order created and needs neither proof modal — page should clear its
    // cart/buy-now state, reset the order form, and reload.
    onImmediateSuccess: () => void;
    // Replaces window.confirm() — page owns a centered ConfirmModal (via
    // useConfirmModal) and passes its `confirm` function through here so
    // the "place this order?" prompt renders consistently with the rest of
    // the app's confirmations instead of the browser's own dialog chrome.
    confirmPlaceOrder: (message: string) => Promise<boolean>;
}

// The actual POST to /customer/api/orders (OrderController::store()). Extracted
// last/highest-risk from Dashboard.tsx and Cart.tsx, whose submitOrder
// implementations were otherwise identical. Two deliberate, isolated
// behavior standardizations vs. the original per-page code (called out in
// the refactor plan as a single easy-to-revert unit):
//   1. unit_type fallback for items whose orderType isn't explicitly 'bottle'
//      or 'case' now uses Cart's `price_per_case ? 'case' : 'kilo'` logic
//      instead of Dashboard's blanket 'kilo' fallback. Not currently
//      reachable in practice (orderType is always explicit upstream).
//   2. The catch block keeps Dashboard's console.error(...) logging (Cart's
//      catch was a silent no-log swallow).
export function useSubmitOrder({ items, products, orderForm, selectedAddressId, onGCashCreated, onCodRequired, onImmediateSuccess, confirmPlaceOrder }: UseSubmitOrderParams) {
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);

    const submitOrder = async () => {
        if (items.length === 0) return;

        const total = computeOrderTotal(items, products);

        if (orderForm.order_type === 'delivery' && total < MIN_DELIVERY_ORDER_AMOUNT) {
            alert(`Minimum order for delivery is ₱${MIN_DELIVERY_ORDER_AMOUNT}. Your current order total is ₱${total.toFixed(2)}.`);
            return;
        }

        if (!(await confirmPlaceOrder('Are you sure you want to place this order?'))) return;

        setIsPlacingOrder(true);

        try {
            const response = await fetch('/customer/api/orders', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
                body: JSON.stringify({
                    items: items.map(item => {
                        const product = products.find(p => p.product_id === item.productId);
                        const unit_type = item.orderType === 'bottle'
                            ? 'bottle'
                            : item.orderType === 'case'
                                ? 'case'
                                : (product?.price_per_case ? 'case' : 'kilo');
                        return {
                            product_id: item.productId,
                            quantity: item.quantity,
                            unit_type,
                            is_cold: unit_type === 'case' ? !!item.isCold : undefined,
                        };
                    }),
                    payment_method: orderForm.payment_method,
                    down_payment: orderForm.payment_method === 'GCash'
                        ? total
                        : orderForm.order_type === 'preorder'
                            ? total * 0.5
                            : total * 0.2,
                    pickup_date: (orderForm.order_type === 'pickup' || orderForm.order_type === 'preorder') ? orderForm.pickup_date : undefined,
                    pickup_time: (orderForm.order_type === 'pickup' || orderForm.order_type === 'preorder') ? orderForm.pickup_time : undefined,
                    order_type: orderForm.order_type,
                    delivery_address: orderForm.order_type === 'delivery' ? orderForm.delivery_address : '',
                    delivery_municipality: orderForm.order_type === 'delivery' ? orderForm.delivery_municipality : '',
                    delivery_landmark: orderForm.order_type === 'delivery' ? orderForm.delivery_landmark : '',
                    delivery_barangay: orderForm.order_type === 'delivery' ? orderForm.delivery_barangay : '',
                    delivery_purok: orderForm.order_type === 'delivery' ? orderForm.delivery_purok : '',
                    delivery_city: orderForm.order_type === 'delivery' ? orderForm.delivery_city : '',
                    delivery_province: orderForm.order_type === 'delivery' ? orderForm.delivery_province : '',
                    delivery_postal_code: orderForm.order_type === 'delivery' ? orderForm.delivery_postal_code : '',
                    delivery_latitude: orderForm.order_type === 'delivery' ? orderForm.delivery_latitude : null,
                    delivery_longitude: orderForm.order_type === 'delivery' ? orderForm.delivery_longitude : null,
                }),
            });

            if (response.ok) {
                const data = await response.json();

                // Best-effort: the order itself already succeeded, so a
                // failure here (network blip, validation quirk) shouldn't
                // surface as an order-placement error — it just means next
                // order's form starts blank again, same as before this
                // existed.
                if (orderForm.order_type === 'delivery' && orderForm.save_address && typeof selectedAddressId !== 'number') {
                    fetch('/customer/settings/addresses', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getCsrfHeaders(),
                        },
                        body: JSON.stringify({
                            house_no: orderForm.delivery_house_no,
                            street: orderForm.delivery_street,
                            barangay_name: orderForm.delivery_barangay_name,
                            municipality: orderForm.delivery_municipality,
                            landmark: orderForm.delivery_landmark,
                            barangay: orderForm.delivery_barangay,
                            purok: orderForm.delivery_purok,
                            city: orderForm.delivery_city,
                            province: orderForm.delivery_province,
                            postal_code: orderForm.delivery_postal_code,
                            is_default: true,
                        }),
                    }).catch(() => { /* best-effort, see comment above */ });
                }

                // GCash: show payment modal for all order types
                if (orderForm.payment_method === 'GCash') {
                    onGCashCreated(data);
                } else if (orderForm.payment_method === 'Cash' && (orderForm.order_type === 'pickup' || orderForm.order_type === 'preorder' || orderForm.order_type === 'delivery')) {
                    // Pickup / Preorder + Cash on Pickup, or Delivery + COD: require GCash downpayment proof
                    onCodRequired(data);
                } else {
                    onImmediateSuccess();
                }
            } else if (response.status === 419) {
                // Session actually expired server-side (getCsrfHeaders() above
                // already avoids the far more common case of the token merely
                // drifting on a long-open page). The cart is persisted to
                // localStorage on every change, so it's safe to send the
                // customer to log back in without losing it.
                alert('Your session has expired. Please log in again — your cart has been saved.');
                window.location.href = '/login';
                return;
            } else {
                const error = await response.json();
                if (error.messages && Array.isArray(error.messages)) {
                    alert('Validation errors:\n' + error.messages.join('\n'));
                } else {
                    alert(error.error || error.message || 'Failed to place order');
                }
            }
        } catch (error) {
            console.error('Error placing order:', error);
            alert('Failed to place order. Please try again.');
        } finally {
            setIsPlacingOrder(false);
        }
    };

    return { submitOrder, isPlacingOrder };
}
