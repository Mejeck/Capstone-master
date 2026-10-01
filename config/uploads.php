<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Maximum upload size
    |--------------------------------------------------------------------------
    |
    | Vercel refuses a request body larger than 4.5 MB before it reaches PHP,
    | so anything above that never arrives and the visitor is shown a platform
    | error page instead of the app's own message. The rules below were set to
    | 5 MB, 10 MB and 100 MB, which meant the app promised sizes the host was
    | never going to deliver.
    |
    | Four megabytes leaves room for the rest of the multipart body — the
    | field names, the CSRF token, the boundaries — so a file right at the
    | limit still fits inside what Vercel will accept.
    |
    | Kept in kilobytes because that is the unit Laravel's "max:" rule takes.
    | resources/js/lib/uploads.ts holds the same figure for the forms; change
    | both together.
    |
    */

    'max_kilobytes' => (int) env('UPLOAD_MAX_KILOBYTES', 4096),

];
