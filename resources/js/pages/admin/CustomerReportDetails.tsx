import React, { useState, useEffect } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { 
    ArrowLeft, 
    FileText, 
    CheckCircle, 
    Clock, 
    XCircle, 
    AlertCircle,
    Calendar,
    Package,
    User,
    MessageSquare,
    Send,
    RotateCcw,
    CheckSquare
} from 'lucide-react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';
import { storageUrl } from '@/lib/storage-url';
import InputError from '@/components/input-error';
import PesoSign from '@/components/icons/peso-sign';
import ReportEvidenceGallery from '@/components/report-evidence-gallery';

interface ReportEvidence {
    id: number;
    file_path: string;
    file_type: 'image' | 'video';
    original_name: string;
    file_size: number;
}

interface CustomerReport {
    id: number;
    report_number: string;
    description: string;
    status: 'submitted' | 'under_review' | 'validated' | 'rejected' | 'resolved';
    action_type: 'refund' | 'replacement' | 'none' | null;
    refund_amount: number | null;
    admin_notes: string | null;
    rejection_reason: string | null;
    reviewed_at: string | null;
    resolved_at: string | null;
    created_at: string;
    order: {
        order_id: number;
        order_date: string;
        total_amount: number;
        status: string;
        order_items: {
            order_item_id: number;
            quantity: number;
            unit_price: number;
            subtotal: number;
            product: {
                product_name: string;
                unit: string;
            } | null;
        }[];
    };
    customer: {
        id: number;
        full_name: string;
        email: string;
    };
    evidence: ReportEvidence[];
    reviewer?: {
        full_name: string;
    };
}

interface CustomerReportDetailsProps {
    report: CustomerReport;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/admin/dashboard',
    },
    {
        title: 'Customer Reports',
        href: '/admin/customer-reports',
    },
    {
        title: 'Report Details',
        href: '#',
    },
];

