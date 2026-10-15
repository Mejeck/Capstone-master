import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { getOrderDisplayStatus, getStatusColor } from '@/lib/order-status';
import { deliveryFeeLabel } from '@/lib/delivery-fee';
import DeliveryNotes from '@/components/delivery-notes';
import {
    Package,
    ArrowLeft,
    Calendar,
    CreditCard,
    MapPin,
    Truck,
    CheckCircle,
    Clock,
    AlertCircle,
} from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';

interface OrderItem {
    product_name: string;
    image?: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
}

interface DeliveryInfo {
    delivery_status: string;
    assigned_date?: string;
    actual_delivery_date?: string;
    rider_notes?: string;
    proof_of_delivery?: string[];
}

interface Order {
    order_id: number;
    order_date: string;
    order_type: string;
    status: string;
    approval_status: string;
    payment_method: string;
    payment_status: string;
    total_amount: number;
    delivery_fee?: number | null;
    delivery_municipality?: string | null;
    down_payment: number;
    delivery_address?: string;
    delivery_landmark?: string | null;
    delivery_remarks?: string | null;
    delivery_barangay?: string;
    delivery_purok?: string;
    delivery_city?: string;
    delivery_province?: string;
    delivery_postal_code?: string;
    notes?: string;
    items: OrderItem[];
    delivery?: DeliveryInfo;
}

interface OrderDetailProps {
    order: Order;
}

const statusSteps = ['Pending', 'Processing', 'Out for Delivery', 'Delivered'];

