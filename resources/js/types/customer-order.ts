// Shared types for the customer checkout flow (Dashboard.tsx / Cart.tsx).
// Copied verbatim from the shapes both pages already used locally so no
// field is lost in the de-duplication.

export interface CartItem {
    productId: number;
    quantity: number;
    kiloAmount?: number;
    orderType?: 'kilo' | 'bottle' | 'case';
    // Only meaningful when orderType === 'case': the store only offers a
    // chilled option when buying by the case, priced via
    // PricingProduct.price_per_case_cold (never by the bottle).
    isCold?: boolean;
}

export interface UserAddress {
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

export interface OrderFormState {
    payment_method: string;
    order_type: 'preorder' | 'delivery' | 'pickup';
    delivery_address: string;
    delivery_house_no: string;
    delivery_street: string;
    delivery_barangay_name: string;
    delivery_municipality: string;
    delivery_landmark: string;
    delivery_barangay: string;
    delivery_purok: string;
    delivery_city: string;
    delivery_province: string;
    delivery_postal_code: string;
    delivery_latitude: number | null;
    delivery_longitude: number | null;
    pickup_date: string;
    pickup_time: string;
    // Only meaningful while typing a fresh delivery address (not one picked
    // from the Saved Address dropdown) — offers to save it as the default so
    // it prefills automatically on the next order instead of being retyped.
    save_address: boolean;
}

// Narrow shape `computeOrderTotal` actually needs — Dashboard's richer
// `Product` and Cart's `Product` both satisfy this structurally.
export interface PricingProduct {
    product_id: number;
    product_name: string;
    unit: string;
    price: number;
    price_per_case: number | null;
    price_per_case_cold: number | null;
    price_per_bottle: number | null;
}

// Minimal order shape used when listing/summarizing a customer's pre-orders.
export interface PreOrderSummary {
    order_id: number;
    total_amount: number;
    status: string;
    order_date: string;
    order_type: string;
    payment_method?: string;
    down_payment?: number;
}
