import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, FileText, X } from 'lucide-react';
import { STORE } from '@/constants/store';
import { usePaymentProofUpload } from '@/hooks/usePaymentProofUpload';

interface GCashOrderData {
    order?: {
        order_id: number;
        total_amount?: number;
    };
}

interface GCashProofModalProps {
    open: boolean;
    order: GCashOrderData | null;
    onClose: () => void;
    // Called from the final "Done" step — the page clears the cart, closes
    // the order modal, and reloads (unchanged submit-order-owned behavior).
    onDone: () => void;
}

// Self-contained first-time GCash payment flow: owns its own step/screenshot/
// uploading state and talks to the server via usePaymentProofUpload('gcash').
// Amber instructions box (Dashboard's styling, per the plan's explicit pick —
// Cart's was blue, otherwise identical).
export default function GCashProofModal({ open, order, onClose, onDone }: GCashProofModalProps) {
    const [step, setStep] = useState<'instructions' | 'upload' | 'done'>('instructions');
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const { upload } = usePaymentProofUpload('gcash');

    // Fresh state every time the modal opens for a (possibly new) order.
    useEffect(() => {
        if (open) {
            setStep('instructions');
            setScreenshot(null);
            setUploading(false);
        }
    }, [open]);

    // This modal owns the Esc-key guard that blocks closing while mid-upload
    // (no X button either, in that step) — self-contained since `step` no
    // longer lives on the page.
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (step === 'upload') return;
            onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, step, onClose]);

    if (!open || !order) return null;

    const orderId = order.order?.order_id;
    const totalAmount = Number(order.order?.total_amount || 0);

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
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">GCash Payment</h2>
                        {step !== 'upload' && (
                            <button
                                onClick={onClose}
                                aria-label="Close"
                                className="p-2.5 -m-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                            >
                                <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                            </button>
                        )}
                    </div>

                    {/* Order amount pill */}
                    <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-3 mb-5 flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Order #{orderId} · Amount Due</span>
                        <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                            ₱{totalAmount.toFixed(2)}
                        </span>
                    </div>

                    {/* Step 1 — Instructions */}
                    {step === 'instructions' && (
                        <div className="space-y-4">
                            <div className="text-center">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Scan QR or send to this number:</p>
                                <div className="inline-block bg-white border-2 border-cyan-400 rounded-xl p-3 mb-3">
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
                                <p className="text-2xl font-mono font-bold text-cyan-600 dark:text-cyan-400">{STORE.gcash}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Merchant: {STORE.name}</p>
                            </div>

                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                <div className="flex items-start space-x-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        Send the <strong>exact amount</strong> of ₱{totalAmount.toFixed(2)} and save your receipt screenshot.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep('upload')}
                                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all"
                            >
                                I've Paid — Upload Receipt
                            </button>
                        </div>
                    )}

                    {/* Step 2 — Upload screenshot */}
                    {step === 'upload' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
                                Upload your GCash payment screenshot so we can verify your payment.
                            </p>

                            <label className="block cursor-pointer">
                                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                                    screenshot
                                        ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20'
                                        : 'border-gray-300 dark:border-gray-600 hover:border-cyan-400'
                                }`}>
                                    {screenshot ? (
                                        <div>
                                            <img
                                                src={URL.createObjectURL(screenshot)}
                                                alt="Receipt preview"
                                                className="max-h-48 mx-auto rounded-lg object-contain mb-2"
                                            />
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{screenshot.name}</p>
                                            <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">Tap to change</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Tap to select screenshot</p>
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

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setStep('instructions'); setScreenshot(null); }}
                                    className="flex-1 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    disabled={!screenshot || uploading}
                                    onClick={handleSubmit}
                                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploading ? 'Uploading...' : 'Submit'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3 — Done */}
                    {step === 'done' && (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="w-10 h-10 text-green-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Receipt Submitted!</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Your payment is now <span className="font-semibold text-amber-500">Awaiting Verification</span>. We'll confirm your payment shortly.
                                </p>
                            </div>
                            <button
                                onClick={onDone}
                                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all"
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
