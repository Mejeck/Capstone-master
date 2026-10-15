import type { CartItem, PricingProduct } from '@/types/customer-order';

interface OrderSummaryListProps {
    items: CartItem[];
    products: PricingProduct[];
    subtotalExclVAT: number;
    vatAmount: number;
    total: number;
    deliveryFee: number;
    deliveryFeeLabel?: string;
    grandTotal: number;
    showDeliveryFee: boolean;
}

// Order summary card inside the checkout modal (not Cart.tsx's page-level
// cart list, which is out of scope and stays untouched).
export default function OrderSummaryList({ items, products, subtotalExclVAT, vatAmount, total, deliveryFee, deliveryFeeLabel = 'Delivery Fee', grandTotal, showDeliveryFee }: OrderSummaryListProps) {
    return (
        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Order Summary</h3>
            <div className="space-y-2">
                {items.map(item => {
                    const product = products.find(p => p.product_id === item.productId);
                    if (!product) return null;

                    const isBeverage = !!(product.price_per_case || product.price_per_bottle);
                    let price = product.price;
                    if (item.orderType === 'bottle') {
                        price = product.price_per_bottle || product.price || 0;
                    } else if (item.orderType === 'case') {
                        price = (item.isCold && product.price_per_case_cold) || product.price_per_case || product.price || 0;
                    } else if (item.kiloAmount && !isBeverage) {
                        const iceTubeVariant = products.find(p =>
                            p.product_name === product.product_name &&
                            p.unit === `${item.kiloAmount}kg`
                        );
                        price = iceTubeVariant?.price || product.price || 0;
                    } else {
                        price = product.price_per_case || product.price || 0;
                    }

                    return (
                        <div key={`${item.productId}-${item.orderType ?? ''}-${item.kiloAmount ?? ''}`} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-300">
                                {product.product_name} {(!isBeverage && item.kiloAmount) ? `(${item.kiloAmount}kg)` : ''}{item.orderType === 'case' && item.isCold ? ' (Cold)' : ''} x {item.quantity}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                ₱{Number(price * item.quantity).toFixed(2)}
                            </span>
                        </div>
                    );
                })}
                <div className="border-t border-gray-200 dark:border-slate-600 pt-2 mt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Subtotal (VAT excluded):</span>
                        <span className="font-medium text-gray-900 dark:text-white">₱{subtotalExclVAT.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">VAT (12%):</span>
                        <span className="font-medium text-gray-900 dark:text-white">₱{vatAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-900 dark:text-white">Total (VAT included)</span>
                        <span className="font-medium text-gray-900 dark:text-white">₱{Number(total).toFixed(2)}</span>
                    </div>
                    {showDeliveryFee && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{deliveryFeeLabel}:</span>
                            <span className="font-medium text-gray-900 dark:text-white">₱{deliveryFee.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-1 border-t border-gray-200 dark:border-slate-600">
                        <span className="text-gray-900 dark:text-white">Grand Total</span>
                        <span className="text-cyan-600 dark:text-cyan-400">₱{Number(grandTotal).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
