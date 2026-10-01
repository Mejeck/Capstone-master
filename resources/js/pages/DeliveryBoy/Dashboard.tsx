import { Head, Link, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { ArrowLeft, Package, MapPin, CheckCircle, Clock, Truck, User, Phone, AlertCircle, Navigation, Settings, Camera, Upload, AlertTriangle, X, FileText } from 'lucide-react';
import AppearanceToggleDropdown from '@/components/appearance-dropdown';
import ConfirmModal from '@/components/ConfirmModal';
import { useConfirmModal } from '@/hooks/useConfirmModal';
import { showToast } from '@/lib/toast';
import { MAX_UPLOAD_MB, isWithinUploadLimit } from '@/lib/uploads';

interface OrderItem {
    order_item_id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
    subtotal: number;
    product: {
        product_id: number;
        product_name: string;
    };
}

interface Customer {
    customer_id: number;
    first_name: string;
    last_name: string;
    phone?: string;
}

interface UserInfo {
    id: number;
    full_name: string;
    email: string;
}

interface Order {
    order_id: number;
    customer_id: number | null;
    user_id: number;
    order_date: string;
    total_amount: number;
    status: string;
    payment_method: string;
    payment_status: string;
    delivery_address: string;
    delivery_barangay: string;
    delivery_purok: string;
    delivery_city: string;
    delivery_province: string;
    delivery_postal_code: string;
    delivery_latitude: number | null;
    delivery_longitude: number | null;
    customer: Customer | null;
    user: UserInfo | null;
    order_items: OrderItem[] | null;
}

interface Delivery {
    delivery_id: number;
    order_id: number;
    rider_id: number;
    assigned_by: number;
    assigned_date: string;
    delivery_status: string;
    actual_delivery_date: string | null;
    collected_amount: number | null;
    customer_notes: string | null;
    rider_notes: string | null;
    proof_of_delivery: string | null;
    order: Order;
}

export default function DeliveryBoyDashboard() {
    const [activeTab, setActiveTab] = useState<'assigned' | 'completed'>('assigned');
    const [assignedOrders, setAssignedOrders] = useState<Delivery[]>([]);
    const [completedDeliveries, setCompletedDeliveries] = useState<Delivery[]>([]);
    const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
    const [loading, setLoading] = useState(false);
    // Centered confirm() replacement, used for the delivery-status update prompt.
    const { confirm, confirmModalProps } = useConfirmModal();
    const [statusForm, setStatusForm] = useState({
        delivery_status: '',
        collected_amount: '',
        rider_notes: '',
    });
    const [showMapModal, setShowMapModal] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [deliveryPhotos, setDeliveryPhotos] = useState<File[]>([]);
    const [deliveryIssues, setDeliveryIssues] = useState<string[]>([]);
    const [issueDetails, setIssueDetails] = useState('');
    const [showPhotoUpload, setShowPhotoUpload] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    // Close whichever modal is open with the Escape key. The Map modal takes
    // priority since it renders on top of (and is opened together with)
    // Delivery Details when "View Map" is clicked from the deliveries list.
    useEffect(() => {
        if (!selectedDelivery && !showMapModal) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (showMapModal) {
                setShowMapModal(false);
                setCurrentLocation(null);
            } else if (selectedDelivery) {
                setSelectedDelivery(null);
                setStatusForm({ delivery_status: '', collected_amount: '', rider_notes: '' });
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [selectedDelivery, showMapModal]);

    useEffect(() => {
        fetchAssignedOrders();
        fetchCompletedDeliveries();

        // Load Leaflet CSS and JS
        const loadLeaflet = () => {
            if (!document.querySelector('link[href*="leaflet"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
                document.head.appendChild(link);
            }
            if (!document.querySelector('script[src*="leaflet"]')) {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
                script.async = true;
                document.head.appendChild(script);
            }
        };
        loadLeaflet();
    }, []);

    const fetchAssignedOrders = async () => {
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const response = await fetch('/delivery-boy/api/assigned-orders', {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || '',
                },
            });
            if (response.ok) {
                const data = await response.json();
                // Handle both old format (array) and new format (object with deliveries key)
                const orders = Array.isArray(data) ? data : (data.deliveries || []);
                setAssignedOrders(orders);
                // Log debug info if available
                if (data.debug) {
                    console.log('Assigned Orders Debug:', data.debug);
                }
            }
        } catch (error) {
            console.error('Error fetching assigned orders:', error);
        }
    };

    const fetchCompletedDeliveries = async () => {
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const response = await fetch('/delivery-boy/api/completed-deliveries', {
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || '',
                },
            });
            if (response.ok) {
                const data = await response.json();
                setCompletedDeliveries(data);
            }
        } catch (error) {
            console.error('Error fetching completed deliveries:', error);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        const droppedFiles = Array.from(e.dataTransfer.files);
        handleFiles(droppedFiles);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFiles(Array.from(e.target.files));
        }
    };

    const handleFiles = (newFiles: File[]) => {
        const validFiles = newFiles.filter(file => {
            const isValidType = file.type.startsWith('image/');
            const isValidSize = isWithinUploadLimit(file);
            return isValidType && isValidSize;
        });

        if (validFiles.length !== newFiles.length) {
            alert(`Some files were rejected. Only images (JPEG, PNG) up to ${MAX_UPLOAD_MB}MB are allowed.`);
        }

        setDeliveryPhotos(prev => [...prev, ...validFiles]);
    };

    const removePhoto = (index: number) => {
        const newPhotos = deliveryPhotos.filter((_, i) => i !== index);
        setDeliveryPhotos(newPhotos);
    };

    const toggleIssue = (issue: string) => {
        setDeliveryIssues(prev => 
            prev.includes(issue) 
                ? prev.filter(i => i !== issue)
                : [...prev, issue]
        );
    };

    const updateDeliveryStatus = async (deliveryId: number, targetStatus?: string) => {
        const newStatus = targetStatus ?? statusForm.delivery_status;
        if (!newStatus) {
            alert('Please select a delivery status');
            return;
        }

        // Blocking validations before submission
        if (newStatus === 'Delivered' && deliveryPhotos.length === 0) {
            alert('Please upload at least one delivery photo as proof of delivery.');
            return;
        }

        if (
            newStatus === 'Delivered' &&
            selectedDelivery &&
            parseFloat(statusForm.collected_amount || '0') < (selectedDelivery.order?.total_amount || 0)
        ) {
            alert(`Collected amount must be at least ₱${Number(selectedDelivery.order?.total_amount || 0).toFixed(2)}.`);
            return;
        }

        if (!(await confirm(`Are you sure you want to update delivery status to "${newStatus}"?`))) return;

        setLoading(true);
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

            const formData = new FormData();
            formData.append('delivery_status', newStatus);
            if (statusForm.collected_amount) formData.append('collected_amount', statusForm.collected_amount);
            if (statusForm.rider_notes) formData.append('rider_notes', statusForm.rider_notes);
            deliveryPhotos.forEach((photo, i) => formData.append(`photos[${i}]`, photo));
            if (deliveryIssues.length > 0) {
                deliveryIssues.forEach((issue, i) => formData.append(`delivery_issues[${i}]`, issue));
                if (issueDetails) formData.append('issue_details', issueDetails);
            }

            const response = await fetch(`/delivery-boy/api/deliveries/${deliveryId}/status`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token || '',
                },
                body: formData,
            });

            if (response.ok) {
                fetchAssignedOrders();
                fetchCompletedDeliveries();
                setSelectedDelivery(null);
                setStatusForm({ delivery_status: '', collected_amount: '', rider_notes: '' });
                setDeliveryPhotos([]);
                setDeliveryIssues([]);
                setIssueDetails('');
                setShowPhotoUpload(false);
                showToast('success', `Delivery status updated to "${newStatus}".`);
            } else if (response.status === 419 || response.status === 401) {
                // Session expired (or CSRF token went stale from sitting on this
                // page too long) — the server response here is Laravel's own
                // {"message": "..."} shape, not this endpoint's {"error": "..."}
                // shape, so it was falling through to a useless generic alert.
                alert('Your session has expired. Please refresh the page and log in again, then retry.');
            } else {
                const error = await response.json();
                if (error.messages) {
                    // Show detailed validation errors
                    const errorMessages = Object.values(error.messages).flat();
                    alert(`Validation Error:\n${errorMessages.join('\n')}`);
                } else {
                    alert(error.error || error.message || 'Failed to update delivery status');
                }
            }
        } catch (error) {
            console.error('Error updating delivery status:', error);
            alert('Failed to update delivery status. Please check your internet connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    const openNavigation = (latitude: number | null, longitude: number | null, address: string) => {
        if (latitude && longitude) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`, '_blank');
        } else {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
        }
    };

    const openMapModal = async (delivery: Delivery) => {
        setSelectedDelivery(delivery);
        setShowMapModal(true);

        // Set business location as default starting point for deliveries
        // Business Address: Lacuna St. Pob. 2 Penaranda, Nueva Ecija
        const businessLocation = {
            lat: 15.4471, // Approximate coordinates for Penaranda, Nueva Ecija
            lng: 120.8287
        };

        // Try to get current location, but fallback to business location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // Use current location if available, but business location is the starting point
                    setCurrentLocation(businessLocation);
                    console.log('Using business location as starting point:', businessLocation);
                },
                (error) => {
                    console.error('Error getting location:', error);
                    // Fallback to business location
                    setCurrentLocation(businessLocation);
                    console.log('Using business location as fallback:', businessLocation);
                }
            );
        } else {
            // Use business location as default
            setCurrentLocation(businessLocation);
            console.log('Using business location as default:', businessLocation);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200';
            case 'Out for Delivery': return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200';
            case 'Delivered': return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200';
            case 'Failed': return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200';
            case 'Cancelled': return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200';
            default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200';
        }
    };

    const renderDeliveryCard = (delivery: Delivery) => (
        <div
            key={delivery.delivery_id}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden"
            onClick={() => setSelectedDelivery(delivery)}
        >
            {/* Card top accent bar */}
            <div className={`h-1 w-full ${
                delivery.delivery_status === 'Delivered' ? 'bg-emerald-400' :
                delivery.delivery_status === 'Out for Delivery' ? 'bg-cyan-400' :
                delivery.delivery_status === 'Failed' ? 'bg-red-400' :
                'bg-amber-400'
            }`} />

            <div className="p-5">
                {/* Header row */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Order #{delivery.order?.order_id || 'Unknown'}</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {delivery.assigned_date ? new Date(delivery.assigned_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date'}
                        </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${getStatusColor(delivery.delivery_status)}`}>
                        {delivery.delivery_status}
                    </span>
                </div>

                {/* Info rows */}
                <div className="space-y-2.5 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <div className="w-7 h-7 rounded-full bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <span className="font-medium truncate">
                            {delivery.order?.customer
                                ? `${delivery.order.customer.first_name} ${delivery.order.customer.last_name}`
                                : delivery.order?.user?.full_name || 'Unknown Customer'}
                        </span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <div className="w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center shrink-0 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                        </div>
                        <div className="flex-1 leading-snug">
                            <p>{delivery.order?.delivery_address || 'No address provided'}</p>
                            {delivery.order?.delivery_barangay && <p>Brgy. {delivery.order.delivery_barangay}{delivery.order?.delivery_purok ? `, Purok ${delivery.order.delivery_purok}` : ''}</p>}
                            <p className="text-gray-400 dark:text-gray-500">{[delivery.order?.delivery_city, delivery.order?.delivery_province].filter(Boolean).join(', ')}</p>
                        </div>
                    </div>
                </div>

                {/* Amount + items row */}
                <div className="flex items-center justify-between py-3 border-t border-gray-100 dark:border-slate-700 mb-4">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                        <Package className="w-4 h-4" />
                        <span>{delivery.order?.order_items?.length || 0} item(s)</span>
                    </div>
                    <div className="text-right">
                        <p className="text-base font-bold text-gray-900 dark:text-white">₱{Number(delivery.order?.total_amount || 0).toFixed(2)}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{delivery.order?.payment_method || 'Unknown'}</p>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); openMapModal(delivery); }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-semibold transition-colors"
                    >
                        <MapPin className="w-3.5 h-3.5" />
                        View Map
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openNavigation(
                                delivery.order?.delivery_latitude,
                                delivery.order?.delivery_longitude,
                                `${delivery.order?.delivery_address || ''}, ${delivery.order?.delivery_city || ''}, ${delivery.order?.delivery_province || ''}`
                            );
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-xs font-semibold transition-colors"
                    >
                        <Navigation className="w-3.5 h-3.5" />
                        Navigate
                    </button>
                </div>
            </div>
        </div>
    );

    const renderDeliveryModal = () => {
        if (!selectedDelivery) return null;

        return (
            <div className="fixed inset-0 bg-white/30 dark:bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Delivery Details #{selectedDelivery.order?.order_id || 'Unknown'}</h2>
                            <button
                                onClick={() => {
                                    setSelectedDelivery(null);
                                    setStatusForm({ delivery_status: '', collected_amount: '', rider_notes: '' });
                                }}
                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors group"
                            >
                                <X className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Delivery Info */}
                            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Delivery Information</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Status:</span>
                                        <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedDelivery.delivery_status)}`}>
                                            {selectedDelivery.delivery_status}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600 dark:text-gray-400">Assigned:</span>
                                        <span className="ml-2 text-gray-900 dark:text-white">
                                            {new Date(selectedDelivery.assigned_date).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Customer Info */}
                            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Customer Information</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center text-gray-600 dark:text-gray-300">
                                        <User className="w-4 h-4 mr-2" />
                                        {selectedDelivery.order?.customer ? (
                                            <>{selectedDelivery.order.customer.first_name} {selectedDelivery.order.customer.last_name}</>
                                        ) : (
                                            <>{selectedDelivery.order?.user?.full_name || 'Unknown Customer'}</>
                                        )}
                                    </div>
                                    {selectedDelivery.order?.customer?.phone && (
                                        <div className="flex items-center text-gray-600 dark:text-gray-300">
                                            <Phone className="w-4 h-4 mr-2" />
                                            {selectedDelivery.order.customer.phone}
                                        </div>
                                    )}
                                    <div className="flex items-start text-gray-600 dark:text-gray-300">
                                        <MapPin className="w-4 h-4 mr-2 mt-0.5" />
                                        <div className="flex-1">
                                            <p>{selectedDelivery.order?.delivery_address || 'No address provided'}</p>
                                            <p>{selectedDelivery.order?.delivery_city || ''}, {selectedDelivery.order?.delivery_province || ''} {selectedDelivery.order?.delivery_postal_code || ''}</p>
                                            {selectedDelivery.order?.delivery_latitude && selectedDelivery.order?.delivery_longitude && (
                                                <p className="text-xs text-cyan-600 dark:text-cyan-400">
                                                    Lat: {Number(selectedDelivery.order.delivery_latitude).toFixed(6)}, Lng: {Number(selectedDelivery.order.delivery_longitude).toFixed(6)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => openNavigation(
                                            selectedDelivery.order?.delivery_latitude,
                                            selectedDelivery.order?.delivery_longitude,
                                            `${selectedDelivery.order?.delivery_address || ''}, ${selectedDelivery.order?.delivery_city || ''}, ${selectedDelivery.order?.delivery_province || ''}`
                                        )}
                                        className="flex items-center text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 text-sm font-medium mt-2"
                                    >
                                        <Navigation className="w-4 h-4 mr-2" />
                                        Open in Google Maps
                                    </button>
                                </div>
                            </div>
                            {/* Order Items */}
                            {selectedDelivery.order?.order_items && selectedDelivery.order.order_items.length > 0 && (
                                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <Package className="w-4 h-4" />
                                        Order Items
                                    </h3>
                                    <div className="divide-y divide-gray-200 dark:divide-slate-600">
                                        {selectedDelivery.order.order_items.map((item, i) => (
                                            <div key={i} className="flex items-center justify-between py-2 text-sm">
                                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                                    {item.product?.product_name || 'Unknown Product'}
                                                </span>
                                                <span className="text-gray-500 dark:text-gray-400 ml-4 shrink-0">
                                                    x{item.quantity}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center border-t border-gray-200 dark:border-slate-600 pt-2 mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                        <span>Total</span>
                                        <span className="text-cyan-600 dark:text-cyan-400">₱{Number(selectedDelivery.order?.total_amount || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            {/* Update Status */}
                            {selectedDelivery.delivery_status === 'Pending' && (
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Start Delivery</h3>
                                    <button
                                        onClick={() => updateDeliveryStatus(selectedDelivery.delivery_id, 'Out for Delivery')}
                                        disabled={loading}
                                        className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Truck className="w-5 h-5" />
                                        {loading ? 'Updating...' : 'Start Delivery'}
                                    </button>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                                        Tap to confirm you have picked up the order and are heading to the customer.
                                    </p>
                                </div>
                            )}

                            {selectedDelivery.delivery_status === 'Out for Delivery' && (
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Confirm Delivery</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Collected Amount (₱)
                                            </label>
                                            <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                                                Order Total: <span className="font-bold text-cyan-600 dark:text-cyan-400">₱{Number(selectedDelivery.order?.total_amount || 0).toFixed(2)}</span>
                                            </div>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={statusForm.collected_amount}
                                                onKeyDown={(e) => {
                                                    // Allow: backspace, delete, tab, arrows, decimal point
                                                    const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','.'];
                                                    if (allowed.includes(e.key)) return;
                                                    // Block anything that is not a digit
                                                    if (!/^\d$/.test(e.key)) e.preventDefault();
                                                }}
                                                onChange={(e) => {
                                                    let val = e.target.value;
                                                    // Remove non-numeric except one decimal point
                                                    val = val.replace(/[^\d.]/g, '');
                                                    // Only one decimal point
                                                    const parts = val.split('.');
                                                    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                                                    // Cannot start with 0 (e.g. "0123" → blocked; "0." is fine for decimals)
                                                    if (/^0\d/.test(val)) val = val.replace(/^0+/, '');
                                                    setStatusForm(prev => ({ ...prev, collected_amount: val }));
                                                }}
                                                placeholder={`Minimum: ₱${Number(selectedDelivery.order?.total_amount || 0).toFixed(2)}`}
                                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                            />
                                            {statusForm.collected_amount && parseFloat(statusForm.collected_amount) < (selectedDelivery.order?.total_amount || 0) && (
                                                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                                    Collected amount cannot be less than order total
                                                </p>
                                            )}
                                            {statusForm.collected_amount && parseFloat(statusForm.collected_amount) > (selectedDelivery.order?.total_amount || 0) && (
                                                <div className="mt-2 flex items-center justify-between px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                                                    <span className="text-sm font-medium text-green-700 dark:text-green-300">Sukli (Change):</span>
                                                    <span className="text-sm font-bold text-green-700 dark:text-green-300">
                                                        ₱{(parseFloat(statusForm.collected_amount) - (selectedDelivery.order?.total_amount || 0)).toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Photo Upload Section */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Delivery Photos <span className="text-red-500">*</span>
                                            </label>
                                            <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                                                Upload photos as proof of successful delivery
                                            </div>

                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                onChange={handleFileInput}
                                                className="hidden"
                                                id="delivery-photo-upload"
                                            />

                                            <div
                                                className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                                                    dragActive
                                                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                                                        : deliveryPhotos.length > 0
                                                            ? 'border-cyan-400 dark:border-cyan-600'
                                                            : 'border-gray-300 dark:border-gray-600'
                                                }`}
                                                onDragEnter={handleDrag}
                                                onDragLeave={handleDrag}
                                                onDragOver={handleDrag}
                                                onDrop={handleDrop}
                                            >
                                                {deliveryPhotos.length === 0 ? (
                                                    <label htmlFor="delivery-photo-upload" className="flex flex-col items-center cursor-pointer text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                                                        <Upload className="w-8 h-8 mb-2" />
                                                        <span className="text-sm">Drag and drop photos here, or <span className="text-cyan-600 dark:text-cyan-400 underline">click to select</span></span>
                                                    </label>
                                                ) : (
                                                    <div>
                                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                                            {deliveryPhotos.map((photo, index) => (
                                                                <div key={index} className="relative group">
                                                                    <img
                                                                        src={URL.createObjectURL(photo)}
                                                                        alt={`Delivery photo ${index + 1}`}
                                                                        className="w-full h-28 object-cover rounded-lg"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removePhoto(index)}
                                                                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <label
                                                            htmlFor="delivery-photo-upload"
                                                            className="flex items-center justify-center gap-2 w-full py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer transition-colors"
                                                        >
                                                            <Camera className="w-4 h-4" />
                                                            Add more photos
                                                        </label>
                                                    </div>
                                                )}
                                            </div>

                                            {deliveryPhotos.length === 0 && (
                                                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                                                    At least one photo is required to confirm delivery
                                                </p>
                                            )}
                                        </div>

                                        {(() => {
                                            const amountInsufficient = !statusForm.collected_amount || parseFloat(statusForm.collected_amount) < (selectedDelivery.order?.total_amount || 0);
                                            const noPhoto = deliveryPhotos.length === 0;
                                            const isDisabled = loading || amountInsufficient || noPhoto;
                                            return (
                                                <button
                                                    onClick={() => updateDeliveryStatus(selectedDelivery.delivery_id, 'Delivered')}
                                                    disabled={isDisabled}
                                                    title={amountInsufficient ? 'Collected amount must meet the order total' : noPhoto ? 'Upload at least one delivery photo' : ''}
                                                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle className="w-5 h-5" />
                                                    {loading ? 'Updating...' : 'Mark as Delivered'}
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {selectedDelivery.delivery_status === 'Delivered' && (
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                                    <div className="flex items-center text-green-600 dark:text-green-400">
                                        <CheckCircle className="w-5 h-5 mr-2" />
                                        <span className="font-medium">Delivery Completed</span>
                                    </div>
                                    {selectedDelivery.actual_delivery_date && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                            Completed on: {new Date(selectedDelivery.actual_delivery_date).toLocaleString()}
                                        </p>
                                    )}
                                    {selectedDelivery.collected_amount && (
                                        <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                            <div className="flex justify-between">
                                                <span>Order Total:</span>
                                                <span className="font-medium">₱{Number(selectedDelivery.order?.total_amount || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Collected:</span>
                                                <span className="font-medium">₱{Number(selectedDelivery.collected_amount).toFixed(2)}</span>
                                            </div>
                                            {Number(selectedDelivery.collected_amount) > Number(selectedDelivery.order?.total_amount || 0) && (
                                                <div className="flex justify-between border-t border-green-200 dark:border-green-700 pt-1 mt-1">
                                                    <span className="font-semibold text-green-700 dark:text-green-300">Sukli (Change):</span>
                                                    <span className="font-bold text-green-700 dark:text-green-300">
                                                        ₱{(Number(selectedDelivery.collected_amount) - Number(selectedDelivery.order?.total_amount || 0)).toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {selectedDelivery.proof_of_delivery && (() => {
                                        const photos = typeof selectedDelivery.proof_of_delivery === 'string'
                                            ? JSON.parse(selectedDelivery.proof_of_delivery)
                                            : selectedDelivery.proof_of_delivery;
                                        return photos && photos.length > 0 ? (
                                            <div className="mt-3">
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Proof of Delivery:</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {photos.map((path: string, i: number) => (
                                                        <a
                                                            key={i}
                                                            href={`/storage/${path}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            // overflow-hidden on a fixed-size wrapper (rather than
                                                            // relying on the <img>'s own h-24/object-cover) keeps the
                                                            // thumbnail boxed in even if the source photo is huge or
                                                            // an unusual aspect ratio.
                                                            className="block h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700"
                                                        >
                                                            <img
                                                                src={`/storage/${path}`}
                                                                alt={`Proof ${i + 1}`}
                                                                className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                                                            />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null;
                                    })()}
                                </div>
                            )}

                            {selectedDelivery.delivery_status === 'Cancelled' && (
                                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                                        <AlertCircle className="w-5 h-5 mr-2" />
                                        <span className="font-medium">Delivery Cancelled</span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                        This delivery has been cancelled. The order has been returned to Processing status for reassignment.
                                    </p>
                                    {selectedDelivery.rider_notes && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            Notes: {selectedDelivery.rider_notes}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderMapModal = () => {
        if (!showMapModal || !selectedDelivery) return null;

        return (
            <div className="fixed inset-0 bg-white/30 dark:bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Delivery Map</h2>
                            <button
                                onClick={() => {
                                    setShowMapModal(false);
                                    setCurrentLocation(null);
                                }}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <AlertCircle className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Your Current Location</h3>
                                {currentLocation ? (
                                    <p className="text-sm text-blue-600 dark:text-blue-400">
                                        Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
                                    </p>
                                ) : (
                                    <p className="text-sm text-blue-600 dark:text-blue-400">Getting your location...</p>
                                )}
                            </div>

                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                                <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">Customer Location</h3>
                                <p className="text-sm text-green-600 dark:text-green-400">
                                    {selectedDelivery.order?.delivery_address || 'No address provided'}, {selectedDelivery.order?.delivery_city || ''}, {selectedDelivery.order?.delivery_province || ''}
                                </p>
                                {selectedDelivery.order?.delivery_latitude && selectedDelivery.order?.delivery_longitude && (
                                    <p className="text-sm text-green-600 dark:text-green-400">
                                        Lat: {Number(selectedDelivery.order.delivery_latitude).toFixed(6)}, Lng: {Number(selectedDelivery.order.delivery_longitude).toFixed(6)}
                                    </p>
                                )}
                            </div>

                            <div id="map" className="h-96 rounded-lg border border-gray-300 dark:border-gray-600"></div>

                            <button
                                onClick={() => {
                                    if (currentLocation && selectedDelivery.order?.delivery_latitude && selectedDelivery.order?.delivery_longitude) {
                                        window.open(
                                            `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${selectedDelivery.order?.delivery_latitude},${selectedDelivery.order?.delivery_longitude}`,
                                            '_blank'
                                        );
                                    } else {
                                        alert('Please wait for location data to load');
                                    }
                                }}
                                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all flex items-center justify-center"
                            >
                                <Navigation className="w-5 h-5 mr-2" />
                                Open in Google Maps
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    useEffect(() => {
        if (showMapModal && currentLocation && selectedDelivery && selectedDelivery.order?.delivery_latitude && selectedDelivery.order?.delivery_longitude) {
            // Wait for Leaflet to be available
            const initializeMap = () => {
                const L = (window as any).L;
                if (!L) {
                    console.error('Leaflet not loaded, retrying...');
                    setTimeout(initializeMap, 500);
                    return;
                }

                // Remove existing map if any
                const existingMap = (window as any).deliveryMap;
                if (existingMap) {
                    existingMap.remove();
                }

                // Ensure map container exists and is empty
                const mapContainer = document.getElementById('map');
                if (!mapContainer) {
                    console.error('Map container not found');
                    return;
                }
                mapContainer.innerHTML = '';

                try {
                    // Create map
                    const map = L.map('map').setView([currentLocation.lat, currentLocation.lng], 13);

                    // Add tile layer
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors',
                        maxZoom: 19
                    }).addTo(map);

                    // Add business location marker (starting point)
                    const businessIcon = L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style="background-color: #dc2626; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                    });

                    L.marker([currentLocation.lat, currentLocation.lng], { icon: businessIcon })
                        .addTo(map)
                        .bindPopup('<strong>Business Location<br/>Lacuna St. Pob. 2 Penaranda, Nueva Ecija<br/>Starting Point</strong>')
                        .openPopup();

                    // Add customer location marker
                    const customerIcon = L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style="background-color: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });

                    L.marker([Number(selectedDelivery.order?.delivery_latitude), Number(selectedDelivery.order?.delivery_longitude)], { icon: customerIcon })
                        .addTo(map)
                        .bindPopup(`<strong>${selectedDelivery.order?.delivery_address || 'Customer Location'}</strong>`);

                    // Draw line between points
                    const polyline = L.polyline([
                        [currentLocation.lat, currentLocation.lng],
                        [Number(selectedDelivery.order?.delivery_latitude), Number(selectedDelivery.order?.delivery_longitude)]
                    ], {
                        color: '#3b82f6',
                        weight: 3,
                        opacity: 0.7,
                        dashArray: '10, 10'
                    }).addTo(map);

                    // Fit map to show both points
                    const bounds = L.latLngBounds([
                        [currentLocation.lat, currentLocation.lng],
                        [Number(selectedDelivery.order?.delivery_latitude), Number(selectedDelivery.order?.delivery_longitude)]
                    ]);
                    map.fitBounds(bounds, { padding: [50, 50] });

                    // Store map instance
                    (window as any).deliveryMap = map;
                } catch (error) {
                    console.error('Error initializing map:', error);
                }
            };

            // Initialize map with a small delay to ensure DOM is ready
            setTimeout(initializeMap, 100);
        }
    }, [showMapModal, currentLocation, selectedDelivery]);

    return (
        <div className="min-h-screen w-full overflow-x-hidden bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
            <Head title="Delivery Boy Dashboard - Mejeck Ice Plant" />

            {/* Header */}
            <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-gray-200 dark:border-slate-700 transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo + Title */}
                        <div className="flex items-center gap-3">
                            <img
                                src="/images/LOGO.jpg"
                                alt="Mejeck Ice Plant"
                                className="w-9 h-9 rounded-lg object-cover shadow-sm"
                            />
                            <div className="flex flex-col leading-tight">
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:block">Mejeck Ice Plant</span>
                                <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">Delivery Dashboard</span>
                            </div>
                        </div>

                        {/* Right actions */}
                        <div className="flex items-center gap-1 sm:gap-3">
                            <AppearanceToggleDropdown />
                            <Link
                                href={route('delivery-boy.settings')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all text-sm font-medium"
                            >
                                <Settings className="w-4 h-4" />
                                <span className="hidden sm:inline">Settings</span>
                            </Link>
                            <Link
                                href="/logout"
                                method="post"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all text-sm font-medium"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Logout</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Tabs */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 mb-6 p-2">
                    <div className="flex w-full gap-2">
                        <button
                            onClick={() => setActiveTab('assigned')}
                            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-3 py-3 sm:py-5 rounded-xl font-bold transition-all text-xs sm:text-base ${
                                activeTab === 'assigned'
                                    ? 'bg-cyan-500 text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            <Truck className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />
                            <span>Assigned</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                                activeTab === 'assigned'
                                    ? 'bg-white/30 text-white'
                                    : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300'
                            }`}>{assignedOrders.length}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('completed')}
                            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-3 py-3 sm:py-5 rounded-xl font-bold transition-all text-xs sm:text-base ${
                                activeTab === 'completed'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 shrink-0" />
                            <span>Completed</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                                activeTab === 'completed'
                                    ? 'bg-white/30 text-white'
                                    : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300'
                            }`}>{completedDeliveries.length}</span>
                        </button>
                    </div>
                </div>

                {/* Deliveries */}
                {activeTab === 'assigned' && assignedOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                        <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                            <Truck className="w-9 h-9 text-gray-300 dark:text-gray-600" />
                        </div>
                        <p className="text-base font-medium text-gray-500 dark:text-gray-400">No assigned orders</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">New deliveries will appear here</p>
                    </div>
                )}

                {activeTab === 'assigned' && assignedOrders.length > 0 && (
                    <div className="space-y-8">
                        {/* Split into Pending vs Out for Delivery so the two statuses
                            don't visually blend into one undifferentiated grid. */}
                        {([
                            { status: 'Pending', label: 'Pending', dotColor: 'bg-yellow-400' },
                            { status: 'Out for Delivery', label: 'Out for Delivery', dotColor: 'bg-cyan-400' },
                        ] as const).map(({ status, label, dotColor }) => {
                            const deliveries = assignedOrders.filter((d) => d.delivery_status === status);
                            if (deliveries.length === 0) return null;

                            return (
                                <div key={status}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</h3>
                                        <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400">
                                            {deliveries.length}
                                        </span>
                                        <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {deliveries.map((delivery) => renderDeliveryCard(delivery))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'completed' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {completedDeliveries.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                                <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                    <CheckCircle className="w-9 h-9 text-gray-300 dark:text-gray-600" />
                                </div>
                                <p className="text-base font-medium text-gray-500 dark:text-gray-400">No completed deliveries</p>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Finished deliveries will appear here</p>
                            </div>
                        )}
                        {completedDeliveries.map((delivery) => renderDeliveryCard(delivery))}
                    </div>
                )}
            </div>

            {/* Delivery Modal */}
            {renderDeliveryModal()}

            {/* Map Modal */}
            {renderMapModal()}

            <ConfirmModal {...confirmModalProps} />
        </div>
    );
}
