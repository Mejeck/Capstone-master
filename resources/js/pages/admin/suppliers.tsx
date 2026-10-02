import React, { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import { getCsrfHeaders } from '@/lib/csrf';
import { 
    Building2, 
    Phone, 
    Mail, 
    MapPin, 
    Plus, 
    Edit, 
    Trash2, 
    ToggleLeft, 
    ToggleRight,
    Package,
    Clock,
    Search,
    Filter,
    X,
    CheckCircle,
    XCircle
} from 'lucide-react';
import AppSidebarLayout from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirmModal } from '@/hooks/useConfirmModal';
import { showToast } from '@/lib/toast';

interface Supplier {
    id: number;
    supplier_code: string;
    supplier_name: string;
    contact_person: string;
    phone: string;
    email?: string;
    address: string;
    city: string;
    province: string;
    payment_terms: string;
    delivery_lead_time: string;
    is_active: boolean;
    total_purchase_orders: number;
    active_purchase_orders: number;
    created_at: string;
}

interface SuppliersProps {
    suppliers: Supplier[];
}

// Empty: the top nav/sidebar already shows which page is active, and
// the page has its own heading below, so a "Dashboard > X" trail here was
// just repeating both without adding a real path back anywhere new.
const breadcrumbs: BreadcrumbItem[] = [];

