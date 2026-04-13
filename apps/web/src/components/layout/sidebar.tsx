'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    Code2,
    BookOpen,
    Trophy,
    LayoutDashboard,
    History,
    FileInput,
    Swords,
    BarChart3
} from 'lucide-react';

const sidebarItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Subjects', href: '/subjects', icon: BookOpen },
    { label: 'Problems', href: '/problems', icon: Code2 },
    { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    { label: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    { label: 'Contests', href: '/contests', icon: Swords },
    { label: 'Review', href: '/review', icon: History },
    { label: 'Imports', href: '/imports', icon: FileInput },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
            <div className="flex h-16 items-center px-6 border-b border-border">
                <Link href="/" className="flex items-center gap-2">
                    <div className="rounded-lg bg-indigo-600 p-1.5">
                        <Code2 className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-foreground">GrindUp</span>
                </Link>
            </div>

            <div className="flex flex-col gap-1 p-4">
                {sidebarItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-secondary text-secondary-foreground"
                                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                            )}
                        >
                            <item.icon className={cn("h-4 w-4", isActive ? "text-indigo-500" : "text-muted-foreground")} />
                            {item.label}
                        </Link>
                    );
                })}
            </div>
        </aside>
    );
}
