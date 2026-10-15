import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import { 
    FileText, 
    Eye, 
    CheckCircle, 
    Clock, 
    XCircle, 
    AlertCircle,
    Filter,
    Search,
    Calendar,
    User,
    Package,
    Camera,
    Video,
    RefreshCw
} from 'lucide-react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';

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
    customer: {
        id: number;
        full_name: string;
        email: string;
    };
    evidence: Array<{
        id: number;
        file_type: 'image' | 'video';
        original_name: string;
        file_size: number;
    }>;
    reviewer?: {
        full_name: string;
    };
}

interface CustomerReportsProps {
    reports: CustomerReport[];
}

// Empty: the top nav/sidebar already shows which page is active, and
// the page has its own heading below, so a "Dashboard > X" trail here was
// just repeating both without adding a real path back anywhere new.
const breadcrumbs: BreadcrumbItem[] = [];

export default function CustomerReports({ reports: initialReports }: CustomerReportsProps) {
    const [reports, setReports] = useState(initialReports);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [stats, setStats] = useState({
        total_reports: 0,
        submitted: 0,
        under_review: 0,
        validated: 0,
        rejected: 0,
        resolved: 0,
    });
    const [loading, setLoading] = useState(false);
    const [visibleCount, setVisibleCount] = useState(10);

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        setVisibleCount(10);
    }, [searchTerm, filterStatus]);

    const fetchStats = async () => {
        try {
            const response = await fetch('/admin/api/customer-reports/stats');
            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const filteredReports = reports.filter(report => {
        const matchesSearch = report.report_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            report.customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            report.order.order_id.toString().includes(searchTerm);
        
        const matchesFilter = filterStatus === 'all' || report.status === filterStatus;

        return matchesSearch && matchesFilter;
    });

    const visibleReports = filteredReports.slice(0, visibleCount);

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

    const getStatusBorderColor = (status: string) => {
        switch (status) {
            case 'submitted':
                return 'border-l-blue-500';
            case 'under_review':
                return 'border-l-yellow-500';
            case 'validated':
                return 'border-l-green-500';
            case 'rejected':
                return 'border-l-red-500';
            case 'resolved':
                return 'border-l-purple-500';
            default:
                return 'border-l-gray-300';
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

    const refreshData = async () => {
        setLoading(true);
        try {
            const response = await fetch('/admin/customer-reports');
            const data = await response.json();
            setReports(data.props.reports);
            await fetchStats();
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="Customer Reports" />

            <div className="max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Customer Reports</h1>
                            <p className="mt-1.5 text-gray-600 dark:text-gray-400">
                                Manage and review customer damage reports
                            </p>
                        </div>
                        <button
                            onClick={refreshData}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                {/* No "Under Review" card: nothing in this app ever moves a
                    report into that status (updateStatus() only accepts
                    validated/rejected), so it would always read 0.
                    No "Submitted" card either: clicking it silently filtered
                    the list, which read as confusing since new reports land
                    here by default — "Submitted" stays a real filter option
                    in the dropdown below, just not a stat card. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total', key: 'all', value: stats.total_reports, icon: FileText, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-100 dark:bg-gray-700', iconColor: 'text-gray-500 dark:text-gray-400', ring: 'ring-gray-400' },
                        { label: 'Validated', key: 'validated', value: stats.validated, icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30', iconColor: 'text-green-600 dark:text-green-400', ring: 'ring-green-400' },
                        { label: 'Rejected', key: 'rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30', iconColor: 'text-red-600 dark:text-red-400', ring: 'ring-red-400' },
                        { label: 'Resolved', key: 'resolved', value: stats.resolved, icon: CheckCircle, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30', iconColor: 'text-purple-600 dark:text-purple-400', ring: 'ring-purple-400' },
                    ].map((stat) => {
                        const isActive = filterStatus === stat.key;
                        return (
                            <button
                                key={stat.label}
                                type="button"
                                onClick={() => setFilterStatus(stat.key)}
                                aria-pressed={isActive}
                                className={`text-left bg-white dark:bg-gray-800 rounded-xl border shadow-sm p-4 flex items-start justify-between gap-3 transition-all hover:shadow-md ${
                                    isActive
                                        ? `border-transparent ring-2 ${stat.ring}`
                                        : 'border-gray-200 dark:border-gray-700'
                                }`}
                            >
                                <div className="min-w-0">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{stat.label}</p>
                                    <p className={`mt-1 text-2xl font-bold leading-none ${stat.color}`}>{stat.value}</p>
                                </div>
                                <div className={`shrink-0 rounded-full p-2 ${stat.bg}`}>
                                    <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 mb-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by report number, customer name, or description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-10 pl-10 pr-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                        <div className="relative sm:w-56 shrink-0">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full h-10 pl-10 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg text-sm appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            >
                                <option value="all">All Status</option>
                                <option value="submitted">Submitted</option>
                                <option value="under_review">Under Review</option>
                                <option value="validated">Validated</option>
                                <option value="rejected">Rejected</option>
                                <option value="resolved">Resolved</option>
                            </select>
                        </div>
                    </div>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Showing {filteredReports.length === 0 ? 0 : Math.min(visibleCount, filteredReports.length)} of {filteredReports.length} report{filteredReports.length === 1 ? '' : 's'}
                    {filterStatus !== 'all' || searchTerm ? ' matching your filters' : ''}
                </p>

                {/* Reports List */}
                {filteredReports.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <FileText className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Reports Found</h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {searchTerm || filterStatus !== 'all'
                                ? 'No reports match your search criteria.'
                                : 'No customer reports have been submitted yet.'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {visibleReports.map((report) => {
                            const hasFooter = Boolean(report.rejection_reason || report.admin_notes || report.reviewed_at);
                            return (
                            <div
                                key={report.id}
                                className={`bg-white dark:bg-gray-800 rounded-xl border border-l-4 border-gray-200 dark:border-gray-700 ${getStatusBorderColor(report.status)} shadow-sm hover:shadow-md transition-shadow p-6`}
                            >
                                <div className={`flex flex-col md:flex-row md:items-start justify-between gap-4 ${hasFooter ? 'mb-4' : ''}`}>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-3">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                Report #{report.report_number}
                                            </h3>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                                                {getStatusIcon(report.status)}
                                                {getStatusText(report.status)}
                                            </span>
                                            {report.action_type && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                                                    {report.action_type === 'refund' ? 'Refund' : 'Change Item'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
                                            <span className="inline-flex items-center gap-1.5">
                                                <User className="w-4 h-4 shrink-0" />
                                                {report.customer.full_name}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <Package className="w-4 h-4 shrink-0" />
                                                Order #{report.order.order_id}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5">
                                                <Calendar className="w-4 h-4 shrink-0" />
                                                {new Date(report.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-gray-700 dark:text-gray-300 line-clamp-2 mb-3">
                                            {report.description}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-500 dark:text-gray-400">
                                            {report.evidence.some(e => e.file_type === 'image') && (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Camera className="w-4 h-4 shrink-0" />
                                                    {report.evidence.filter(e => e.file_type === 'image').length} images
                                                </span>
                                            )}
                                            {report.evidence.some(e => e.file_type === 'video') && (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Video className="w-4 h-4 shrink-0" />
                                                    {report.evidence.filter(e => e.file_type === 'video').length} videos
                                                </span>
                                            )}
                                            {report.refund_amount && (
                                                <span className="font-medium text-green-600 dark:text-green-400">
                                                    Refund: ₱{Number(report.refund_amount).toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Link
                                        href={route('admin.customer-reports.show', report.id)}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shrink-0 self-start"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Review
                                    </Link>
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

                                {report.reviewed_at && (
                                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                                        Reviewed by {report.reviewer?.full_name || 'Unknown'} on {new Date(report.reviewed_at).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                            );
                        })}

                        {filteredReports.length > visibleCount && (
                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => setVisibleCount((count) => count + 10)}
                                    className="inline-flex items-center justify-center px-5 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    Load {Math.min(10, filteredReports.length - visibleCount)} more
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AppSidebarLayout>
    );
}
