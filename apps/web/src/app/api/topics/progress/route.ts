import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { topicId, status, masteryPercent, xpRewarded } = body;

        if (!topicId) {
            return NextResponse.json({ error: 'topicId is required' }, { status: 400 });
        }

        const topic = await prisma.subjectTopic.findUnique({
            where: { id: topicId },
            select: { id: true, subjectId: true }
        });

        if (!topic) {
            return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        }

        const safeStatus = typeof status === 'string' ? status : 'in_progress';
        const safeMastery = typeof masteryPercent === 'number' && masteryPercent >= 0
            ? Math.min(masteryPercent, 100)
            : safeStatus === 'mastered'
                ? 100
                : 10;

        const progress = await prisma.userTopicProgress.upsert({
            where: {
                userId_topicId: {
                    userId: session.user.id,
                    topicId
                }
            },
            create: {
                id: randomUUID(),
                userId: session.user.id,
                topicId,
                status: safeStatus,
                masteryPercent: safeMastery,
                lastPracticed: new Date()
            },
            update: {
                status: safeStatus,
                masteryPercent: safeMastery,
                lastPracticed: new Date()
            }
        });

        // Compute subject-level progress based on mastered topics
        const topicRecord = await prisma.subjectTopic.findUnique({
            where: { id: topicId },
            select: { subjectId: true }
        });

        if (topicRecord?.subjectId) {
            const [masteredCount, totalTopics] = await Promise.all([
                prisma.userTopicProgress.count({
                    where: {
                        userId: session.user.id,
                        status: 'mastered',
                        subjectTopic: { subjectId: topicRecord.subjectId }
                    }
                }),
                prisma.subjectTopic.count({
                    where: { subjectId: topicRecord.subjectId, parentId: { not: null } }
                })
            ]);

            const progressPercent = Math.min(
                100,
                Math.round((masteredCount / Math.max(totalTopics || 1, 1)) * 100)
            );

            await prisma.userSubject.updateMany({
                where: {
                    userId: session.user.id,
                    subjectId: topicRecord.subjectId
                },
                data: {
                    progressPercent,
                    exercisesCompleted: { increment: 1 },
                    xpEarned: xpRewarded && xpRewarded > 0 ? { increment: Math.round(xpRewarded) } : undefined,
                    lastAccessedAt: new Date()
                }
            });
        }

        if (xpRewarded && xpRewarded > 0) {
            await prisma.user.update({
                where: { id: session.user.id },
                data: { xp: { increment: Math.round(xpRewarded) } }
            });
        }

        return NextResponse.json({ success: true, progress });
    } catch (error) {
        console.error('Failed to update topic progress', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
