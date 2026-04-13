import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export interface NotificationItem {
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

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const now = new Date();
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

        const notifications: NotificationItem[] = [];

        // 1. Pending Friend Requests (received)
        const pendingFriendRequests = await prisma.friendship.findMany({
            where: {
                addresseeId: userId,
                status: 'pending'
            },
            include: {
                requester: {
                    select: { id: true, name: true, username: true, image: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        for (const fr of pendingFriendRequests) {
            notifications.push({
                id: fr.id,
                type: 'friend_request',
                title: `${fr.requester.name || fr.requester.username || 'Someone'} sent you a friend request`,
                description: 'Tap to accept or decline',
                createdAt: fr.createdAt.toISOString(),
                isRead: false,
                actionUrl: '/social?tab=requests',
                metadata: {
                    senderId: fr.requester.id,
                    senderName: fr.requester.name || fr.requester.username || 'Unknown',
                    senderImage: fr.requester.image
                }
            });
        }

        // 2. Unread Messages
        const unreadMessages = await prisma.directMessage.findMany({
            where: {
                receiverId: userId,
                isRead: false
            },
            include: {
                sender: {
                    select: { id: true, name: true, username: true, image: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 20 // Limit to most recent 20
        });

        // Group messages by sender
        const messageBySender = new Map<string, { count: number; latest: typeof unreadMessages[0] }>();
        for (const msg of unreadMessages) {
            const existing = messageBySender.get(msg.senderId);
            if (existing) {
                existing.count++;
            } else {
                messageBySender.set(msg.senderId, { count: 1, latest: msg });
            }
        }

        for (const [senderId, data] of messageBySender) {
            const msg = data.latest;
            notifications.push({
                id: `msg-${senderId}`,
                type: 'message',
                title: `${msg.sender.name || msg.sender.username || 'Someone'} sent you ${data.count === 1 ? 'a message' : `${data.count} messages`}`,
                description: msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content,
                createdAt: msg.createdAt.toISOString(),
                isRead: false,
                actionUrl: `/social?chat=${senderId}`,
                metadata: {
                    senderId: msg.sender.id,
                    senderName: msg.sender.name || msg.sender.username || 'Unknown',
                    senderImage: msg.sender.image
                }
            });
        }

        // 3. Pending Challenges (received)
        const pendingChallenges = await prisma.studyChallenge.findMany({
            where: {
                challengedId: userId,
                status: 'pending'
            },
            include: {
                challenger: {
                    select: { id: true, name: true, username: true, image: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        for (const ch of pendingChallenges) {
            const challengeTypeLabels: Record<string, string> = {
                study_time: 'Study Time Challenge',
                xp_race: 'XP Race',
                exercise_count: 'Exercise Challenge',
                quiz_score: 'Quiz Score Challenge',
                leetcode_race: 'LeetCode Race'
            };
            notifications.push({
                id: ch.id,
                type: 'challenge',
                title: `${ch.challenger.name || ch.challenger.username || 'Someone'} challenged you!`,
                description: `${challengeTypeLabels[ch.challengeType] || 'Challenge'} for ${ch.xpStake} XP`,
                createdAt: ch.createdAt.toISOString(),
                isRead: false,
                actionUrl: '/social?tab=challenges',
                metadata: {
                    senderId: ch.challenger.id,
                    senderName: ch.challenger.name || ch.challenger.username || 'Unknown',
                    senderImage: ch.challenger.image,
                    xpStake: ch.xpStake,
                    challengeType: ch.challengeType
                }
            });
        }

        // 4. Recently Completed Challenges (show results) - last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const completedChallenges = await prisma.studyChallenge.findMany({
            where: {
                OR: [
                    { challengerId: userId },
                    { challengedId: userId }
                ],
                status: 'completed',
                endsAt: { gte: sevenDaysAgo }
            },
            include: {
                challenger: { select: { id: true, name: true, username: true, image: true } },
                challenged: { select: { id: true, name: true, username: true, image: true } },
                winner: { select: { id: true, name: true } }
            },
            orderBy: { endsAt: 'desc' },
            take: 10
        });

        for (const ch of completedChallenges) {
            const isWinner = ch.winnerId === userId;
            const isDraw = ch.winnerId === null;
            const opponent = ch.challengerId === userId ? ch.challenged : ch.challenger;

            let title: string;
            let description: string;

            if (isDraw) {
                title = `Challenge with ${opponent.name || opponent.username} ended in a draw!`;
                description = `Your ${ch.xpStake} XP stake was refunded`;
            } else if (isWinner) {
                title = `🏆 You won the challenge against ${opponent.name || opponent.username}!`;
                description = `You earned ${ch.xpStake * 2} XP`;
            } else {
                title = `Challenge against ${opponent.name || opponent.username} ended`;
                description = `You lost ${ch.xpStake} XP`;
            }

            notifications.push({
                id: `result-${ch.id}`,
                type: 'challenge_result',
                title,
                description,
                createdAt: ch.endsAt?.toISOString() || ch.createdAt.toISOString(),
                isRead: true, // Completed challenges are considered "read"
                actionUrl: '/social?tab=challenges',
                metadata: {
                    senderId: opponent.id,
                    senderName: opponent.name || opponent.username || 'Unknown',
                    senderImage: opponent.image,
                    xpStake: ch.xpStake,
                    challengeType: ch.challengeType
                }
            });
        }

        // 5. Pending Homework (original functionality)
        const pendingHomework = await prisma.homeworkAssignment.findMany({
            where: {
                userId: userId,
                isCompleted: false,
                dueDate: {
                    lte: sevenDaysLater
                }
            },
            include: {
                subject: {
                    select: { name: true, slug: true, icon: true }
                },
                topic: {
                    select: { name: true, slug: true }
                }
            },
            orderBy: { dueDate: 'asc' }
        });

        for (const hw of pendingHomework) {
            const isOverdue = hw.dueDate < now;
            notifications.push({
                id: hw.id,
                type: 'homework',
                title: hw.title,
                description: hw.description,
                createdAt: hw.createdAt.toISOString(),
                isRead: false,
                actionUrl: hw.subject && hw.topic
                    ? `/subjects/${hw.subject.slug}/topics/${hw.topic.slug}`
                    : '/subjects',
                metadata: {
                    xpReward: hw.xpReward,
                    dueDate: hw.dueDate.toISOString(),
                    isOverdue
                }
            });
        }

        // Sort all notifications by createdAt descending
        notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Calculate counts
        const count = notifications.length;
        const unreadCount = notifications.filter(n => !n.isRead).length;
        const friendRequestCount = pendingFriendRequests.length;
        const messageCount = unreadMessages.length;
        const challengeCount = pendingChallenges.length;
        const homeworkCount = pendingHomework.length;
        const overdueHomeworkCount = pendingHomework.filter(hw => hw.dueDate < now).length;

        return NextResponse.json({
            notifications,
            count,
            unreadCount,
            friendRequestCount,
            messageCount,
            challengeCount,
            homeworkCount,
            overdueHomeworkCount
        });
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Mark notifications as read
export async function PATCH(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { notificationIds, type } = await request.json();

        // Mark messages as read
        if (type === 'message' && notificationIds?.length > 0) {
            // notificationIds for messages are in format "msg-{senderId}"
            const senderIds = notificationIds
                .filter((id: string) => id.startsWith('msg-'))
                .map((id: string) => id.replace('msg-', ''));

            if (senderIds.length > 0) {
                await prisma.directMessage.updateMany({
                    where: {
                        receiverId: session.user.id,
                        senderId: { in: senderIds },
                        isRead: false
                    },
                    data: { isRead: true }
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to mark notifications as read:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
