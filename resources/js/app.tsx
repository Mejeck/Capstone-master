import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';
import FlashToaster from './components/flash-toaster';
import WelcomeBackModal from './components/welcome-back-modal';
import GlobalErrorOverlay from './components/GlobalErrorOverlay';

declare global {
    const route: (name: string, params?: any, absolute?: boolean) => string;
}

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    // Some pages already bake the app name into their own <Head title="...">
    // (e.g. "Login - Mejeck IcePlant"); appending it again here duplicated it
    // in the browser tab. Only append when the page title doesn't already
    // include it, so both styles of page title end up correct.
    title: (title) => (title.includes(appName) ? title : `${title} - ${appName}`),
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);
        const initialFlash = (props.initialPage.props as { flash?: { success?: string | null; error?: string | null; welcomeUser?: string | null } }).flash;

        root.render(
            <>
                <App {...props} />
                <FlashToaster initialFlash={initialFlash} />
                <WelcomeBackModal initialFlash={initialFlash} />
                <GlobalErrorOverlay />
            </>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
