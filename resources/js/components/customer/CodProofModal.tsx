import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, FileText, X } from 'lucide-react';
import { STORE } from '@/constants/store';
import { usePaymentProofUpload } from '@/hooks/usePaymentProofUpload';

interface CodOrderData {
    order?: {
        order_id: number;
        down_payment?: number;
    };
}

interface CodProofModalProps {
    open: boolean;
    order: CodOrderData | null;
    onClose: () => void;
    // Called from the final "Done" step — the page clears the cart, closes
    // the order modal, and reloads (unchanged submit-order-owned behavior).
    onDone: () => void;
}

// Self-contained COD/pickup-cash down-payment proof flow — byte-identical
// between Dashboard and Cart before this extraction, so this is a mechanical
// lift. Owns its own step/screenshot/uploading state internally.
export default function CodProofModal({ open, order, onClose, onDone }: CodProofModalProps) {
    const [step, setStep] = useState<'gcash' | 'upload' | 'done'>('gcash');
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const { upload } = usePaymentProofUpload('cod');

    // Fresh state every time the modal opens for a (possibly new) order.
    useEffect(() => {
        if (open) {
            setStep('gcash');
            setScreenshot(null);
            setUploading(false);
        }
    }, [open]);

    if (!open || !order) return null;

    const orderId = order.order?.order_id;
    const downPayment = Number(order.order?.down_payment || 0);

    const handleSubmit = async () => {
        if (!screenshot || !orderId) return;
        setUploading(true);
        const result = await upload(orderId, screenshot);
        setUploading(false);
        if (result.ok) {
            setStep('done');
        } else {
            alert(result.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Down Payment Proof</h2>
                        <button
                            onClick={onClose}
                            aria-label="Close"
                            className="p-2.5 -m-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                        >
                            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                        </button>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-5 flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Order #{orderId} · Down Payment</span>
                        <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                            ₱{downPayment.toFixed(2)}
                        </span>
                    </div>

                    {/* Step 1 — GCash Instructions */}
                    {step === 'gcash' && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Send down payment via GCash:</p>
                                <div className="inline-block bg-white border-2 border-amber-400 rounded-xl p-3 mb-3">
                                    <img
                                        src="/images/gcash-qr.png"
                                        alt="GCash QR Code"
                                        className="w-40 h-40 object-contain mx-auto"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">GCash QR</p>
                                </div>
                                <p className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400">{STORE.gcash}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Merchant: {STORE.name}</p>
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                <div className="flex items-start space-x-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        Send the down payment of <strong>₱{downPayment.toFixed(2)}</strong> and save your receipt screenshot.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep('upload')}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition-all"
                            >
                                I've Paid — Upload Receipt
                            </button>
                        </div>
                    )}

                    {/* Step 2 — Upload Proof */}
                    {step === 'upload' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
                                Upload your GCash downpayment receipt so we can verify it before processing your order.
                            </p>

                            <label className="block cursor-pointer">
                                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                                    screenshot
                                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                                        : 'border-gray-300 dark:border-gray-600 hover:border-amber-400'
                                }`}>
                                    {screenshot ? (
                                        <div>
                                            <img
                                                src={URL.createObjectURL(screenshot)}
                                                alt="Receipt preview"
                                                className="max-h-48 mx-auto rounded-lg object-contain mb-2"
                                            />
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{screenshot.name}</p>
                                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Tap to change</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Tap to select receipt photo</p>
                                            <p className="text-xs text-gray-400 mt-1">JPG, PNG — max 5MB</p>
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/jpg"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            if (file.size > 5 * 1024 * 1024) {
                                                alert('File is too large. Maximum size is 5MB.');
                                                return;
                                            }
                                            setScreenshot(file);
                                        }
                                    }}
                                />
                            </label>

                            <button
                                type="button"
                                disabled={!screenshot || uploading}
                                onClick={handleSubmit}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading ? 'Uploading...' : 'Submit Down Payment Proof'}
                            </button>
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="w-10 h-10 text-green-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Proof Submitted!</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Your down payment is <span className="font-semibold text-amber-500">Awaiting Verification</span>. We'll process your delivery once confirmed.
                                </p>
                            </div>
                            <button
                                onClick={onDone}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition-all"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
