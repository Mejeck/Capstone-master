import React, { useEffect, useState } from 'react';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { 
    ArrowLeft, 
    Upload, 
    X, 
    Camera, 
    Video, 
    AlertCircle,
    CheckCircle,
    FileText,
    User,
    Package,
    Truck,
    AlertTriangle,
    Clock
} from 'lucide-react';
import CustomerNav from '@/components/CustomerNav';
import { MAX_UPLOAD_MB, isWithinUploadLimit } from '@/lib/uploads';

interface Order {
    order_id: number;
    order_date: string;
    total_amount: number;
    status: string;
    items: Array<{
        product_name: string;
        quantity: number;
        unit_price: number;
    }>;
}

interface CreateReportProps {
    order: Order;
    defaultType?: string;
}

export default function CreateReport({ order, defaultType = '' }: CreateReportProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [previewUrls, setPreviewUrls] = useState<(string | null)[]>([]);

    // Object URLs are only good for previewing images in the browser and
    // leak memory if never released, so rebuild + revoke them whenever the
    // file list changes rather than keeping the old ones around.
    useEffect(() => {
        const urls = files.map((file) => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null));
        setPreviewUrls(urls);

        return () => {
            urls.forEach((url) => url && URL.revokeObjectURL(url));
        };
    }, [files]);
    const { data, setData, post, processing, errors, reset } = useForm({
        order_id: order.order_id,
        description: '',
        report_type: defaultType,
        delivery_boy_name: '',
        delivery_boy_issue_details: '',
        evidence: [] as File[],
    });

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
            const isValidType = file.type.startsWith('image/') || file.type.startsWith('video/');
            const isValidSize = isWithinUploadLimit(file);
            return isValidType && isValidSize;
        });

        if (validFiles.length !== newFiles.length) {
            alert(`Some files were rejected. Only images (JPEG, PNG) and videos (MP4, MOV, AVI) up to ${MAX_UPLOAD_MB}MB are allowed.`);
        }

        setFiles(prev => [...prev, ...validFiles]);
        setData('evidence', [...files, ...validFiles]);
    };

    const removeFile = (index: number) => {
        const newFiles = files.filter((_, i) => i !== index);
        setFiles(newFiles);
        setData('evidence', newFiles);
    };

    const validateForm = () => {
        if (!data.report_type) {
            alert('Please select a report type.');
            return false;
        }
        
        if (!data.description.trim()) {
            alert('Please provide a description of the issue.');
            return false;
        }
        
        if (data.description.length < 10) {
            alert('Description must be at least 10 characters long.');
            return false;
        }
        
        if (files.length === 0) {
            alert('Please upload at least one image or video as evidence.');
            return false;
        }
        
        // Check if any video is less than 10 seconds (basic validation)
        const videos = files.filter(file => file.type.startsWith('video/'));
        if (videos.length > 0) {
            alert('Please ensure videos are 10-30 seconds long for proper evidence.');
        }
        
        return true;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        const formData = new FormData();
        formData.append('order_id', data.order_id.toString());
        formData.append('description', data.description);
        formData.append('report_type', data.report_type);
        formData.append('delivery_boy_name', data.delivery_boy_name);
        formData.append('delivery_boy_issue_details', data.delivery_boy_issue_details);
        
        files.forEach((file, index) => {
            formData.append(`evidence[${index}]`, file);
        });

        router.post(route('customer.reports.store'), formData, {
            forceFormData: true,
            // No manual showToast — the backend already flashes 'success'
            // with its own message, picked up automatically by FlashToaster
            // from this same Inertia visit (this redirects to the reports list).
            onSuccess: () => {
                reset();
                setFiles([]);
            },
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
            <Head title="Create Report" />
            <CustomerNav currentPage="reports" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
                <div className="mb-8">
                    <Link
                        href={route('customer.reports')}
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Reports
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Report Delivery Issue</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Report problems with your delivered order - wrong products, delivery issues, or damaged items
                    </p>
                </div>

                {/* Order Information */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Order Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Order Number</p>
                            <p className="font-medium text-gray-900 dark:text-white">#{order.order_id}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Order Date</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {new Date(order.order_date).toLocaleDateString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                                ₱{Number(order.total_amount).toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                            <p className="font-medium text-green-600 dark:text-green-400">Delivered</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Report Type Selection */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">What type of issue are you reporting? *</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="relative cursor-pointer">
                                <input
                                    type="radio"
                                    name="report_type"
                                    value="damaged_beverages"
                                    checked={data.report_type === 'damaged_beverages'}
                                    onChange={(e) => setData('report_type', e.target.value)}
                                    className="peer sr-only"
                                    required
                                />
                                <div className="p-4 border-2 rounded-lg peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20 peer-checked:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="w-6 h-6 text-red-500" />
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">Damaged Beverages</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Products were damaged during delivery</p>
                                        </div>
                                    </div>
                                </div>
                            </label>

                            <label className="relative cursor-pointer">
                                <input
                                    type="radio"
                                    name="report_type"
                                    value="wrong_product"
                                    checked={data.report_type === 'wrong_product'}
                                    onChange={(e) => setData('report_type', e.target.value)}
                                    className="peer sr-only"
                                />
                                <div className="p-4 border-2 rounded-lg peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20 peer-checked:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Package className="w-6 h-6 text-orange-500" />
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">Wrong Product</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Received different items than ordered</p>
                                        </div>
                                    </div>
                                </div>
                            </label>

                            <label className="relative cursor-pointer">
                                <input
                                    type="radio"
                                    name="report_type"
                                    value="delivery_boy_issue"
                                    checked={data.report_type === 'delivery_boy_issue'}
                                    onChange={(e) => setData('report_type', e.target.value)}
                                    className="peer sr-only"
                                />
                                <div className="p-4 border-2 rounded-lg peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20 peer-checked:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Truck className="w-6 h-6 text-purple-500" />
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">Delivery Boy Issue</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Problems with delivery service</p>
                                        </div>
                                    </div>
                                </div>
                            </label>

                            <label className="relative cursor-pointer">
                                <input
                                    type="radio"
                                    name="report_type"
                                    value="other"
                                    checked={data.report_type === 'other'}
                                    onChange={(e) => setData('report_type', e.target.value)}
                                    className="peer sr-only"
                                />
                                <div className="p-4 border-2 rounded-lg peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20 peer-checked:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <AlertCircle className="w-6 h-6 text-gray-500" />
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">Other Issue</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Other delivery-related problems</p>
                                        </div>
                                    </div>
                                </div>
                            </label>
                        </div>
                        {errors.report_type && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.report_type}</p>
                        )}
                    </div>

                    {/* Delivery Boy Information - Only show if delivery boy issue is selected */}
                    {data.report_type === 'delivery_boy_issue' && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delivery Boy Information</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Delivery Boy Name
                                    </label>
                                    <input
                                        type="text"
                                        value={data.delivery_boy_name}
                                        onChange={(e) => setData('delivery_boy_name', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        placeholder="Enter delivery boy's name (if known)"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Delivery Boy Issue Details
                                    </label>
                                    <textarea
                                        value={data.delivery_boy_issue_details}
                                        onChange={(e) => setData('delivery_boy_issue_details', e.target.value)}
                                        rows={4}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        placeholder="Describe the issue with the delivery boy (attitude, behavior, timing, etc.)"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Issue Description */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Issue Description *</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Please describe the issue in detail *
                            </label>
                            <textarea
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                rows={6}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                placeholder={
                                    data.report_type === 'damaged_beverages' 
                                        ? "Describe which products were damaged, how many, and the extent of damage..."
                                        : data.report_type === 'wrong_product'
                                        ? "Describe which products were wrong, what you received instead, and any other details..."
                                        : data.report_type === 'delivery_boy_issue'
                                        ? "Describe the delivery boy's behavior, timing, communication, or other service issues..."
                                        : "Describe the issue with your delivery in detail..."
                                }
                                required
                            />
                            {errors.description && (
                                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
                            )}
                        </div>
                    </div>

                    {/* Evidence Upload */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Evidence Upload *</h2>
                        
                        <div className="mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <AlertCircle className="w-4 h-4" />
                                <span>Please upload at least one image or video (10-30 seconds) as proof</span>
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Accepted formats: JPEG, PNG, MP4, MOV, AVI (Max {MAX_UPLOAD_MB}MB per file)
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Videos should be 10-30 seconds long to clearly show the issue
                            </div>
                        </div>

                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                dragActive
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-300 dark:border-gray-600'
                            }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            {files.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-left">
                                        Uploaded Files ({files.length})
                                    </h3>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                        {files.map((file, index) => (
                                            <div
                                                key={index}
                                                className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                                                title={`${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`}
                                            >
                                                {previewUrls[index] ? (
                                                    <img
                                                        src={previewUrls[index] as string}
                                                        alt={file.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1 text-gray-500 dark:text-gray-400">
                                                        <Video className="w-6 h-6" />
                                                        <span className="text-[10px] leading-tight text-center truncate w-full">{file.name}</span>
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(index)}
                                                    className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Upload className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                            <p className="text-gray-600 dark:text-gray-400 mb-2">
                                Drag and drop files here, or click to select
                            </p>
                            <input
                                type="file"
                                multiple
                                accept="image/*,video/*"
                                onChange={handleFileInput}
                                className="hidden"
                                id="file-upload"
                            />
                            <label
                                htmlFor="file-upload"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                                <Camera className="w-4 h-4" />
                                Select Files
                            </label>
                        </div>

                        {errors.evidence && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.evidence}</p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <FileText className="w-4 h-4" />
                                    Submit Report
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
