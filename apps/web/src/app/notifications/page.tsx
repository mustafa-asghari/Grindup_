'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell, Clock, CheckCircle2, AlertCircle, BookOpen, ChevronRight,
    Loader2, UserPlus, MessageCircle, Swords, Users, Filter
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationItem {
    id: string;
    type: 'homework' | 'friend_request' | 'message' | 'challenge' | 'challenge_result';
    title: string;
    description: string | null;
    createdAt: string;
    isRead: boolean;
    actionUrl: string;
    metadata?: {
        senderId?: string;
        senderName?: string;
        senderImage?: string | null;
        xpReward?: number;
        xpStake?: number;
        challengeType?: string;
        dueDate?: string;
        isOverdue?: boolean;
    };
}

interface NotificationData {
    notifications: NotificationItem[];
    count: number;
    unreadCount: number;
    friendRequestCount: number;
    messageCount: number;
    challengeCount: number;
    homeworkCount: number;
    overdueHomeworkCount: number;
}

type FilterType = 'all' | 'friend_request' | 'message' | 'challenge' | 'homework';

export default function NotificationsPage() {
    const [data, setData] = useState<NotificationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const router = useRouter();

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const res = await fetch('/api/notifications');
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (err) {
                console.error('Failed to fetch notifications:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    // Check for filter from URL on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const urlFilter = params.get('filter');
            if (urlFilter && ['all', 'friend_request', 'message', 'challenge', 'homework'].includes(urlFilter)) {
                setFilter(urlFilter as FilterType);
            }
        }
    }, []);

    const handleNotificationClick = async (notification: NotificationItem) => {
        // Mark message-type notifications as read
        if (notification.type === 'message' && !notification.isRead) {
            try {
                await fetch('/api/notifications', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        notificationIds: [notification.id],
                        type: notification.type
                    })
                });
            } catch (e) {
                console.error('Failed to mark as read:', e);
            }
        }
        router.push(notification.actionUrl);
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'friend_request':
                return <UserPlus className="w-5 h-5 text-blue-400" />;
            case 'message':
                return <MessageCircle className="w-5 h-5 text-green-400" />;
            case 'challenge':
            case 'challenge_result':
                return <Swords className="w-5 h-5 text-purple-400" />;
            case 'homework':
                return <BookOpen className="w-5 h-5 text-yellow-400" />;
            default:
                return <Bell className="w-5 h-5 text-gray-400" />;
        }
    };

    const getNotificationColor = (type: string, isOverdue?: boolean) => {
        if (isOverdue) return 'border-red-500/30 bg-red-950/20';
        switch (type) {
            case 'friend_request':
                return 'border-blue-500/30 bg-blue-950/20';
            case 'message':
                return 'border-green-500/30 bg-green-950/20';
            case 'challenge':
            case 'challenge_result':
                return 'border-purple-500/30 bg-purple-950/20';
            case 'homework':
                return 'border-yellow-500/30 bg-yellow-950/20';
            default:
                return 'border-gray-800';
        }
    };

    const filteredNotifications = data?.notifications.filter(n =>
        filter === 'all' ||
        n.type === filter ||
        (filter === 'challenge' && n.type === 'challenge_result')
    ) || [];

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Bell className="w-8 h-8 text-blue-500" />
                        <h1 className="text-3xl font-bold">Notifications</h1>
                        {data && data.unreadCount > 0 && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-sm font-bold rounded-full">
                                {data.unreadCount}
                            </span>
                        )}
                    </div>
                    <p className="text-gray-400">Friend requests, messages, challenges, and homework</p>
                </div>

                {/* Summary Stats */}
                {data && data.count > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <UserPlus className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{data.friendRequestCount}</div>
                                    <div className="text-sm text-gray-400">Friend Requests</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-500/10 rounded-lg">
                                    <MessageCircle className="w-5 h-5 text-green-500" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{data.messageCount}</div>
                                    <div className="text-sm text-gray-400">Unread Messages</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                    <Swords className="w-5 h-5 text-purple-500" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{data.challengeCount}</div>
                                    <div className="text-sm text-gray-400">Challenges</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-yellow-500/10 rounded-lg">
                                    <BookOpen className="w-5 h-5 text-yellow-500" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{data.homeworkCount}</div>
                                    <div className="text-sm text-gray-400">Homework</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                    {[
                        { key: 'all', label: 'All', icon: Bell },
                        { key: 'friend_request', label: 'Requests', icon: UserPlus },
                        { key: 'message', label: 'Messages', icon: MessageCircle },
                        { key: 'challenge', label: 'Challenges', icon: Swords },
                        { key: 'homework', label: 'Homework', icon: BookOpen },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key as FilterType)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filter === tab.key
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Notifications List */}
                <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                        {filteredNotifications.length > 0 ? (
                            filteredNotifications.map((notification, index) => (
                                <motion.div
                                    key={notification.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ delay: index * 0.03 }}
                                    layout
                                >
                                    <button
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`w-full text-left bg-gray-900 border rounded-xl p-5 hover:border-blue-500 transition-all group ${getNotificationColor(notification.type, notification.metadata?.isOverdue)
                                            }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* Icon or Avatar */}
                                            <div className="flex-shrink-0">
                                                {notification.metadata?.senderImage ? (
                                                    <img
                                                        src={notification.metadata.senderImage}
                                                        alt=""
                                                        className="w-12 h-12 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                                                        {getNotificationIcon(notification.type)}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                {/* Type Badge */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full uppercase ${notification.type === 'friend_request' ? 'bg-blue-500/20 text-blue-400' :
                                                        notification.type === 'message' ? 'bg-green-500/20 text-green-400' :
                                                            (notification.type === 'challenge' || notification.type === 'challenge_result') ? 'bg-purple-500/20 text-purple-400' :
                                                                notification.metadata?.isOverdue ? 'bg-red-500/20 text-red-400' :
                                                                    'bg-yellow-500/20 text-yellow-400'
                                                        }`}>
                                                        {notification.type === 'friend_request' ? 'Friend Request' :
                                                            notification.type === 'message' ? 'Message' :
                                                                notification.type === 'challenge' ? 'Challenge' :
                                                                    notification.type === 'challenge_result' ? 'Challenge Result' :
                                                                        notification.metadata?.isOverdue ? 'Overdue' : 'Due Soon'}
                                                    </span>
                                                    {notification.metadata?.xpStake && (
                                                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-semibold rounded-full">
                                                            {notification.metadata.xpStake} XP at stake
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Title */}
                                                <h3 className="font-bold text-white mb-1 group-hover:text-blue-400 transition-colors truncate">
                                                    {notification.title}
                                                </h3>

                                                {/* Description */}
                                                {notification.description && (
                                                    <p className="text-gray-400 text-sm mb-2 line-clamp-2">
                                                        {notification.description}
                                                    </p>
                                                )}

                                                {/* Timestamp */}
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                                    {notification.metadata?.dueDate && (
                                                        <>
                                                            <span className="mx-1">•</span>
                                                            <span className={notification.metadata.isOverdue ? 'text-red-400' : ''}>
                                                                Due {formatDistanceToNow(new Date(notification.metadata.dueDate), { addSuffix: true })}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Arrow */}
                                            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                                        </div>
                                    </button>
                                </motion.div>
                            ))
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-20"
                            >
                                <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">All caught up!</h3>
                                <p className="text-gray-400">
                                    {filter === 'all'
                                        ? "You don't have any notifications right now."
                                        : `No ${filter.replace('_', ' ')} notifications.`}
                                </p>
                                <Link
                                    href="/"
                                    className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 transition-colors"
                                >
                                    Back to Dashboard
                                </Link>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
