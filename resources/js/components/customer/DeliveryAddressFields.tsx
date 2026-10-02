import type { Dispatch, SetStateAction } from 'react';
import { MUNICIPALITIES } from '@/constants/municipalities';
import type { OrderFormState, UserAddress } from '@/types/customer-order';

interface DeliveryAddressFieldsProps {
    orderForm: OrderFormState;
    setOrderForm: Dispatch<SetStateAction<OrderFormState>>;
    addresses: UserAddress[];
    selectedAddressId: number | 'new' | '';
    onAddressSelectChange: (value: string) => void;
}

// Saved-address dropdown + house/street/barangay/municipality/landmark inputs.
// Caller is expected to only render this while orderForm.order_type === 'delivery'.
export default function DeliveryAddressFields({ orderForm, setOrderForm, addresses, selectedAddressId, onAddressSelectChange }: DeliveryAddressFieldsProps) {
    return (
        <>
            {addresses.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Saved Address
                    </label>
                    <select
                        value={selectedAddressId}
                        onChange={(e) => onAddressSelectChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                    >
                        {addresses.map((address) => (
                            <option key={address.id} value={address.id}>
                                {address.label || 'Address'}{address.is_default ? ' (Default)' : ''} — {address.full_address}
                            </option>
                        ))}
                        <option value="new">Type a new address...</option>
                    </select>
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Delivery Address
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">House No.</label>
                        <input
                            type="text"
                            value={orderForm.delivery_house_no}
                            onChange={(e) => {
                                const val = e.target.value;
                                setOrderForm(prev => {
                                    const combined = [val, prev.delivery_street, prev.delivery_barangay_name, prev.delivery_municipality].filter(Boolean).join(', ');
                                    return { ...prev, delivery_house_no: val, delivery_address: combined };
                                });
                            }}
                            placeholder="e.g. 123"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Street Name</label>
                        <input
                            type="text"
                            value={orderForm.delivery_street}
                            onChange={(e) => {
                                const val = e.target.value;
                                setOrderForm(prev => {
                                    const combined = [prev.delivery_house_no, val, prev.delivery_barangay_name, prev.delivery_municipality].filter(Boolean).join(', ');
                                    return { ...prev, delivery_street: val, delivery_address: combined };
                                });
                            }}
                            placeholder="e.g. Rizal St."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Barangay</label>
                        <input
                            type="text"
                            value={orderForm.delivery_barangay_name}
                            onChange={(e) => {
                                const val = e.target.value;
                                setOrderForm(prev => {
                                    const combined = [prev.delivery_house_no, prev.delivery_street, val, prev.delivery_municipality].filter(Boolean).join(', ');
                                    return { ...prev, delivery_barangay_name: val, delivery_address: combined };
                                });
                            }}
                            placeholder="e.g. Concepcion"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Municipality</label>
                        <select
                            value={orderForm.delivery_municipality}
                            onChange={(e) => {
                                const val = e.target.value;
                                setOrderForm(prev => {
                                    const combined = [prev.delivery_house_no, prev.delivery_street, prev.delivery_barangay_name, val].filter(Boolean).join(', ');
                                    return { ...prev, delivery_municipality: val, delivery_address: combined };
                                });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                            required
                        >
                            <option value="" disabled>Select municipality</option>
                            {MUNICIPALITIES.map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Landmark <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(e.g. near sari-sari store, blue gate)</span>
                </label>
                <input
                    type="text"
                    value={orderForm.delivery_landmark}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, delivery_landmark: e.target.value }))}
                    placeholder="Landmark"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    required
                />
            </div>
            {/* Only offered while typing a fresh address — picking one from
                the dropdown above means it's already saved. This is the one
                place a customer learns this is possible at all; nothing else
                in the app points at Settings > Addresses. */}
            {typeof selectedAddressId !== 'number' && (
                <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={orderForm.save_address}
                        onChange={(e) => setOrderForm(prev => ({ ...prev, save_address: e.target.checked }))}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span>
                        Save this address as my default, so I don't have to type it again next time.
                    </span>
                </label>
            )}
        </>
    );
}
