
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

interface RouteProps {
    params: Promise<{ attemptId: string }>;
}

export async function GET(request: Request, props: RouteProps) {
    const params = await props.params;
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { attemptId } = params;

        const attempt = await prisma.exerciseAttempt.findUnique({
            where: { id: attemptId },
            include: {
                exercise: {
                    select: {
                        id: true,
                        title: true,
                        type: true,
                        content: true,
                        points: true,
                        difficulty: true
                    }
                }
            }
        });

        if (!attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        if (attempt.userId !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json(attempt);
    } catch (error) {
        console.error('Error fetching attempt:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
