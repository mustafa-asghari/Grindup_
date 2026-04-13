'use client';

import { Sidebar } from './sidebar';
import { Header } from './header';
import { cn } from '@/lib/utils';

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
                <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
                    {children}
                </main>
            </div>
        </div>
    );
}
