import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Get activity data for heatmap
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const days = parseInt(url.searchParams.get('days') || '365');

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get submissions
        const submissions = await prisma.submission.findMany({
            where: {
                userId: session.user.id,
                submittedAt: { gte: startDate },
            },
            select: { submittedAt: true },
        });

        // Get exercise attempts
        const exercises = await prisma.exerciseAttempt.findMany({
            where: {
                userId: session.user.id,
                createdAt: { gte: startDate },
            },
            select: { createdAt: true },
        });

        // Get events (for lesson views, topic progress, etc.)
        const events = await prisma.events.findMany({
            where: {
                userId: session.user.id,
                createdAt: { gte: startDate },
                eventType: {
                    in: ['lesson_viewed', 'topic_started', 'exercise_started', 'problem_started'],
                },
            },
            select: { createdAt: true },
        });

        // Aggregate by date
        const dateMap = new Map<string, number>();

        submissions.forEach((s) => {
            const dateStr = new Date(s.submittedAt).toISOString().split('T')[0];
            dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
        });

        exercises.forEach((e) => {
            const dateStr = new Date(e.createdAt).toISOString().split('T')[0];
            dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
        });

        events.forEach((ev) => {
            const dateStr = new Date(ev.createdAt).toISOString().split('T')[0];
            dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
        });

        // Convert to array format for heatmap
        const heatmapData = Array.from(dateMap.entries()).map(([date, count]) => ({
            date,
            count,
        }));

        // Calculate streak and active days
        const sortedDates = Array.from(dateMap.keys()).sort().reverse();
        let streak = 0;
        const today = new Date().toISOString().split('T')[0];

        for (let i = 0; i < sortedDates.length; i++) {
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() - i);
            const expectedStr = expectedDate.toISOString().split('T')[0];

            if (sortedDates.includes(expectedStr)) {
                streak++;
            } else if (i > 0) { // Allow today to have no activity
                break;
            }
        }

        return NextResponse.json({
            activities: heatmapData,
            totalActivities: heatmapData.reduce((sum, d) => sum + d.count, 0),
            activeDays: dateMap.size,
            currentStreak: streak,
        });
    } catch (error) {
        console.error('Activity fetch error:', error);
        // Return empty data instead of error
        return NextResponse.json({
            activities: [],
            totalActivities: 0,
            activeDays: 0,
            currentStreak: 0,
        });
    }
}

// Record an activity event
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { eventType, payload } = body;

        if (!eventType) {
            return NextResponse.json({ error: 'Event type required' }, { status: 400 });
        }

        // Create event
        const event = await prisma.events.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                eventType,
                payload: payload || {},
            },
        });

        // Update user streak if this is their first activity today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingTodayActivity = await prisma.events.findFirst({
            where: {
                userId: session.user.id,
                createdAt: { gte: today },
                id: { not: event.id },
            },
        });

        if (!existingTodayActivity) {
            // First activity today - check if streak should increment
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const yesterdayActivity = await prisma.events.findFirst({
                where: {
                    userId: session.user.id,
                    createdAt: { gte: yesterday, lt: today },
                },
            });

            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { currentStreak: true },
            });

            const newStreak = yesterdayActivity
                ? (user?.currentStreak || 0) + 1
                : 1;

            await prisma.user.update({
                where: { id: session.user.id },
                data: { currentStreak: newStreak },
            });
        }

        return NextResponse.json({
            success: true,
            eventId: event.id,
        });
    } catch (error) {
        console.error('Activity create error:', error);
        return NextResponse.json({ error: 'Failed to record activity' }, { status: 500 });
    }
}
