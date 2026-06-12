'use client';

import { Sidebar } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

interface AppShellProps {
    children: React.ReactNode;
    userStats?: {
        streak: number;
        xp: number;
        level: number;
    };
    isLoggedIn?: boolean;
    displayName?: string;
    displayInitial?: string;
}

export function AppShell({ 
    children, 
    userStats, 
    isLoggedIn, 
    displayName, 
    displayInitial 
}: AppShellProps) {
    const pathname = usePathname();
    const fullBleedRoutes = [
        '/problems/',
        '/review',
        '/history',
        '/contests/',
        '/flashcards',
    ];
    const isFullBleed = fullBleedRoutes.some((route) => pathname.startsWith(route));

    return (
        <div className="min-h-screen bg-background">
            {/* Desktop Sidebar - Only if logged in */}
            {isLoggedIn && (
                <div className="hidden md:block">
                    <Sidebar />
                </div>
            )}

            {/* Main Content Area */}
            <div className={cn(
                "flex flex-col min-h-screen transition-[padding]",
                isLoggedIn && "md:pl-64"
            )}>
                <Header 
                    userStats={userStats}
                    isLoggedIn={isLoggedIn}
                    displayName={displayName}
                    displayInitial={displayInitial}
                />
                <main className={cn(
                    "flex-1 w-full animate-in fade-in duration-500",
                    isFullBleed ? "p-0" : "p-6 lg:p-8 max-w-7xl mx-auto"
                )}>
                    {children}
                </main>
            </div>
        </div>
    );
}
