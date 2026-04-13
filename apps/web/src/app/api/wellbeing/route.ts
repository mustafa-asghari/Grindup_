import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Check for plateau/stagnation and wellbeing issues
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get concept drift alerts
        const alerts = await prisma.conceptDriftAlerts.findMany({
            where: {
                userId: session.user.id,
            },
            orderBy: { alertedAt: 'desc' },
            take: 10,
        });

        // Transform to wellbeing format
        const wellbeingAlerts = alerts.map(a => ({
            id: a.id,
            type: 'concept_drift',
            topicId: a.topicId,
            severity: a.driftPercentage > 50 ? 'high' : 'medium',
            message: 'Review this topic to strengthen your understanding',
            detectedAt: a.alertedAt.toISOString(),
        }));

        return NextResponse.json({
            alerts: wellbeingAlerts,
            hasAlerts: wellbeingAlerts.length > 0,
        });
    } catch (error) {
        console.error('Wellbeing check error:', error);
        // Return empty alerts instead of error to prevent UI crash
        return NextResponse.json({
            alerts: [],
            hasAlerts: false,
            error: 'Unable to fetch wellbeing data',
        });
    }
}

// Run a wellbeing check
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const alerts: any[] = [];

        // Check for stagnation (topic progress below threshold with no recent activity)
        const topicProgress = await prisma.userTopicProgress.findMany({
            where: { userId: session.user.id },
            include: { subjectTopic: true },
        });

        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        for (const tp of topicProgress) {
            // Check if mastery is low and hasn't been practiced recently
            if (
                tp.masteryPercent > 0 &&
                tp.masteryPercent < 80 &&
                tp.lastPracticed &&
                new Date(tp.lastPracticed) < twoWeeksAgo
            ) {
                // Check for existing drift alert for today
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                const existingAlert = await prisma.conceptDriftAlerts.findFirst({
                    where: {
                        userId: session.user.id,
                        topicId: tp.topicId,
                        alertedAt: { gte: startOfDay },
                    },
                });

                if (!existingAlert) {
                    const severity = tp.masteryPercent < 30 ? 'high' : tp.masteryPercent < 50 ? 'medium' : 'low';

                    const alert = await prisma.conceptDriftAlerts.create({
                        data: {
                            id: uuidv4(),
                            userId: session.user.id,
                            topicId: tp.topicId,
                            driftPercentage: 100 - tp.masteryPercent,
                            masteryBefore: 100, // Assumption since we don't track history deeply here
                            masteryCurrent: tp.masteryPercent,
                        },
                    });
                    alerts.push({
                        id: alert.id,
                        type: 'stagnation',
                        topic: tp.subjectTopic?.name,
                        severity,
                    });
                }
            }
        }

        // Check for frustration (many wrong attempts recently)
        const recentAttempts = await prisma.exerciseAttempt.findMany({
            where: {
                userId: session.user.id,
                createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // last 2 hours
            },
        });

        if (recentAttempts.length >= 10) {
            const wrongCount = recentAttempts.filter(a => a.isCorrect === false).length;
            const frustrationRate = wrongCount / recentAttempts.length;

            if (frustrationRate > 0.7) {
                alerts.push({
                    type: 'frustration',
                    message: 'You seem to be struggling. Consider taking a short break!',
                    frustrationRate: Math.round(frustrationRate * 100),
                });
            }
        }

        // Check for burnout (excessive grinding based on exercise attempts)
        const thirtyDayAttempts = await prisma.exerciseAttempt.count({
            where: {
                userId: session.user.id,
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
        });

        if (thirtyDayAttempts > 500) {
            alerts.push({
                type: 'burnout_risk',
                message: "You've been working really hard! Remember to take rest days.",
                activityCount: thirtyDayAttempts,
            });
        }

        return NextResponse.json({
            checked: true,
            alerts,
            summary: {
                stagnationAlerts: alerts.filter(a => a.type === 'stagnation').length,
                wellbeingAlerts: alerts.filter(a => a.type === 'frustration' || a.type === 'burnout_risk').length,
            },
        });
    } catch (error) {
        console.error('Wellbeing check error:', error);
        return NextResponse.json({
            checked: false,
            alerts: [],
            error: 'Failed to run wellbeing check',
        });
    }
}

// Dismiss an alert
export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { alertId } = body;

        if (!alertId) {
            return NextResponse.json({ error: 'Alert ID required' }, { status: 400 });
        }

        await prisma.conceptDriftAlerts.delete({
            where: { id: alertId },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Alert dismiss error:', error);
        return NextResponse.json({ error: 'Failed to dismiss alert' }, { status: 500 });
    }
}
