
'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    User,
    Settings,
    LogOut,
    ChevronDown,
    Flame,
    Zap,
    Trophy,
    Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';

interface HeaderProps {
    user?: {
        name: string;
        email: string;
    };
    userStats?: {
        streak: number;
        xp: number;
        level: number;
    };
    isLoggedIn?: boolean;
    displayName?: string;
    displayInitial?: string;
}

export function Header({ user, userStats, isLoggedIn, displayName, displayInitial }: HeaderProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [notificationCount, setNotificationCount] = useState(0);
    const [hasUnread, setHasUnread] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    // Fetch notification count
    useEffect(() => {
        if (!isLoggedIn) return;

        const fetchNotifications = async () => {
            try {
                const res = await fetch('/api/notifications');
                if (res.ok) {
                    const data = await res.json();
                    // Use unreadCount for the badge (friend requests + messages + challenges)
                    const unread = (data.friendRequestCount || 0) + (data.messageCount || 0) + (data.challengeCount || 0);
                    setNotificationCount(unread);
                    setHasUnread(unread > 0);
                }
            } catch (err) {
                console.error('Failed to fetch notifications:', err);
            }
        };

        fetchNotifications();
        // Refresh every 15 seconds for more responsive notifications
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, [isLoggedIn]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const finalDisplayName = displayName || user?.name || 'User';
    const finalDisplayInitial = displayInitial || finalDisplayName[0]?.toUpperCase() || 'U';
    const displayEmail = user?.email || '';
    const safeUserStats = userStats || { streak: 0, xp: 0, level: 0 };

    const handleSignOut = async () => {
        await signOut({ callbackUrl: '/signin' });
    };

    return (
        <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-between px-4">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 text-xl font-bold text-foreground hover:opacity-80 transition-opacity">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 text-white font-bold text-sm">
                        G
                    </div>
                    <span className="hidden md:inline">GrindUp</span>
                </Link>

                {/* Right Section */}
                <div className="flex items-center gap-3">
                    {isLoggedIn ? (
                        <>
                            {/* Stats */}
                            <div className="hidden lg:flex items-center gap-2 rounded-full border border-border bg-secondary/50 overflow-hidden">
                                <div className="flex items-center gap-1.5 px-3 py-1 border-r border-border">
                                    <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500/20" />
                                    <span className="text-sm font-medium text-muted-foreground">{safeUserStats.streak}</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1">
                                    <Zap className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500/20" />
                                    <span className="text-sm font-medium text-muted-foreground">{safeUserStats.xp}</span>
                                </div>
                            </div>

                            {/* Social Hub */}
                            <Link href="/social">
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                                    <Users className="h-4 w-4" />
                                </Button>
                            </Link>

                            {/* Notifications */}
                            <Link href="/notifications">
                                <Button variant="ghost" size="icon" className={`h-9 w-9 text-muted-foreground hover:text-foreground relative ${hasUnread ? 'text-red-400' : ''}`}>
                                    <Bell className={`h-4 w-4 ${hasUnread ? 'animate-pulse' : ''}`} />
                                    {notificationCount > 0 && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white border-2 border-background animate-pulse"
                                        >
                                            {notificationCount > 9 ? '9+' : notificationCount}
                                        </motion.div>
                                    )}
                                </Button>
                            </Link>

                            {/* User Dropdown */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 pl-1 pr-3 py-1 hover:bg-secondary transition-colors"
                                >
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                                        {finalDisplayInitial}
                                    </div>
                                    <span className="text-sm font-medium text-foreground max-w-[100px] truncate hidden md:block">
                                        {finalDisplayName}
                                    </span>
                                    <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", isDropdownOpen && "rotate-180")} />
                                </button>
                                <AnimatePresence>
                                    {isDropdownOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-background shadow-lg overflow-hidden"
                                        >
                                            <div className="px-4 py-3 border-b border-border">
                                                <p className="text-sm font-medium text-foreground">{finalDisplayName}</p>
                                                <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                                            </div>
                                            <div className="p-1">
                                                <Link
                                                    href="/profile"
                                                    onClick={() => setIsDropdownOpen(false)}
                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-md transition-colors"
                                                >
                                                    <User className="h-4 w-4" />
                                                    Profile
                                                </Link>
                                                <Link
                                                    href="/settings"
                                                    onClick={() => setIsDropdownOpen(false)}
                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary rounded-md transition-colors"
                                                >
                                                    <Settings className="h-4 w-4" />
                                                    Settings
                                                </Link>
                                            </div>
                                            <div className="border-t border-border p-1">
                                                <button
                                                    onClick={handleSignOut}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors"
                                                >
                                                    <LogOut className="h-4 w-4" />
                                                    Sign Out
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-4">
                            <Link href="/login">
                                <Button variant="default" size="sm">Sign In</Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}