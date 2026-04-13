import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Create a thinking session
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { problemId, duration } = body;

        // Default duration is 5 minutes (300 seconds)
        // Default duration is 5 minutes (300 seconds)
        const thinkingSession = await prisma.thinkingSessions.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                problemId: problemId,
                duration: duration || 300,
            },
        });

        // Log activity
        // Log activity
        await prisma.userActivities.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                activityType: 'thinking_session',
                refId: thinkingSession.id,
                duration: duration || 300,
            },
        });

        return NextResponse.json(thinkingSession);
    } catch (error) {
        console.error('Thinking session create error:', error);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }
}

// Get active thinking session
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Find active (incomplete) thinking sessions
        const activeSessions = await prisma.thinkingSessions.findMany({
            where: {
                userId: session.user.id,
                completed: false,
            },
            orderBy: { startedAt: 'desc' },
            take: 1,
        });

        if (activeSessions.length === 0) {
            return NextResponse.json({ active: false });
        }

        const activeSession = activeSessions[0];
        const elapsedSeconds = Math.floor(
            (Date.now() - new Date(activeSession.startedAt).getTime()) / 1000
        );

        // Check if session expired
        if (elapsedSeconds >= activeSession.duration) {
            // Auto-complete expired session
            // Auto-complete expired session
            await prisma.thinkingSessions.update({
                where: { id: activeSession.id },
                data: {
                    completed: true,
                    endedAt: new Date(),
                },
            });
            return NextResponse.json({ active: false });
        }

        return NextResponse.json({
            active: true,
            session: activeSession,
            remainingSeconds: activeSession.duration - elapsedSeconds,
        });
    } catch (error) {
        console.error('Thinking session fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
    }
}
