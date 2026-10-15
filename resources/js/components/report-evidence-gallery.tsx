import { Eye, Video } from 'lucide-react';
import { storageUrl } from '@/lib/storage-url';

export interface ReportEvidenceFile {
    id: number;
    file_path: string;
    file_type: 'image' | 'video';
    original_name: string;
    file_size: number;
}

interface ReportEvidenceGalleryProps {
    evidence: ReportEvidenceFile[];
    onOpen: (file: ReportEvidenceFile) => void;
}

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Large previews of a report's photos and videos, so the evidence can be read
// at a glance; clicking one still opens it full size.
export default function ReportEvidenceGallery({ evidence, onOpen }: ReportEvidenceGalleryProps) {
    if (evidence.length === 0) {
        return <p className="text-sm text-gray-500 dark:text-gray-400">No evidence files.</p>;
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {evidence.map((file) => {
                const url = storageUrl(file.file_path) ?? '';
                return (
                    <button
                        key={file.id}
                        type="button"
                        onClick={() => onOpen(file)}
                        className="group text-left border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden hover:border-blue-400 transition-colors"
                        title="Click to view full size"
                    >
                        <div className="relative bg-gray-100 dark:bg-gray-900">
                            {file.file_type === 'image' ? (
                                <img src={url} alt={file.original_name} className="w-full h-64 object-cover" />
                            ) : (
                                <video src={url} className="w-full h-64 object-cover" muted preload="metadata" />
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                                {file.file_type === 'image' ? (
                                    <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                                ) : (
                                    <Video className="w-8 h-8 text-white drop-shadow" />
                                )}
                            </span>
                        </div>
                        <div className="px-3 py-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.original_name}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                {file.file_type === 'image' ? 'Image' : 'Video'} · {formatFileSize(file.file_size)}
                            </p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
