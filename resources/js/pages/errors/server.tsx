import { Head } from '@inertiajs/react';
import ServerErrorScreen, { type ServerErrorDebugInfo } from '@/components/ServerErrorScreen';

interface ServerErrorPageProps {
    reference: string;
    signedIn: boolean;
    redirectUrl: string | null;
    debug?: ServerErrorDebugInfo | null;
}

/**
 * Rendered directly by bootstrap/app.php's exception renderable — this is
 * the page Laravel returns in place of the controller that threw, for any
 * 500/502/503/504 or uncaught exception. See ServerErrorScreen for why this
 * one component covers both a full page load and a client-side visit.
 */
export default function ServerError({ reference, signedIn, redirectUrl, debug }: ServerErrorPageProps) {
    return (
        <>
            <Head title="Something went wrong" />
            <ServerErrorScreen reference={reference} signedIn={signedIn} redirectUrl={redirectUrl} debug={debug} />
        </>
    );
}
