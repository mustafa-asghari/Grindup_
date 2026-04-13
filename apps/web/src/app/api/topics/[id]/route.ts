import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const topicId = params.id;

    try {
        const topic = await prisma.subjectTopic.findUnique({
            where: { id: topicId },
            include: {
                exercise: {
                    where: { isActive: true },
                    include: {
                        exerciseAttempts: {
                            where: { userId: session.user.id },
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    }
                },
                userTopicProgress: {
                    where: { userId: session.user.id }
                }
            }
        });

        if (!topic) {
            return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        }

        return NextResponse.json(topic);
    } catch (error) {
        console.error('Failed to fetch topic:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
