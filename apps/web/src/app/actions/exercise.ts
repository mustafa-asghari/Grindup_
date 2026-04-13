'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function saveExerciseAttempt(data: {
    exerciseId: string;
    response: any;
    isCorrect: boolean;
    score: number;
    timeSpentSecs?: number;
    hintsUsed?: number;
}) {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: 'Unauthorized' };
    }

    try {
        const { exerciseId, response, isCorrect, score, timeSpentSecs, hintsUsed } = data;

        // Get attempt number
        const count = await prisma.exerciseAttempt.count({
            where: {
                userId: session.user.id,
                exerciseId
            }
        });

        const attempt = await prisma.exerciseAttempt.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                exerciseId,
                response: response ?? {},
                isCorrect,
                score,
                timeSpentSecs: timeSpentSecs || 0,
                hintsUsed: hintsUsed || 0,
                attemptNumber: count + 1,
            }
        });

        // Also update UserTopicProgress if applicable? 
        // For now, just revalidate the dashboard
        revalidatePath('/');
        return { success: true, attemptId: attempt.id };
    } catch (e) {
        console.error('Failed to save exercise attempt:', e);
        return { error: 'Failed to save attempt' };
    }
}
