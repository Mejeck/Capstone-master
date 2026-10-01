/**
 * The largest file a form may accept, matching config/uploads.php.
 *
 * The ceiling is the host's, not ours: Vercel rejects a request body over
 * 4.5 MB before PHP ever sees it, so a form that accepts more only sends the
 * visitor into a platform error page. Four megabytes leaves room for the rest
 * of the multipart body.
 *
 * Checking it here as well as on the server is not belt and braces — it is
 * the only check the visitor can actually be shown, since an oversized body
 * never reaches the server's own rule.
 */
export const MAX_UPLOAD_MB = 4;

export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** "max 4MB", for placing next to a file input. */
export const MAX_UPLOAD_LABEL = `max ${MAX_UPLOAD_MB}MB`;

export function isWithinUploadLimit(file: File): boolean {
    return file.size <= MAX_UPLOAD_BYTES;
}
