<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Mailer
    |--------------------------------------------------------------------------
    |
    | This option controls the default mailer that is used to send all email
    | messages unless another mailer is explicitly specified when sending
    | the message. All additional mailers can be configured within the
    | "mailers" array. Examples of each type of mailer are provided.
    |
    */

    'default' => env('MAIL_MAILER', 'log'),

    /*
    |--------------------------------------------------------------------------
    | Contact Us Recipient
    |--------------------------------------------------------------------------
    |
    | The inbox that public "Contact Us" form submissions from the landing
    | page are forwarded to.
    |
    */

    // One or more inboxes, separated by commas in MAIL_CONTACT_ADDRESS.
    // Anything that is not a well-formed address is dropped rather than
    // passed on: Symfony Mailer throws on a malformed recipient before it
    // sends anything, so a single typo would otherwise stop the message
    // reaching the addresses that were spelled correctly.
    'contact_address' => array_values(array_filter(
        array_map('trim', explode(
            ',',
            // A variable that is present but blank makes env() return '' and
            // never reach its default, which is how this ended up with no
            // recipient at all and every message failing to send. Fall back
            // on emptiness, not just on absence.
            trim((string) env('MAIL_CONTACT_ADDRESS'))
                ?: 'harrismanabat3@gmail.com,yorforger069@gmail.com'
        )),
        fn (string $address) => filter_var($address, FILTER_VALIDATE_EMAIL) !== false,
    )),

    /*
    |--------------------------------------------------------------------------
    | Mailer Configurations
    |--------------------------------------------------------------------------
    |
    | Here you may configure all of the mailers used by your application plus
    | their respective settings. Several examples have been configured for
    | you and you are free to add your own as your application requires.
    |
    | Laravel supports a variety of mail "transport" drivers that can be used
    | when delivering an email. You may specify which one you're using for
    | your mailers below. You may also add additional mailers if needed.
    |
    | Supported: "smtp", "sendmail", "mailgun", "ses", "ses-v2",
    |            "postmark", "resend", "log", "array",
    |            "failover", "roundrobin"
    |
    */

    'mailers' => [

        'smtp' => [
            'transport' => 'smtp',
            'url' => env('MAIL_URL'),
            'host' => env('MAIL_HOST', '127.0.0.1'),
            'port' => env('MAIL_PORT', 2525),
            'encryption' => env('MAIL_ENCRYPTION', 'tls'),
            'username' => env('MAIL_USERNAME'),
            'password' => env('MAIL_PASSWORD'),
            // Was null (no timeout): SendPasswordResetOtp is a queued
            // notification, and when the Gmail SMTP connection stalls
            // (slow handshake, network hiccup), the worker blocks
            // indefinitely — queue:listen's 60s watchdog then kills the
            // whole worker process with an uncaught ProcessTimedOutException
            // instead of the job just failing/retrying cleanly.
            'timeout' => env('MAIL_TIMEOUT', 30),
            'local_domain' => env('MAIL_EHLO_DOMAIN', parse_url(env('APP_URL', 'http://localhost'), PHP_URL_HOST)),
        ],

        'ses' => [
            'transport' => 'ses',
        ],

        'postmark' => [
            'transport' => 'postmark',
            // 'message_stream_id' => env('POSTMARK_MESSAGE_STREAM_ID'),
            // 'client' => [
            //     'timeout' => 5,
            // ],
        ],

        'resend' => [
            'transport' => 'resend',
        ],

        'sendmail' => [
            'transport' => 'sendmail',
            'path' => env('MAIL_SENDMAIL_PATH', '/usr/sbin/sendmail -bs -i'),
        ],

        'log' => [
            'transport' => 'log',
            'channel' => env('MAIL_LOG_CHANNEL'),
        ],

        'array' => [
            'transport' => 'array',
        ],

        'failover' => [
            'transport' => 'failover',
            'mailers' => [
                'smtp',
                'log',
            ],
        ],

        'roundrobin' => [
            'transport' => 'roundrobin',
            'mailers' => [
                'ses',
                'postmark',
            ],
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Global "From" Address
    |--------------------------------------------------------------------------
    |
    | You may wish for all emails sent by your application to be sent from
    | the same address. Here you may specify a name and address that is
    | used globally for all emails that are sent by your application.
    |
    */

    'from' => [
        'address' => env('MAIL_FROM_ADDRESS', 'hello@example.com'),
        'name' => env('MAIL_FROM_NAME', 'Example'),
    ],

];
