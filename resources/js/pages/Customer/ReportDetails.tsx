import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import { 
    ArrowLeft, 
    FileText, 
    CheckCircle, 
    Clock, 
    XCircle, 
    AlertCircle,
    Download,
    Calendar,
    User,
    MessageSquare,
    X
} from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';
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
    };
    evidence: ReportEvidence[];
    reviewer?: {
        full_name: string;
    };
}

interface ReportDetailsProps {
    report: CustomerReport;
}

export default function ReportDetails({ report }: ReportDetailsProps) {
    const [selectedMedia, setSelectedMedia] = useState<ReportEvidence | null>(null);

    // Esc closes the media modal
    useEffect(() => {
        if (!selectedMedia) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedMedia(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedMedia]);

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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
            <Head title={`Report #${report.report_number}`} />
            <CustomerNav currentPage="reports" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
                <div className="mb-8">
                    <Link
                        href={route('customer.reports')}
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
                    <section className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Order Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Order Number</p>
                                    <p className="font-medium text-gray-900 dark:text-white">#{report.order?.order_id}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Order Date</p>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {report.order?.order_date ? new Date(report.order.order_date).toLocaleDateString() : '—'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <PesoSign className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        ₱{Number(report.order?.total_amount ?? 0).toFixed(2)}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                    <p className="font-medium text-gray-900 dark:text-white">Under Review</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {new Date(report.reviewed_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        )}

                        {(report.status === 'validated' || report.status === 'resolved') && (
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Report Validated</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {report.reviewed_at ? new Date(report.reviewed_at).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {report.status === 'rejected' && (
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center flex-shrink-0">
                                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Report Rejected</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {report.reviewed_at ? new Date(report.reviewed_at).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {report.resolved_at && (
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center flex-shrink-0">
                                    <CheckCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Case Resolved</p>
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
                                {report.reviewer && (
                                    <div className="flex items-start gap-3">
                                        <User className="w-5 h-5 text-gray-400 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">Reviewed By</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {report.reviewer.full_name}
                                            </p>
                                        </div>
                                    </div>
                                )}

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

                {/* Media Modal */}
                {selectedMedia && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] overflow-hidden">
                            <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="min-w-0 truncate text-lg font-semibold text-gray-900 dark:text-white">
                                    {selectedMedia.original_name}
                                </h3>
                                <button
                                    onClick={() => setSelectedMedia(null)}
                                    aria-label="Close"
                                    className="p-2.5 -m-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-4">
                                {selectedMedia.file_type === 'image' ? (
                                    <img
                                        src={`/storage/${selectedMedia.file_path}`}
                                        alt={selectedMedia.original_name}
                                        className="max-w-full max-h-[70vh] object-contain mx-auto"
                                    />
                                ) : (
                                    <video
                                        src={`/storage/${selectedMedia.file_path}`}
                                        controls
                                        className="max-w-full max-h-[70vh] mx-auto"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
