import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, AlertCircle, Package, TrendingDown } from 'lucide-react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';
import { getCsrfHeaders } from '@/lib/csrf';

interface BrokenBottleRecord {
    id: number;
    beverage_type: string;
    quantity: number;
    unit_type: string;
    report_date: string;
    notes: string | null;
    reporter: {
        id: number;
        full_name: string;
        email: string;
    } | null;
    created_at: string;
}

interface BrokenBottlesReportProps {
    filters?: {
        days?: string | number;
        start_date?: string;
        end_date?: string;
    };
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

export default function BrokenBottlesReport({ filters }: BrokenBottlesReportProps) {
    const [selectedDateFilter, setSelectedDateFilter] = useState(String(filters?.days || '30'));
    const [showDateDropdown, setShowDateDropdown] = useState(false);
    const [showCustomDateInputs, setShowCustomDateInputs] = useState(false);
    const [customStartDate, setCustomStartDate] = useState(filters?.start_date || '');
    const [customEndDate, setCustomEndDate] = useState(filters?.end_date || '');
    const [records, setRecords] = useState<BrokenBottleRecord[]>([]);
    const [loading, setLoading] = useState(false);

    // Initialize custom date inputs if custom range is active
    if (filters?.days === 'custom' && filters.start_date && filters.end_date && !showCustomDateInputs) {
        setShowCustomDateInputs(true);
    }

    useEffect(() => {
        fetchReports();
    }, [filters?.start_date, filters?.end_date]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters?.start_date) params.append('start_date', filters.start_date);
            if (filters?.end_date) params.append('end_date', filters.end_date);

            const response = await fetch(`/admin/api/broken-bottles/reports?${params.toString()}`, {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
            });

            if (response.ok) {
                const data = await response.json();
                setRecords(data.records);
            }
        } catch (error) {
            console.error('Error fetching broken bottles reports:', error);
        } finally {
            setLoading(false);
        }
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
            window.location.href = `/admin/broken-bottles-report?start_date=${startStr}&end_date=${endStr}`;
        }
    };

    const handleCustomDateApply = () => {
        if (customStartDate && customEndDate) {
            setShowCustomDateInputs(false);
            window.location.href = `/admin/broken-bottles-report?start_date=${customStartDate}&end_date=${customEndDate}`;
        }
    };

    const getTotalByBeverage = (beverage: string) => {
        return records
            .filter(r => r.beverage_type === beverage)
            .reduce((sum, r) => sum + r.quantity, 0);
    };

    const getTotalByUnitType = (unitType: string) => {
        return records
            .filter(r => r.unit_type === unitType)
            .reduce((sum, r) => sum + r.quantity, 0);
    };

    const beverageTypes = ['Red Horse', 'San Mig Light', 'San Mig Apple', 'San Mig Pilsen'];

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="Damaged Beverages Report - Mejeck Ice Plant" />

            <div className="space-y-6 px-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Damaged Beverages Report</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Track damaged beverages by type and date range</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Date Filter */}
                        <div className="relative">
                            <button
                                onClick={() => setShowDateDropdown(!showDateDropdown)}
                                className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition shadow-sm text-sm sm:text-base"
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
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-rose-200/50 dark:border-rose-700/50 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-rose-200/40 to-pink-200/40 rounded-full blur-xl"></div>
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Total Damaged Beverages</span>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{records.reduce((sum, r) => sum + r.quantity, 0)}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{records.length} reports</div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-4 border border-amber-200/50 dark:border-amber-700/50 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-amber-200/40 to-orange-200/40 rounded-full blur-xl"></div>
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-1">
                                <Package className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Total Damaged Cases</span>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{getTotalByUnitType('case')}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Cases reported</div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 border border-blue-200/50 dark:border-blue-700/50 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-blue-200/40 to-cyan-200/40 rounded-full blur-xl"></div>
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-1">
                                <Package className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Total Damaged Bottles</span>
                            </div>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{getTotalByUnitType('bottle')}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Individual bottles</div>
                        </div>
                    </div>
                </div>

                {/* Beverage Type Breakdown */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Breakdown by Beverage Type</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {beverageTypes.map((type) => (
                            <div key={type} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{type}</h3>
                                <div className="text-2xl font-bold text-gray-900 dark:text-white">{getTotalByBeverage(type)}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Bottles: {records.filter(r => r.beverage_type === type && r.unit_type === 'bottle').reduce((sum, r) => sum + r.quantity, 0)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Cases: {records.filter(r => r.beverage_type === type && r.unit_type === 'case').reduce((sum, r) => sum + r.quantity, 0)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Records Table */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Report Details</h2>
                    {loading ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                            <p>No damaged beverage reports found for the selected date range</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-200">Date</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-200">Beverage</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-200">Unit Type</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-200">Quantity</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-200">Reported By</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-200">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((record) => (
                                        <tr key={record.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-700">
                                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                                                {new Date(record.report_date).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                                                {record.beverage_type}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    record.unit_type === 'case' 
                                                        ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200'
                                                        : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                                                }`}>
                                                    {record.unit_type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-white font-semibold">
                                                {record.quantity}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                                                {record.reporter?.full_name || 'Unknown'}
                                            </td>
                                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                                                {record.notes || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AppSidebarLayout>
    );
}