export default function CustomerReportDetails({ report }: CustomerReportDetailsProps) {
    const [selectedMedia, setSelectedMedia] = useState<ReportEvidence | null>(null);
    const [showValidationForm, setShowValidationForm] = useState(false);
    const [showResolveForm, setShowResolveForm] = useState(false);

    // Close whichever modal is open with the Escape key. Media viewer takes
    // priority since it's the one most likely to be opened on top of another.
    useEffect(() => {
        if (!selectedMedia && !showValidationForm && !showResolveForm) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (selectedMedia) setSelectedMedia(null);
            else if (showValidationForm) setShowValidationForm(false);
            else if (showResolveForm) setShowResolveForm(false);
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [selectedMedia, showValidationForm, showResolveForm]);

    const { data, setData, put, processing, errors, reset } = useForm({
        status: '',
        admin_notes: '',
        rejection_reason: '',
        resolution_notes: '',
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'submitted':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
            case 'under_review':
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
            case 'validated':
                return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
            case 'rejected':
                return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
            case 'resolved':
                return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'submitted':
                return <FileText className="w-5 h-5" />;
            case 'under_review':
                return <Clock className="w-5 h-5" />;
            case 'validated':
                return <CheckCircle className="w-5 h-5" />;
            case 'rejected':
                return <XCircle className="w-5 h-5" />;
            case 'resolved':
                return <CheckCircle className="w-5 h-5" />;
            default:
                return <AlertCircle className="w-5 h-5" />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'submitted':
                return 'Submitted';
            case 'under_review':
                return 'Under Review';
            case 'validated':
                return 'Validated';
            case 'rejected':
                return 'Rejected';
            case 'resolved':
                return 'Resolved';
            default:
                return status;
        }
    };

    const handleStatusUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        
        put(route('admin.customer-reports.update-status', report.id), {
            onSuccess: () => {
                setShowValidationForm(false);
                reset();
            },
        });
    };

    const handleResolve = (e: React.FormEvent) => {
        e.preventDefault();
        
        put(route('admin.customer-reports.resolve', report.id), {
            onSuccess: () => {
                setShowResolveForm(false);
                reset();
            },
        });
    };

    const canValidate = report.status === 'submitted' || report.status === 'under_review';
    const canResolve = report.status === 'validated';

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title={`Report #${report.report_number}`} />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <Link
                        href={route('admin.customer-reports')}
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Reports
                    </Link>
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Report #{report.report_number}
                            </h1>
                            <p className="mt-2 text-gray-600 dark:text-gray-400">
                                Submitted on {new Date(report.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(report.status)}`}>
                                {getStatusIcon(report.status)}
                                {getStatusText(report.status)}
                            </span>
                            {report.action_type && (
                                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                                    {report.action_type === 'refund' ? 'Refund' : 'Change Item'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Every detail of the report in one container, section by section. */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md divide-y divide-gray-100 dark:divide-gray-700">
                    {(canValidate || canResolve) && (
                        <section className="p-6 flex flex-wrap gap-3">
                            {canValidate && (
                                <button
                                    onClick={() => setShowValidationForm(true)}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <CheckSquare className="w-4 h-4" />
                                    Review & Validate
                                </button>
                            )}
                            {canResolve && (
                                <button
                                    onClick={() => setShowResolveForm(true)}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <CheckSquare className="w-4 h-4" />
                                    Mark as Resolved
                                </button>
                            )}
                            {report.status === 'rejected' && canValidate && (
                                <button
                                    onClick={() => setShowValidationForm(true)}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Reconsider Report
                                </button>
                            )}
                        </section>
                    )}

                    <section className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer & Order Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3">
                                <User className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Customer</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{report.customer.full_name}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{report.customer.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Order Number</p>
                                    <p className="font-medium text-gray-900 dark:text-white">#{report.order.order_id}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {new Date(report.order.order_date).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <PesoSign className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Order Amount</p>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        ₱{Number(report.order.total_amount).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Order Status</p>
                                    <p className="font-medium text-green-600 dark:text-green-400">Delivered</p>
                                </div>
                            </div>
                        </div>

                        {report.order.order_items.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                                    <Package className="w-4 h-4" />
                                    Items Ordered
                                </p>
                                <div className="space-y-1.5">
                                    {report.order.order_items.map((item) => (
                                        <div key={item.order_item_id} className="flex items-center justify-between text-sm">
                                            <span className="text-gray-900 dark:text-white">
                                                {item.product?.product_name ?? 'Unknown Product'} × {Number(item.quantity)}
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400">
                                                ₱{Number(item.subtotal).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Issue Description</h2>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {report.description}
                        </p>
                    </section>

                    <section className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Evidence Files</h2>
                        <ReportEvidenceGallery evidence={report.evidence} onOpen={setSelectedMedia} />
                    </section>

                    <section className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status Timeline</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">Report Submitted</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {new Date(report.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                                
                        {report.reviewed_at && (
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Reviewed</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {new Date(report.reviewed_at).toLocaleDateString()}
                                    </p>
                                    {report.reviewer && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            by {report.reviewer.full_name}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {report.resolved_at && (
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center flex-shrink-0">
                                    <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Resolved</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {new Date(report.resolved_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        )}
                        </div>
                    </section>

                    {(report.admin_notes || report.rejection_reason || report.refund_amount) && (
                        <section className="p-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Admin Response</h2>
                            <div className="space-y-4">
                                {report.rejection_reason && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                        <div className="flex items-start gap-2">
                                            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                                            <div>
                                                <p className="font-medium text-red-700 dark:text-red-300">Rejection Reason</p>
                                                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                                    {report.rejection_reason}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {report.refund_amount && (
                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                        <div className="flex items-start gap-2">
                                            <PesoSign className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                                            <div>
                                                <p className="font-medium text-green-700 dark:text-green-300">Refund Amount</p>
                                                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                                    ₱{Number(report.refund_amount).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {report.admin_notes && (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-start gap-2">
                                            <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                                            <div>
                                                <p className="font-medium text-blue-700 dark:text-blue-300">Admin Notes</p>
                                                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 whitespace-pre-wrap">
                                                    {report.admin_notes}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>

                {/* Validation Form Modal */}
                {showValidationForm && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Review Report</h2>
                                    <button
                                        onClick={() => setShowValidationForm(false)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleStatusUpdate} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Decision *
                                        </label>
                                        <select
                                            value={data.status}
                                            onChange={(e) => setData('status', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                            required
                                        >
                                            <option value="">Select Decision</option>
                                            <option value="validated">Validate Report</option>
                                            <option value="rejected">Reject Report</option>
                                        </select>
                                        <InputError message={errors.status} />
                                    </div>

                                    {data.status === 'rejected' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Rejection Reason *
                                            </label>
                                            <textarea
                                                value={data.rejection_reason}
                                                onChange={(e) => setData('rejection_reason', e.target.value)}
                                                rows={3}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                                placeholder="Explain why this report is being rejected..."
                                                required
                                            />
                                            <InputError message={errors.rejection_reason} />
                                        </div>
                                    )}

                                    {data.status === 'validated' && (
                                        <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-sm text-indigo-800 dark:text-indigo-200">
                                            <p className="font-medium">Action: Change Item</p>
                                            <p className="mt-1">A valid report is settled by changing the damaged item. Refunds are not given.</p>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Admin Notes
                                        </label>
                                        <textarea
                                            value={data.admin_notes}
                                            onChange={(e) => setData('admin_notes', e.target.value)}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                            placeholder="Add any additional notes..."
                                        />
                                        <InputError message={errors.admin_notes} />
                                    </div>

                                    <div className="flex gap-3 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setShowValidationForm(false)}
                                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={processing}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                            {processing ? 'Processing...' : 'Submit Decision'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Resolve Form Modal */}
                {showResolveForm && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Mark as Resolved</h2>
                                    <button
                                        onClick={() => setShowResolveForm(false)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleResolve} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Resolution Notes *
                                        </label>
                                        <textarea
                                            value={data.resolution_notes}
                                            onChange={(e) => setData('resolution_notes', e.target.value)}
                                            rows={4}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                            placeholder="Describe how this issue was resolved..."
                                            required
                                        />
                                        <InputError message={errors.resolution_notes} />
                                    </div>

                                    <div className="flex gap-3 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setShowResolveForm(false)}
                                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={processing}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                        >
                                            {processing ? 'Processing...' : 'Mark Resolved'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Media Modal */}
                {selectedMedia && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {selectedMedia.original_name}
                                </h3>
                                <button
                                    onClick={() => setSelectedMedia(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-4">
                                {selectedMedia.file_type === 'image' ? (
                                    <img
                                        src={storageUrl(selectedMedia.file_path) ?? ''}
                                        alt={selectedMedia.original_name}
                                        className="max-w-full max-h-[70vh] object-contain mx-auto"
                                    />
                                ) : (
                                    <video
                                        src={storageUrl(selectedMedia.file_path) ?? ''}
                                        controls
                                        className="max-w-full max-h-[70vh] mx-auto"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppSidebarLayout>
    );
}
