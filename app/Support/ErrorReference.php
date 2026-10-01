<?php

namespace App\Support;

class ErrorReference
{
    /**
     * A short code to show on a server-error page and quote in its log line,
     * so a customer reporting "it broke" can be matched to the exact log
     * entry without needing a timestamp or a description of what they did.
     *
     * Built from an alphabet that drops 0/O/1/I/L — the characters people
     * misread or mistype when reading a code off a screen and typing it into
     * an email or a chat message.
     */
    public static function generate(): string
    {
        $alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
        $code = '';

        for ($i = 0; $i < 6; $i++) {
            $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return 'ERR-' . $code;
    }
}
