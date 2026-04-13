import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Fetch cards due for review
        const dueCards = await prisma.reviewCards.findMany({
            where: {
                userId: session.user.id,
                nextReview: { lte: new Date() }
            },
            take: 50,
            orderBy: { nextReview: 'asc' }
        });

        if (dueCards.length === 0) {
            return NextResponse.json({ reviews: [] });
        }

        // Fetch associated exercises
        // content field stores { exerciseId: "..." }
        // We need to valid cards that have valid exerciseIds
        const exerciseIds = dueCards
            .map(c => (c.content as any)?.exerciseId)
            .filter(id => id && typeof id === 'string');

        const exercises = await prisma.exercise.findMany({
            where: { id: { in: exerciseIds } },
            include: { subject: true }
        });

        // Map exercises to cards (since card stores state)
        // One exercise could theoretically have multiple cards? Unlikely if 1:1.

        const reviews = dueCards.map(card => {
            const exId = (card.content as any)?.exerciseId;
            const exercise = exercises.find(e => e.id === exId);
            if (!exercise) return null;

            return {
                cardId: card.id,
                exercise
            };
        }).filter(Boolean);

        return NextResponse.json({ reviews });

    } catch (error) {
        console.error('Failed to fetch reviews', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
