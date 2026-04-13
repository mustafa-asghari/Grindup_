
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// Track time spent on a topic/lesson
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { subjectId, topicId, secondsSpent } = await request.json();

        if (!subjectId || !secondsSpent || secondsSpent < 1) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        const userId = session.user.id;

        // Update UserSubject total time spent
        await prisma.userSubject.updateMany({
            where: { userId, subjectId },
            data: {
                totalTimeSpent: { increment: secondsSpent },
                lastAccessedAt: new Date()
            }
        });



        // Use Events table for proper tracking
        await prisma.events.create({
            data: {
                id: crypto.randomUUID(),
                userId,
                eventType: 'study_session',
                payload: {
                    subjectId,
                    topicId,
                    secondsSpent,
                    type: 'reading'
                },
                createdAt: new Date()
            }
        });

        return NextResponse.json({ success: true, secondsLogged: secondsSpent });
    } catch (error) {
        console.error('Track time error:', error);
        return NextResponse.json({ error: 'Failed to track time' }, { status: 500 });
    }
}
