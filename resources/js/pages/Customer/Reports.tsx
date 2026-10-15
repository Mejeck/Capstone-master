import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { 
    FileText, 
    Eye, 
    AlertCircle, 
    CheckCircle, 
    Clock, 
    XCircle,
    Plus,
    Camera,
    Video,
    AlertTriangle,
    Package,
    Truck,
    User
} from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';

interface CustomerReport {
    id: number;
    report_number: string;
    description: string;
    report_type: 'damaged_beverages' | 'wrong_product' | 'delivery_boy_issue' | 'other';
    delivery_boy_name: string | null;
    delivery_boy_issue_details: string | null;
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
    evidence: Array<{
        id: number;
        file_type: 'image' | 'video';
        original_name: string;
        file_size: number;
    }>;
}

interface ReportsProps {
    reports: CustomerReport[];
}

export default function Reports({ reports }: ReportsProps) {
    const getReportTypeIcon = (type: string) => {
        switch (type) {
            case 'damaged_beverages':
                return <AlertTriangle className="w-4 h-4" />;
            case 'wrong_product':
                return <Package className="w-4 h-4" />;
            case 'delivery_boy_issue':
                return <Truck className="w-4 h-4" />;
            case 'other':
                return <AlertCircle className="w-4 h-4" />;
            default:
                return <FileText className="w-4 h-4" />;
        }
    };

    const getReportTypeColor = (type: string) => {
        switch (type) {
            case 'damaged_beverages':
                return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
            case 'wrong_product':
                return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
            case 'delivery_boy_issue':
                return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
            case 'other':
                return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300';
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300';
        }
    };

    const getReportTypeText = (type: string) => {
        switch (type) {
            case 'damaged_beverages':
                return 'Damaged Items';
            case 'wrong_product':
                return 'Wrong Product'; // older reports only
            case 'delivery_boy_issue':
                return 'Delivery Boy Issue';
            case 'other':
                return 'Other Issue';
            default:
                return type;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'submitted':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
            case 'under_review':
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
            case 'validated':
                return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
            case 'rejected':
                return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
            case 'resolved':
                return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'submitted':
                return <FileText className="w-4 h-4" />;
            case 'under_review':
                return <Clock className="w-4 h-4" />;
            case 'validated':
                return <CheckCircle className="w-4 h-4" />;
            case 'rejected':
                return <XCircle className="w-4 h-4" />;
            case 'resolved':
                return <CheckCircle className="w-4 h-4" />;
            default:
                return <AlertCircle className="w-4 h-4" />;
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
            <Head title="My Reports" />
            <CustomerNav currentPage="reports" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Reports</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Track the status of your damage and issue reports.
                    </p>
                </div>

                {reports.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                        <FileText className="w-14 h-14 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Reports Yet</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                            You haven't submitted any reports yet.
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
                            Reports can be submitted from your delivered orders.
                        </p>
                        <Link
                            href="/customer/my-orders"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg transition-all font-medium text-sm shadow-sm"
                        >
                            <CheckCircle className="w-4 h-4" />
                            View Delivered Orders
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reports.map((report) => (
                            <div
                                key={report.id}
                                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md transition-shadow p-6"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                Report #{report.report_number}
                                            </h3>
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getReportTypeColor(report.report_type)}`}>
                                                {getReportTypeIcon(report.report_type)}
                                                {getReportTypeText(report.report_type)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Order #{report.order?.order_id} • {report.order?.order_date ? new Date(report.order.order_date).toLocaleDateString() : '—'}
                                        </p>
                                        {report.delivery_boy_name && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                <User className="w-3 h-3 inline mr-1" />
                                                Delivery Boy: {report.delivery_boy_name}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(report.status)}`}>
                                            {getStatusIcon(report.status)}
                                            {getStatusText(report.status)}
                                        </span>
                                        {report.action_type && (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                                {report.action_type === 'refund' ? 'Refund' : 'Change Item'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <p className="text-gray-700 dark:text-gray-300 mb-4 line-clamp-2">
                                    {report.description}
                                </p>

                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        {report.evidence.some(e => e.file_type === 'image') && (
                                            <div className="flex items-center gap-1">
                                                <Camera className="w-4 h-4" />
                                                <span>{report.evidence.filter(e => e.file_type === 'image').length} images</span>
                                            </div>
                                        )}
                                        {report.evidence.some(e => e.file_type === 'video') && (
                                            <div className="flex items-center gap-1">
                                                <Video className="w-4 h-4" />
                                                <span>{report.evidence.filter(e => e.file_type === 'video').length} videos</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Submitted on {new Date(report.created_at).toLocaleDateString()}
                                    </div>
                                </div>

                                {report.rejection_reason && (
                                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                        <p className="text-sm text-red-700 dark:text-red-300">
                                            <strong>Rejection Reason:</strong> {report.rejection_reason}
                                        </p>
                                    </div>
                                )}

                                {report.admin_notes && (
                                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <p className="text-sm text-blue-700 dark:text-blue-300">
                                            <strong>Admin Notes:</strong> {report.admin_notes}
                                        </p>
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        {report.refund_amount && (
                                            <span className="font-medium text-green-600 dark:text-green-400">
                                                Refund: ₱{Number(report.refund_amount).toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                    <Link
                                        href={route('customer.reports.show', report.id)}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg transition-all font-medium text-sm shadow-sm"
                                    >
                                        <Eye className="w-4 h-4" />
                                        View Details
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
