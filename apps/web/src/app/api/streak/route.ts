import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Get streak info and bonuses
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get current streak from user
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { currentStreak: true, xp: true },
        });

        const currentStreak = user?.currentStreak || 0;

        // Calculate next bonus milestone
        const streakMilestones = [7, 14, 30, 60, 90, 180, 365];
        const nextMilestone = streakMilestones.find(m => m > currentStreak) || null;
        const bonusMultiplier = getStreakMultiplier(currentStreak);

        // Get recent XP transactions related to streaks
        const recentBonuses = await prisma.xpTransactions.findMany({
            where: {
                userId: session.user.id,
                reason: { contains: 'streak' },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        return NextResponse.json({
            currentStreak,
            bonusMultiplier,
            nextMilestone,
            daysToNextMilestone: nextMilestone ? nextMilestone - currentStreak : null,
            recentBonuses: recentBonuses.map(b => ({
                id: b.id,
                amount: b.amount,
                reason: b.reason,
                awardedAt: b.createdAt.toISOString(),
            })),
            currentXp: user?.xp || 0,
        });
    } catch (error) {
        console.error('Streak fetch error:', error);
        // Return default data instead of error
        return NextResponse.json({
            currentStreak: 0,
            bonusMultiplier: 1.0,
            nextMilestone: 7,
            daysToNextMilestone: 7,
            recentBonuses: [],
            currentXp: 0,
        });
    }
}

// Award a streak bonus (called daily after activity)
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get user's current streak
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { currentStreak: true },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const streakDays = user.currentStreak || 0;
        const multiplier = getStreakMultiplier(streakDays);

        // Check if this is a milestone day
        const milestones = [7, 14, 30, 60, 90, 180, 365];
        const isMilestone = milestones.includes(streakDays);

        if (!isMilestone) {
            return NextResponse.json({
                message: 'Not a milestone day',
                currentStreak: streakDays,
                multiplier,
            });
        }

        // Check if we already awarded this milestone (by checking XP transactions)
        const existingBonus = await prisma.xpTransactions.findFirst({
            where: {
                userId: session.user.id,
                reason: `${streakDays}-day streak bonus`,
            },
        });

        if (existingBonus) {
            return NextResponse.json({
                message: 'Bonus already awarded',
                bonus: existingBonus,
            });
        }

        // Calculate bonus XP
        const bonusXp = Math.floor(50 * streakDays * multiplier);

        // Add XP to user
        await prisma.user.update({
            where: { id: session.user.id },
            data: { xp: { increment: bonusXp } },
        });

        // Log XP transaction
        const transaction = await prisma.xpTransactions.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                amount: bonusXp,
                reason: `${streakDays}-day streak bonus`,
                metadata: { streakDays, multiplier },
            },
        });

        // Log milestone event
        await prisma.events.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                eventType: 'streak_milestone',
                payload: {
                    streakDays,
                    multiplier,
                    xpAwarded: bonusXp,
                },
            },
        });

        // Check for streak badge
        await checkStreakBadge(session.user.id, streakDays);

        return NextResponse.json({
            success: true,
            message: `🎉 ${streakDays}-day streak bonus awarded!`,
            xpAwarded: bonusXp,
            transaction: {
                id: transaction.id,
                amount: transaction.amount,
            },
        });
    } catch (error) {
        console.error('Streak bonus award error:', error);
        return NextResponse.json({ error: 'Failed to award bonus' }, { status: 500 });
    }
}

function getStreakMultiplier(days: number): number {
    if (days >= 365) return 3.0;
    if (days >= 180) return 2.5;
    if (days >= 90) return 2.0;
    if (days >= 60) return 1.75;
    if (days >= 30) return 1.5;
    if (days >= 14) return 1.25;
    if (days >= 7) return 1.1;
    return 1.0;
}

async function checkStreakBadge(userId: string, streakDays: number) {
    // Badge thresholds
    const badgeThresholds = [
        { days: 7, badge: 'Week Warrior', description: '7-day streak achieved' },
        { days: 30, badge: 'Monthly Master', description: '30-day streak achieved' },
        { days: 100, badge: 'Century Streak', description: '100-day streak achieved' },
        { days: 365, badge: 'Year of Dedication', description: '365-day streak achieved' },
    ];

    const eligibleBadge = badgeThresholds.find(t => t.days === streakDays);
    if (!eligibleBadge) return;

    // Check if badge already exists
    const existingBadge = await prisma.userBadges.findFirst({
        where: {
            userId,
            badges: {
                name: eligibleBadge.badge,
            },
        },
    });

    if (existingBadge) return;

    // Find or create badge
    let badge = await prisma.badges.findFirst({
        where: { name: eligibleBadge.badge },
    });

    if (!badge) {
        badge = await prisma.badges.create({
            data: {
                id: uuidv4(),
                name: eligibleBadge.badge,
                description: eligibleBadge.description,
                iconUrl: '🔥', // Using emoji as URL placeholder for now, or use a real URL
                // category and tier seem missing in schema too? Let's check schema for those fields.
            },
        });
    }

    // Award badge
    await prisma.userBadges.create({
        data: {
            userId,
            badgeId: badge.id,
        },
    });

    // Log event
    await prisma.events.create({
        data: {
            id: uuidv4(),
            userId,
            eventType: 'badge_earned',
            payload: {
                badgeName: badge.name,
                reason: `${streakDays}-day streak`,
            },
        },
    });
}