function getStatusStep(status: string, deliveryStatus?: string): number {
    if (status === 'Delivered' || status === 'Completed') return 3;
    if (deliveryStatus === 'Out for Delivery') return 2;
    if (status === 'Processing' || status === 'Ready to Deliver') return 1;
    if (status === 'Pending') return 0;
    return 0;
}

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(status)}`}>
            {status}
        </span>
    );
}

function PaymentBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        Paid:    'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
        Partial: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300',
        Unpaid:  'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
    };
    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${colors[status] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
            {status}
        </span>
    );
}

export default function OrderDetail({ order }: OrderDetailProps) {
    const currentStep = getStatusStep(order.status, order.delivery?.delivery_status);
    const hasDeliveryAddress = order.delivery_address && order.delivery_city;
    // total_amount is the items only; the delivery fee is stored beside it.
    const deliveryFee = Number(order.delivery_fee ?? 0);
    const grandTotal = Number(order.total_amount) + deliveryFee;

    const deliveryAddress = [
        order.delivery_purok && `Purok ${order.delivery_purok}`,
        order.delivery_barangay,
        order.delivery_address,
        order.delivery_city,
        order.delivery_province,
        order.delivery_postal_code,
    ].filter(Boolean).join(', ');

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
            <Head title={`Order #${order.order_id}`} />
            <CustomerNav currentPage="orders" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8 space-y-5">

                {/* ── Page Header ── */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/customer/my-orders"
                            className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-700 transition-all"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Order #{order.order_id}
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3.5 h-3.5" />
                                Placed on {new Date(order.order_date).toLocaleDateString('en-PH', {
                                    year: 'numeric', month: 'long', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                })}
                            </p>
                        </div>
                    </div>
                    <StatusBadge status={getOrderDisplayStatus(order)} />
                </div>

                {/* ── Order Progress Timeline ── */}
                {order.status !== 'Cancelled' && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-6">
                        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-6">
                            Order Progress
                        </h2>
                        <div className="flex items-center justify-between relative">
                            {/* track */}
                            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 dark:bg-slate-600 z-0" />
                            <div
                                className="absolute top-4 left-0 h-0.5 bg-cyan-500 z-0 transition-all duration-500"
                                style={{ width: `${(currentStep / (statusSteps.length - 1)) * 100}%` }}
                            />
                            {statusSteps.map((step, index) => {
                                const done = index <= currentStep;
                                return (
                                    <div key={step} className="flex flex-col items-center z-10 flex-1">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                                            done
                                                ? 'bg-cyan-500 border-cyan-500 text-white'
                                                : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-400'
                                        }`}>
                                            {done
                                                ? <CheckCircle className="w-4 h-4" />
                                                : <Clock className="w-4 h-4" />
                                            }
                                        </div>
                                        <span className={`mt-2 text-xs text-center font-medium ${done ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                            {step}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── Payment + Delivery/Order Type ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Payment */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-6">
                        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Payment Details
                        </h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 dark:text-gray-400">Method</span>
                                <span className="font-medium text-gray-900 dark:text-white">{order.payment_method}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 dark:text-gray-400">Status</span>
                                <PaymentBadge status={order.payment_status} />
                            </div>
                            {order.down_payment > 0 && (
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 dark:text-gray-400">Down Payment</span>
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        ₱{Number(order.down_payment).toFixed(2)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between items-center border-t border-gray-100 dark:border-slate-700 pt-3 mt-1">
                                <span className="font-semibold text-gray-900 dark:text-white">{deliveryFee > 0 ? 'Grand Total' : 'Total Amount'}</span>
                                <span className="font-bold text-cyan-600 dark:text-cyan-400 text-base">
                                    ₱{grandTotal.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Delivery address or order type */}
                    {hasDeliveryAddress ? (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-6">
                            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                Delivery Address
                            </h2>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{deliveryAddress}</p>
                            <DeliveryNotes landmark={order.delivery_landmark} remarks={order.delivery_remarks} className="mt-2" />
                            {order.delivery && (
                                <div className="mt-4 space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Truck className="w-4 h-4 text-cyan-500" />
                                        <span className="text-gray-500 dark:text-gray-400">Delivery Status:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {order.delivery.delivery_status}
                                        </span>
                                    </div>
                                    {order.delivery.actual_delivery_date && (
                                        <p className="text-gray-500 dark:text-gray-400 text-xs">
                                            Delivered on {new Date(order.delivery.actual_delivery_date).toLocaleDateString('en-PH', {
                                                year: 'numeric', month: 'long', day: 'numeric',
                                            })}
                                        </p>
                                    )}
                                    {order.delivery.rider_notes && (
                                        <p className="text-gray-500 dark:text-gray-400 italic text-xs">
                                            Note: {order.delivery.rider_notes}
                                        </p>
                                    )}
                                    {order.delivery.proof_of_delivery && order.delivery.proof_of_delivery.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Proof of Delivery:</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {order.delivery.proof_of_delivery.map((path, i) => (
                                                    <a key={i} href={`/storage/${path}`} target="_blank" rel="noopener noreferrer">
                                                        <img
                                                            src={`/storage/${path}`}
                                                            alt={`Proof of delivery ${i + 1}`}
                                                            className="w-full h-40 object-cover rounded-lg hover:opacity-90 transition-opacity"
                                                        />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-6">
                            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                Order Type
                            </h2>
                            <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">{order.order_type}</p>
                        </div>
                    )}
                </div>

                {/* ── Order Items ── */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-6">
                    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Order Items
                    </h2>
                    <div className="divide-y divide-gray-100 dark:divide-slate-700">
                        {order.items.map((item, index) => (
                            <div key={index} className="flex items-center gap-4 py-4">
                                <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                                    {item.image ? (
                                        <img
                                            src={`/${item.image}`}
                                            alt={item.product_name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-white truncate">{item.product_name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                        ₱{Number(item.unit_price).toFixed(2)} × {item.quantity}
                                    </p>
                                </div>
                                <p className="font-semibold text-gray-900 dark:text-white flex-shrink-0">
                                    ₱{Number(item.subtotal).toFixed(2)}
                                </p>
                            </div>
                        ))}
                    </div>
                    {deliveryFee > 0 && (
                        <div className="border-t border-gray-100 dark:border-slate-700 pt-4 pb-2 space-y-1.5 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Items Total</span>
                                <span className="font-medium text-gray-900 dark:text-white">₱{Number(order.total_amount).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">{deliveryFeeLabel(order.delivery_municipality)}</span>
                                <span className="font-medium text-gray-900 dark:text-white">₱{deliveryFee.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                    <div className="border-t border-gray-100 dark:border-slate-700 pt-4 flex justify-between items-center">
                        <span className="font-semibold text-gray-900 dark:text-white">{deliveryFee > 0 ? 'Grand Total' : 'Total'}</span>
                        <span className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                            ₱{grandTotal.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* ── Notes ── */}
                {order.notes && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">Order Note</p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-0.5">{order.notes}</p>
                        </div>
                    </div>
                )}

                {/* ── Actions ── */}
                <div className="flex items-center gap-3">
                    <Link
                        href="/customer/my-orders"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium text-sm shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Orders
                    </Link>
                    {(order.status === 'Delivered' || order.status === 'Completed') && (
                        <Link
                            href={`/customer/reports/create/${order.order_id}`}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg transition-all font-medium text-sm shadow-sm"
                        >
                            Report an Issue
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
