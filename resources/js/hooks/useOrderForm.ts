import { useEffect, useState } from 'react';
import type { OrderFormState, UserAddress } from '@/types/customer-order';

const INITIAL_ORDER_FORM: OrderFormState = {
    payment_method: 'Cash',
    order_type: 'delivery',
    delivery_address: '',
    delivery_house_no: '',
    delivery_street: '',
    delivery_barangay_name: '',
    delivery_municipality: '',
    delivery_landmark: '',
    delivery_barangay: '',
    delivery_purok: '',
    delivery_city: '',
    delivery_province: '',
    delivery_postal_code: '',
    delivery_latitude: null,
    delivery_longitude: null,
    pickup_date: '',
    pickup_time: '',
    // Checked by default: a first-time customer typing a fresh address has
    // every reason to want it remembered, and can still uncheck it for a
    // one-off delivery (e.g. a gift to someone else's house).
    save_address: true,
};

interface UseOrderFormOptions {
    // Mirrors the old per-page effect's dependency (`showOrderModal`): the
    // default-address prefill only runs when this flips, using the current
    // orderForm/addresses closure at that time — not on every keystroke.
    prefillWhen: boolean;
}

export function useOrderForm(addresses: UserAddress[], options: UseOrderFormOptions) {
    const { prefillWhen } = options;
    const [orderForm, setOrderForm] = useState<OrderFormState>({ ...INITIAL_ORDER_FORM });
    const [selectedAddressId, setSelectedAddressId] = useState<number | 'new' | ''>('');

    const applyAddressToForm = (address: UserAddress) => {
        setOrderForm(prev => ({
            ...prev,
            delivery_address: address.full_address,
            delivery_house_no: address.house_no || '',
            delivery_street: address.street || '',
            delivery_barangay_name: address.barangay_name || '',
            delivery_municipality: address.municipality || '',
            delivery_landmark: address.landmark || '',
            delivery_barangay: address.barangay || '',
            delivery_purok: address.purok || '',
            delivery_city: address.city || '',
            delivery_province: address.province || '',
            delivery_postal_code: address.postal_code || '',
        }));
    };

    const handleAddressSelectChange = (value: string) => {
        if (value === 'new') {
            setSelectedAddressId('new');
            setOrderForm(prev => ({
                ...prev,
                delivery_address: '',
                delivery_house_no: '',
                delivery_street: '',
                delivery_barangay_name: '',
                delivery_municipality: '',
                delivery_landmark: '',
                delivery_barangay: '',
                delivery_purok: '',
                delivery_city: '',
                delivery_province: '',
                delivery_postal_code: '',
                save_address: true,
            }));
            return;
        }
        const address = addresses.find(a => a.id === Number(value));
        if (address) {
            setSelectedAddressId(address.id);
            applyAddressToForm(address);
            // Already saved — nothing new to offer to remember.
            setOrderForm(prev => ({ ...prev, save_address: false }));
        }
    };

    // Pre-fill delivery fields from the customer's default saved address when
    // the order modal opens, so they don't have to retype it every order.
    useEffect(() => {
        if (prefillWhen && orderForm.order_type === 'delivery' && !orderForm.delivery_address && addresses.length > 0) {
            const defaultAddress = addresses.find(a => a.is_default) || addresses[0];
            setSelectedAddressId(defaultAddress.id);
            applyAddressToForm(defaultAddress);
        }
        // Intentionally mirrors the original effect's dependency array
        // (`[showOrderModal]` only) — it should react to prefillWhen toggling,
        // not to every orderForm/addresses change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefillWhen]);

    const resetOrderForm = () => setOrderForm({ ...INITIAL_ORDER_FORM });

    return {
        orderForm,
        setOrderForm,
        selectedAddressId,
        setSelectedAddressId,
        applyAddressToForm,
        handleAddressSelectChange,
        resetOrderForm,
    };
}
