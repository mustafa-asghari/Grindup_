import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Update thinking session (complete or add notes)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const { completed, notes, endedAt } = body;

        const thinkingSession = await prisma.thinkingSessions.findUnique({
            where: { id },
        });

        if (!thinkingSession) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        if (thinkingSession.userId !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const updatedSession = await prisma.thinkingSessions.update({
            where: { id },
            data: {
                completed: completed ?? undefined,
                notes: notes ?? undefined,
                endedAt: endedAt ? new Date(endedAt) : undefined,
            },
        });

        return NextResponse.json(updatedSession);
    } catch (error) {
        console.error('Thinking session update error:', error);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }
}
