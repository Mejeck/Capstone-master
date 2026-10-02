import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { Wine, Plus, Trash2, AlertTriangle, TrendingUp, Calendar, User, Camera, X, ChevronDown, Package } from 'lucide-react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirmModal } from '@/hooks/useConfirmModal';
import { showToast } from '@/lib/toast';
import { getCsrfHeaders } from '@/lib/csrf';

interface BrokenBottle {
    id: number;
    beverage_type: string;
    quantity: number;
    unit_type: string;
    image_path: string | null;
    report_date: string;
    created_at: string;
    reporter: {
        id: number;
        full_name: string;
    } | null;
}

interface Stats {
    by_type: Array<{
        beverage_type: string;
        total_quantity: number;
        report_count: number;
    }>;
    total_broken: number;
    total_reports: number;
}

// Empty: the top nav/sidebar already shows which page is active, and
// the page has its own heading below, so a "Dashboard > X" trail here was
// just repeating both without adding a real path back anywhere new.
const breadcrumbs: BreadcrumbItem[] = [];

const dateFilterOptions = [
    { value: '1', label: 'Last 1 Day' },
    { value: '2', label: 'Last 2 Days' },
    { value: '7', label: 'Last 7 Days' },
    { value: '14', label: 'Last 14 Days' },
    { value: '30', label: 'Last 30 Days' },
    { value: '90', label: 'Last 90 Days' },
    { value: 'custom', label: 'Custom Range' },
];

