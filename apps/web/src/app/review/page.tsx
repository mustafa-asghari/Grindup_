import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ReviewClient } from './review-client';
import { ExerciseData } from '@/lib/exercise-types';

export const metadata = {
    title: 'Daily Review | GrindUp',
    description: 'Master your topics with spaced repetition',
};

export default async function ReviewPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    // Connect to DB directly for SSR
    const dueCards = await prisma.reviewCards.findMany({
        where: {
            userId: session.user.id,
            nextReview: { lte: new Date() }
        },
        take: 50,
        orderBy: { nextReview: 'asc' }
    });

    let reviews: { cardId: string; exercise: ExerciseData }[] = [];

    if (dueCards.length > 0) {
        const exerciseIds = dueCards
            .map(c => (c.content as any)?.exerciseId)
            .filter(id => id && typeof id === 'string');

        const exercises = await prisma.exercise.findMany({
            where: { id: { in: exerciseIds } },
            include: { subject: true }
        });

        reviews = dueCards.map(card => {
            const exId = (card.content as any)?.exerciseId;
            const exercise = exercises.find(e => e.id === exId);
            if (!exercise) return null;

            return {
                cardId: card.id,
                exercise: exercise as unknown as ExerciseData // Cast Prisma model to type
            };
        }).filter((r): r is { cardId: string; exercise: ExerciseData } => !!r);
    }

    return (
        <ReviewClient
            reviews={reviews}
            isLoggedIn={true}
        />
    );
}
