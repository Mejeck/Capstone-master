interface DeliveryNotesProps {
    landmark?: string | null;
    remarks?: string | null;
    className?: string;
}

// The customer's landmark and free-text remarks for a delivery order, shown
// wherever the address is shown so the rider and staff see the same notes.
export default function DeliveryNotes({ landmark, remarks, className = '' }: DeliveryNotesProps) {
    if (!landmark && !remarks) return null;
    return (
        <div className={`space-y-0.5 text-sm text-gray-600 dark:text-gray-300 ${className}`}>
            {landmark && (
                <p><span className="font-medium text-gray-700 dark:text-gray-200">Landmark:</span> {landmark}</p>
            )}
            {remarks && (
                <p className="whitespace-pre-wrap"><span className="font-medium text-gray-700 dark:text-gray-200">Remarks:</span> {remarks}</p>
            )}
        </div>
    );
}