export default function BrokenBottles() {
    const [brokenBottles, setBrokenBottles] = useState<BrokenBottle[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    // Centered confirm() replacement, used for "Delete this record?" below.
    const { confirm, confirmModalProps } = useConfirmModal();
    const [showDateDropdown, setShowDateDropdown] = useState(false);
    const [showCustomDateInputs, setShowCustomDateInputs] = useState(false);
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [selectedDateFilter, setSelectedDateFilter] = useState('30');
    const [formData, setFormData] = useState({
        beverage_type: 'Red Horse',
        quantity: 1,
        unit_type: 'bottle' as 'bottle' | 'case',
        image: null as File | null,
    });
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const beverageTypes = ['Red Horse', 'San Mig Light', 'San Mig Apple', 'San Mig Pilsen'];

    useEffect(() => {
        fetchBrokenBottles();
        fetchStats();
    }, []);

    // Close the "Report Damaged Beverage" modal with the Escape key.
    useEffect(() => {
        if (!showModal) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowModal(false);
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [showModal]);

    const fetchBrokenBottles = async (startDate?: string, endDate?: string) => {
        try {
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);

            const response = await fetch(`/admin/api/broken-bottles/reports?${params.toString()}`, {
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
            });
            if (response.ok) {
                const data = await response.json();
                setBrokenBottles(data.records || []);
            }
        } catch (error) {
            console.error('Error fetching broken bottles:', error);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await fetch('/admin/api/broken-bottles/stats', {
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('beverage_type', formData.beverage_type);
            formDataToSend.append('quantity', formData.quantity.toString());
            formDataToSend.append('unit_type', formData.unit_type);
            if (formData.image) {
                formDataToSend.append('image', formData.image);
            }

            const response = await fetch('/admin/api/broken-bottles', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
                body: formDataToSend,
            });

            if (response.ok) {
                setShowModal(false);
                setFormData({ beverage_type: 'Red Horse', quantity: 1, unit_type: 'bottle', image: null });
                setImagePreview(null);
                fetchBrokenBottles();
                fetchStats();
                showToast('success', 'Damaged beverage reported.');
            } else {
                const error = await response.json();
                alert(error.error || 'Failed to report broken bottle');
            }
        } catch (error) {
            console.error('Error reporting broken bottle:', error);
            alert('Failed to report broken bottle');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormData({ ...formData, image: file });
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setFormData({ ...formData, image: null });
        setImagePreview(null);
    };

    const handleDateFilterChange = (optionValue: string) => {
        if (optionValue === 'custom') {
            setSelectedDateFilter('custom');
            setShowDateDropdown(false);
            setShowCustomDateInputs(true);
        } else {
            const days = parseInt(optionValue);
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];

            setSelectedDateFilter(optionValue);
            setShowDateDropdown(false);
            setShowCustomDateInputs(false);
            fetchBrokenBottles(startStr, endStr);
        }
    };

    const handleCustomDateApply = () => {
        if (customStartDate && customEndDate) {
            setShowCustomDateInputs(false);
            fetchBrokenBottles(customStartDate, customEndDate);
        }
    };

    const handleDelete = async (id: number) => {
        if (!(await confirm({ message: 'Are you sure you want to delete this record?', danger: true }))) return;

        try {
            const response = await fetch(`/admin/api/broken-bottles/${id}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
            });

            if (response.ok) {
                fetchBrokenBottles();
                fetchStats();
                showToast('success', 'Record deleted.');
            } else {
                alert('Failed to delete record');
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            alert('Failed to delete record');
        }
    };

    const getBeverageColor = (type: string) => {
        switch (type) {
            case 'Red Horse': return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200';
            case 'San Mig Light': return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200';
            case 'San Mig Apple': return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200';
            case 'San Mig Pilsen': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200';
            default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200';
        }
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <div className="px-4 sm:px-6 lg:px-8 py-6">
                <Head title="Damaged Beverages - Mejeck Ice Plant" />

                {/* Page Header */}
                <div className="mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg">
                                <Wine className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Damaged Beverages Report</h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Track and manage damaged beverages</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Date Filter */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowDateDropdown(!showDateDropdown)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition shadow-sm text-sm"
                                >
                                    <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                    <span className="text-sm text-gray-700 dark:text-gray-200">
                                        {selectedDateFilter === 'custom' && customStartDate && customEndDate
                                            ? `${customStartDate} to ${customEndDate}`
                                            : dateFilterOptions.find(opt => opt.value === selectedDateFilter)?.label || 'Last 30 Days'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                </button>

                                {showDateDropdown && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                                        <div className="py-1">
                                            {dateFilterOptions.map((option) => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => handleDateFilterChange(option.value)}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Custom Date Range Inputs */}
                                {showCustomDateInputs && (
                                    <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 p-4">
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={customStartDate}
                                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                                                <input
                                                    type="date"
                                                    value={customEndDate}
                                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={handleCustomDateApply}
                                                    disabled={!customStartDate || !customEndDate}
                                                    className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                                                >
                                                    Apply
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowCustomDateInputs(false);
                                                        setSelectedDateFilter('30');
                                                        setCustomStartDate('');
                                                        setCustomEndDate('');
                                                        fetchBrokenBottles();
                                                    }}
                                                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-200 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 transition"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setShowModal(true)}
                                className="flex items-center px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg font-semibold hover:from-red-600 hover:to-rose-700 transition-all"
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                Report Damaged Beverage
                            </button>
                        </div>
                    </div>
                </div>
                {/* Stats Cards — same card language as the main Dashboard (solid card, colored
                    left border, tinted icon chip on the left, number beside it) instead of the
                    pale two-tone gradients this page used before, so it reads as the same app.
                    Colors also now match the Unit badges in the table below: amber = case,
                    cyan = bottle, so the same hue means the same thing everywhere on this page. */}
                {stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 border-l-blue-500 p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 bg-blue-100 dark:bg-blue-900/30">
                                    <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-none tabular-nums">{stats.total_reports}</p>
                            </div>
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-3">Total Reports</p>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 border-l-amber-500 p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/30">
                                    <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-none tabular-nums">
                                    {brokenBottles.filter(b => b.unit_type === 'case').reduce((sum, b) => sum + b.quantity, 0)}
                                </p>
                            </div>
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-3">Total Damaged Cases</p>
                        </div>

                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 border-l-4 border-l-cyan-500 p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 bg-cyan-100 dark:bg-cyan-900/30">
                                    <Wine className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                                </div>
                                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-none tabular-nums">
                                    {brokenBottles.filter(b => b.unit_type === 'bottle').reduce((sum, b) => sum + b.quantity, 0)}
                                </p>
                            </div>
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-3">Total Damaged Bottles</p>
                        </div>
                    </div>
                )}

                {/* Table — cases and bottles used to be two separate tables with identical
                    columns, telling the same story twice split by unit type. Merged into one
                    chronological history with a Type column instead, so nothing reported is
                    harder to find, but nothing is duplicated either. */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-red-50 dark:bg-red-900/20">
                        <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Damage History
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-slate-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Beverage Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reported By</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Proof</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                                {brokenBottles.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                                            <p>No damage reported yet</p>
                                        </td>
                                    </tr>
                                ) : (
                                    brokenBottles.map((bottle) => {
                                        const isCase = bottle.unit_type === 'case';
                                        return (
                                            <tr key={bottle.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                                        <Calendar className="w-4 h-4 mr-2" />
                                                        {new Date(bottle.report_date).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getBeverageColor(bottle.beverage_type)}`}>
                                                        {bottle.beverage_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isCase ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'}`}>
                                                        {isCase ? <Package className="w-3.5 h-3.5" /> : <Wine className="w-3.5 h-3.5" />}
                                                        {isCase ? 'Case' : 'Bottle'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`text-lg font-bold ${isCase ? 'text-amber-600 dark:text-amber-400' : 'text-cyan-600 dark:text-cyan-400'}`}>
                                                        {bottle.quantity} {isCase ? 'cases' : 'bottles'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                                                        <User className="w-4 h-4 mr-2" />
                                                        {bottle.reporter?.full_name || 'Unknown'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {bottle.image_path ? (
                                                        <a
                                                            href={bottle.image_path}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block"
                                                        >
                                                            <img
                                                                src={bottle.image_path}
                                                                alt="Proof"
                                                                className="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-600 hover:opacity-80 transition-opacity"
                                                            />
                                                        </a>
                                                    ) : (
                                                        <span className="text-sm text-gray-400">No image</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <button
                                                        onClick={() => handleDelete(bottle.id)}
                                                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Report Damaged Beverage</h2>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                    >
                                        <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Beverage Type
                                        </label>
                                        <select
                                            value={formData.beverage_type}
                                            onChange={(e) => setFormData({ ...formData, beverage_type: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                        >
                                            {beverageTypes.map((type) => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Unit Type
                                        </label>
                                        <select
                                            value={formData.unit_type}
                                            onChange={(e) => setFormData({ ...formData, unit_type: e.target.value as 'bottle' | 'case' })}
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                        >
                                            <option value="bottle">Bottle</option>
                                            <option value="case">Case</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Quantity
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.quantity}
                                            onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Proof Image (Required)
                                        </label>
                                        {imagePreview ? (
                                            <div className="relative">
                                                <img
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    className="w-full h-48 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveImage}
                                                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-red-500 dark:hover:border-red-400 transition-colors">
                                                <input
                                                    type="file"
                                                    id="image-upload"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                    className="hidden"
                                                />
                                                <label
                                                    htmlFor="image-upload"
                                                    className="cursor-pointer flex flex-col items-center"
                                                >
                                                    <Camera className="w-8 h-8 text-gray-400 mb-2" />
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        Click to upload image
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                                        PNG, JPG, GIF up to 4MB
                                                    </span>
                                                </label>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || !formData.image}
                                        className="w-full bg-gradient-to-r from-red-500 to-rose-600 text-white py-3 rounded-lg font-semibold hover:from-red-600 hover:to-rose-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                                    >
                                        <AlertTriangle className="w-5 h-5 mr-2" />
                                        {loading ? 'Submitting...' : 'Submit Report'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmModal {...confirmModalProps} />
        </AppSidebarLayout>
    );
}
