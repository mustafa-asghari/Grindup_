import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId');
    const topicId = searchParams.get('topicId');

    if (!subjectId) {
        return NextResponse.json({ error: 'Subject ID required' }, { status: 400 });
    }

    try {
        // Find all flashcard exercises for this subject/topic
        const where: any = {
            subjectId,
            type: 'flashcard',
        };

        if (topicId) {
            where.topicId = topicId;
        }

        const exercises = await prisma.exercise.findMany({
            where,
            include: {
                subject: { select: { name: true } },
                topic: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        // Format as flashcards
        const flashcards = exercises.map((ex: any) => ({
            id: ex.id,
            front: typeof ex.content === 'object' && ex.content !== null
                ? (ex.content as any).front || (ex.content as any).question || 'No front'
                : 'No content',
            back: typeof ex.content === 'object' && ex.content !== null
                ? (ex.content as any).back || (ex.content as any).answer || 'No back'
                : 'No content',
            subject: ex.subject.name,
            topic: ex.topic?.name || 'General',
        }));

        return NextResponse.json({ flashcards });
    } catch (error) {
        console.error('Error fetching flashcards:', error);
        return NextResponse.json({ error: 'Failed to fetch flashcards' }, { status: 500 });
    }
}
