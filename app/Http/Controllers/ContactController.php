<?php

namespace App\Http\Controllers;

use App\Mail\ContactFormMail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ContactController extends Controller
{
    /**
     * Handle a "Contact Us" submission from the public landing page and
     * forward it straight to the business inbox.
     */
    public function send(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'message' => ['required', 'string', 'max:5000'],
            // Honeypot field: left blank by real visitors, only bots fill it in.
            'website' => ['prohibited'],
        ]);

        $recipients = config('mail.contact_address');

        // With nothing configured the send would fail on a missing To header,
        // which reads as a mail outage in the log rather than what it is.
        if (empty($recipients)) {
            Log::error('Contact form has no recipient configured: MAIL_CONTACT_ADDRESS holds no valid address.');

            return back()
                ->withInput()
                ->with('error', 'Sorry, we could not send your message right now. Please try again later or call us instead.');
        }

        try {
            Mail::to($recipients)->send(new ContactFormMail(
                senderName: $validated['name'],
                senderEmail: $validated['email'],
                senderPhone: $validated['phone'] ?? null,
                messageBody: $validated['message'],
            ));
        } catch (\Throwable $e) {
            Log::error('Contact form email failed to send: ' . $e->getMessage());

            return back()
                ->withInput()
                ->with('error', 'Sorry, we could not send your message right now. Please try again later or call us instead.');
        }

        return back()->with('success', 'Thank you! Your message has been sent. We will get back to you shortly.');
    }
}