// Contact person is a name, not a free-text field — strips anything that
// isn't a letter, space, or basic name punctuation (periods, apostrophes,
// hyphens) as the user types, matching SupplierController's regex rule so
// the form never lets through something the backend would reject anyway.
const sanitizeContactPerson = (value: string) => value.replace(/[^\p{L}\s.'-]/gu, '');

export default function Suppliers({ suppliers: initialSuppliers }: SuppliersProps) {
    const [suppliers, setSuppliers] = useState(initialSuppliers);
    // Centered confirm() replacement, used for "delete this supplier?" below.
    const { confirm, confirmModalProps } = useConfirmModal();
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [loading, setLoading] = useState(false);

    // Close whichever supplier modal is open with the Escape key.
    useEffect(() => {
        if (!showAddModal && !showEditModal) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (showAddModal) setShowAddModal(false);
            else if (showEditModal) setShowEditModal(false);
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [showAddModal, showEditModal]);

    const [formData, setFormData] = useState({
        supplier_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        province: '',
        postal_code: '',
        payment_terms: 'Net 30',
        delivery_lead_time: '3-5 days',
        notes: '',
    });

    const filteredSuppliers = suppliers.filter(supplier => {
        const matchesSearch = supplier.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            supplier.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            supplier.supplier_code.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesFilter = filterStatus === 'all' || 
                            (filterStatus === 'active' && supplier.is_active) ||
                            (filterStatus === 'inactive' && !supplier.is_active);
        
        return matchesSearch && matchesFilter;
    });

    const resetForm = () => {
        setFormData({
            supplier_name: '',
            contact_person: '',
            phone: '',
            email: '',
            address: '',
            city: '',
            province: '',
            postal_code: '',
            payment_terms: 'Net 30',
            delivery_lead_time: '3-5 days',
            notes: '',
        });
    };

    const handleAddSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('/admin/suppliers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                setSuppliers([...suppliers, data.supplier]);
                setShowAddModal(false);
                resetForm();
                showToast('success', 'Supplier added.');
            } else {
                const firstError = data.errors ? (Object.values(data.errors)[0] as string[])?.[0] : null;
                alert(firstError || data.message || 'Error creating supplier');
            }
        } catch (error) {
            console.error('Error creating supplier:', error);
            alert('Error creating supplier');
        } finally {
            setLoading(false);
        }
    };

    const handleEditSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSupplier) return;

        setLoading(true);

        try {
            const response = await fetch(`/admin/suppliers/${editingSupplier.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...getCsrfHeaders(),
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                setSuppliers(suppliers.map(s => s.id === editingSupplier.id ? data.supplier : s));
                setShowEditModal(false);
                setEditingSupplier(null);
                resetForm();
                showToast('success', 'Supplier updated.');
            } else {
                const firstError = data.errors ? (Object.values(data.errors)[0] as string[])?.[0] : null;
                alert(firstError || data.message || 'Error updating supplier');
            }
        } catch (error) {
            console.error('Error updating supplier:', error);
            alert('Error updating supplier');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (supplier: Supplier) => {
        try {
            const response = await fetch(`/admin/suppliers/${supplier.id}/toggle-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getCsrfHeaders(),
                },
            });

            const data = await response.json();

            if (data.success) {
                setSuppliers(suppliers.map(s => s.id === supplier.id ? data.supplier : s));
                showToast('success', `Supplier marked ${data.supplier.is_active ? 'active' : 'inactive'}.`);
            } else {
                alert(data.message || 'Error updating supplier status');
            }
        } catch (error) {
            console.error('Error updating supplier status:', error);
            alert('Error updating supplier status');
        }
    };

    const handleDeleteSupplier = async (supplier: Supplier) => {
        if (!(await confirm({ message: `Are you sure you want to delete ${supplier.supplier_name}? This action cannot be undone.`, danger: true }))) {
            return;
        }

        try {
            const response = await fetch(`/admin/suppliers/${supplier.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...getCsrfHeaders(),
                },
            });

            const data = await response.json();

            if (data.success) {
                setSuppliers(suppliers.filter(s => s.id !== supplier.id));
                showToast('success', 'Supplier deleted.');
            } else {
                alert(data.message || 'Error deleting supplier');
            }
        } catch (error) {
            console.error('Error deleting supplier:', error);
            alert('Error deleting supplier');
        }
    };

    const openEditModal = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setFormData({
            supplier_name: supplier.supplier_name,
            contact_person: supplier.contact_person,
            phone: supplier.phone,
            email: supplier.email || '',
            address: supplier.address,
            city: supplier.city,
            province: supplier.province,
            postal_code: '',
            payment_terms: supplier.payment_terms,
            delivery_lead_time: supplier.delivery_lead_time,
            notes: '',
        });
        setShowEditModal(true);
    };

    return (
        <AppSidebarLayout breadcrumbs={breadcrumbs}>
            <Head title="Suppliers - Mejeck Ice Plant" />
            
            <div className="space-y-6 px-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Suppliers</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your supplier relationships and contacts</p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Supplier</span>
                    </button>
                </div>

                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search suppliers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilterStatus('all')}
                            className={`px-4 py-2 rounded-lg transition ${
                                filterStatus === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterStatus('active')}
                            className={`px-4 py-2 rounded-lg transition ${
                                filterStatus === 'active'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => setFilterStatus('inactive')}
                            className={`px-4 py-2 rounded-lg transition ${
                                filterStatus === 'inactive'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                        >
                            Inactive
                        </button>
                    </div>
                </div>

                {/* Suppliers Grid — a fixed 3-column grid reserved 2 whole empty columns'
                    worth of blank page whenever the list was short (even just 1 supplier).
                    auto-fit with a capped card width only creates as many columns as there
                    are suppliers to fill, so a short list just sits as a compact row instead
                    of stranding a lone card next to a huge dead expanse of white space. */}
                <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 340px))' }}>
                    {filteredSuppliers.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center text-center py-16 text-gray-500 dark:text-gray-400">
                            <Building2 className="w-10 h-10 mb-3 text-gray-300 dark:text-gray-600" />
                            <p className="font-medium">No suppliers found</p>
                            <p className="text-sm mt-1">
                                {filterStatus === 'all' ? 'Add your first supplier to get started.' : `No ${filterStatus} suppliers right now.`}
                            </p>
                        </div>
                    ) : filteredSuppliers.map((supplier) => (
                        <div
                            key={supplier.id}
                            onClick={() => openEditModal(supplier)}
                            className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 cursor-pointer"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                        <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white">{supplier.supplier_name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{supplier.supplier_code}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(supplier); }}
                                    title={supplier.is_active ? 'Active — click to mark inactive' : 'Inactive — click to mark active'}
                                    className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full shrink-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                >
                                    {supplier.is_active ? (
                                        <>
                                            <ToggleRight className="w-5 h-5 text-green-600" />
                                            <span className="text-xs font-medium text-green-600">Active</span>
                                        </>
                                    ) : (
                                        <>
                                            <ToggleLeft className="w-5 h-5 text-red-600" />
                                            <span className="text-xs font-medium text-red-600">Inactive</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <Phone className="w-4 h-4" />
                                    <span>{supplier.contact_person} - {supplier.phone}</span>
                                </div>
                                <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                                    <MapPin className="w-4 h-4 mt-0.5" />
                                    <span>{supplier.city}, {supplier.province}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <Clock className="w-4 h-4" />
                                    <span>{supplier.delivery_lead_time}</span>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-gray-400" />
                                        <span className="text-gray-600 dark:text-gray-400">
                                            {supplier.active_purchase_orders} active orders
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openEditModal(supplier); }}
                                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                        >
                                            <Edit className="w-4 h-4 text-blue-600" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteSupplier(supplier); }}
                                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add Supplier Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add New Supplier</h2>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleAddSupplier} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Supplier Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.supplier_name}
                                            onChange={(e) => setFormData({...formData, supplier_name: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Contact Person *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.contact_person}
                                            onChange={(e) => setFormData({...formData, contact_person: sanitizeContactPerson(e.target.value)})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Phone *
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={formData.phone}
                                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Address *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.address}
                                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            City *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.city}
                                            onChange={(e) => setFormData({...formData, city: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Province *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.province}
                                            onChange={(e) => setFormData({...formData, province: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Postal Code
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.postal_code}
                                            onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Payment Terms
                                        </label>
                                        <select
                                            value={formData.payment_terms}
                                            onChange={(e) => setFormData({...formData, payment_terms: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        >
                                            <option value="Net 15">Net 15</option>
                                            <option value="Net 30">Net 30</option>
                                            <option value="Net 45">Net 45</option>
                                            <option value="Net 60">Net 60</option>
                                            <option value="COD">COD</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Delivery Lead Time
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.delivery_lead_time}
                                            onChange={(e) => setFormData({...formData, delivery_lead_time: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Notes
                                    </label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                <div className="flex gap-3 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        {loading ? 'Creating...' : 'Create Supplier'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Supplier Modal */}
                {showEditModal && editingSupplier && (
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Supplier</h2>
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleEditSupplier} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Supplier Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.supplier_name}
                                            onChange={(e) => setFormData({...formData, supplier_name: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Contact Person *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.contact_person}
                                            onChange={(e) => setFormData({...formData, contact_person: sanitizeContactPerson(e.target.value)})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Phone *
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={formData.phone}
                                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Address *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.address}
                                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            City *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.city}
                                            onChange={(e) => setFormData({...formData, city: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Province *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.province}
                                            onChange={(e) => setFormData({...formData, province: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Postal Code
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.postal_code}
                                            onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Payment Terms
                                        </label>
                                        <select
                                            value={formData.payment_terms}
                                            onChange={(e) => setFormData({...formData, payment_terms: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        >
                                            <option value="Net 15">Net 15</option>
                                            <option value="Net 30">Net 30</option>
                                            <option value="Net 45">Net 45</option>
                                            <option value="Net 60">Net 60</option>
                                            <option value="COD">COD</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Delivery Lead Time
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.delivery_lead_time}
                                            onChange={(e) => setFormData({...formData, delivery_lead_time: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Notes
                                    </label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                <div className="flex gap-3 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        {loading ? 'Updating...' : 'Update Supplier'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmModal {...confirmModalProps} />
        </AppSidebarLayout>
    );
}
