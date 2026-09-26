import { Link } from '@inertiajs/react';
import { ReactNode } from 'react';

interface AuthLayoutProps {
    children: React.ReactNode;
    name?: string;
    title?: string;
    description?: string;
    backButton?: ReactNode;
}

export default function AuthSimpleLayout({ children, title, backButton }: AuthLayoutProps) {
    return (
        <div className="min-h-svh flex flex-col items-center justify-center relative overflow-x-hidden overflow-y-auto bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-cyan-200/30 to-blue-300/30 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-200/30 to-indigo-300/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-cyan-100/20 to-blue-200/20 rounded-full blur-3xl animate-pulse delay-500"></div>
            </div>

            {/* Floating ice crystals */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-20 left-10 w-4 h-4 bg-white/60 rounded-full animate-bounce delay-300"></div>
                <div className="absolute top-40 right-20 w-3 h-3 bg-cyan-200/60 rounded-full animate-bounce delay-700"></div>
                <div className="absolute bottom-32 left-32 w-2 h-2 bg-blue-200/60 rounded-full animate-bounce delay-1000"></div>
                <div className="absolute bottom-20 right-10 w-3 h-3 bg-white/50 rounded-full animate-bounce delay-500"></div>
                <div className="absolute top-60 left-1/2 w-2 h-2 bg-cyan-300/60 rounded-full animate-bounce delay-800"></div>
            </div>

            <div className="relative z-10 flex max-h-svh w-full max-w-md mx-auto flex-col p-6">
                <div className="min-h-0 overflow-y-auto bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/20 p-8">
                    <div className="flex flex-col gap-8">
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex items-center justify-between w-full">
                                {backButton && (
                                    <div className="flex-shrink-0">
                                        {backButton}
                                    </div>
                                )}
                                <Link href={route('home')} className="flex flex-col items-center gap-3 group flex-1">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full overflow-hidden bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900 dark:to-blue-900 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                                        <img src="/images/LOGO.jpg" alt="Mejeck Ice Plant Logo" className="h-full w-full object-cover" />
                                    </div>
                                    <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
                                        Mejeck IcePlant
                                    </h2>
                                </Link>
                                {backButton && <div className="flex-shrink-0 w-20"></div>}
                            </div>

                            <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 text-center">{title}</h1>
                        </div>
                        
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl blur-xl"></div>
                            <div className="relative">
                                {children}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 text-center mt-6 text-slate-500 dark:text-slate-400 text-xs">
                    <p>© {new Date().getFullYear()} Mejeck IcePlant. Delivering quality ice solutions.</p>
                </div>
            </div>
        </div>
    );
}
