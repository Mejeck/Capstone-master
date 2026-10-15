import { TAX_CONSTANTS } from '@/constants/tax';
import type { CartItem, OrderFormState, PricingProduct } from '@/types/customer-order';
import { deliveryFeeLabel, isInTown } from '@/lib/delivery-fee';

export interface DeliveryFeeSettings {
    in_town_fee: number;
    out_of_town_fee: number;
    in_town_municipality: string;
}

// Pure line-item total for a set of cart items against a product price list.
// Mirrors Dashboard's/Cart's identical `computeTotal` exactly:
// - bottle orders use price_per_bottle (falling back to price)
// - case orders use price_per_case, or price_per_case_cold when isCold is
//   set and the product offers a cold case price (falling back to price)
// - kilo orders (ice tubes) look up the matching `${kiloAmount}kg` variant
// - anything else falls back to price_per_case, then price
export function computeOrderTotal(items: CartItem[], products: PricingProduct[]): number {
    return items.reduce((total, item) => {
        const product = products.find(p => p.product_id === item.productId);
        if (!product) return total;

        let price = 0;
        if (item.orderType === 'bottle') {
            price = product.price_per_bottle || product.price || 0;
        } else if (item.orderType === 'case') {
            price = (item.isCold && product.price_per_case_cold) || product.price_per_case || product.price || 0;
        } else if (item.kiloAmount) {
            const iceTubeVariant = products.find(p =>
                p.product_name === product.product_name &&
                p.unit === `${item.kiloAmount}kg`
            );
            price = iceTubeVariant?.price || product.price || 0;
        } else {
            price = product.price_per_case || product.price || 0;
        }

        return total + price * item.quantity;
    }, 0);
}

export interface OrderTotals {
    total: number;
    subtotalExclVAT: number;
    vatAmount: number;
    deliveryFee: number;
    /** Says where the fee comes from, e.g. "Delivery Fee (Peñaranda, in-town)". */
    deliveryFeeLabel: string;
    grandTotal: number;
}

// Derived totals for the active order (cart, buy-now item, etc.), matching
// the identical derivation logic that used to live separately in
// Dashboard.tsx (activeOrder*) and Cart.tsx (cart*).
export function useOrderTotals(
    items: CartItem[],
    products: PricingProduct[],
    orderForm: OrderFormState,
    deliveryFeeSettings?: DeliveryFeeSettings
): OrderTotals {
    const total = computeOrderTotal(items, products);
    const subtotalExclVAT = TAX_CONSTANTS.calculateBasePrice(total);
    const vatAmount = TAX_CONSTANTS.calculateVAT(total);
    const inTownMunicipality = deliveryFeeSettings?.in_town_municipality;
    const deliveryFee = (orderForm.order_type === 'delivery' && deliveryFeeSettings)
        ? (isInTown(orderForm.delivery_municipality, inTownMunicipality) ? deliveryFeeSettings.in_town_fee : deliveryFeeSettings.out_of_town_fee)
        : 0;
    const feeLabel = deliveryFeeLabel(orderForm.delivery_municipality, inTownMunicipality);
    const grandTotal = total + deliveryFee;

    return { total, subtotalExclVAT, vatAmount, deliveryFee, deliveryFeeLabel: feeLabel, grandTotal };
}
