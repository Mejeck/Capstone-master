import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import ServerErrorScreen from '@/components/ServerErrorScreen';

/**
 * Catches the one case bootstrap/app.php's exception renderable cannot:
 * a response that never went through Laravel's own exception handling at
 * all — a dropped connection, Vercel's platform crash page, or anything
 * else that hands Inertia a body it can't read as a valid Inertia response.
 *
 * Inertia's own default behaviour for that is to open the raw response in a
 * grey pop-up (a full stack trace locally, a bare "500 Server Error" page on
 * Vercel). This intercepts that, for server errors only, and shows the same
 * screen the server-rendered case uses — reusing ServerErrorScreen, not a
 * second copy of the same message.
 *
 * No reference ID and no role-specific redirect here, deliberately: nothing
 * in the app ever ran to generate one, and guessing a role's dashboard path
 * client-side would risk sending someone at a URL that needs the very
 * database query that may be what's down. Home is the one destination safe
 * for every role and for a visitor who isn't signed in at all.
 *
 * Mounted once at the app root (app.tsx), the same way FlashToaster and
 * WelcomeBackModal are — not tied to any one page's lifecycle.
 */
export default function GlobalErrorOverlay() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        return router.on('invalid', (event) => {
            const status = event.detail.response?.status;

            // A non-5xx "invalid" response (e.g. a redirect to somewhere
            // outside the SPA) is not a failure to apologise for — leave
            // Inertia's own handling of it alone.
            if (!status || status < 500) {
                return;
            }

            event.preventDefault();
            setVisible(true);
        });
    }, []);

    if (!visible) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm overflow-y-auto">
            <ServerErrorScreen reference={null} signedIn={false} redirectUrl="/" />
        </div>
    );
}
