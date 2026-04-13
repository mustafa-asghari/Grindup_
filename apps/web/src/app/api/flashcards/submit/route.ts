import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { flashcardId, known } = await request.json();

        if (!flashcardId || typeof known !== 'boolean') {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        // Record the attempt
        await prisma.exerciseAttempt.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                exerciseId: flashcardId,
                response: { known },
                isCorrect: known, // Consider "known" as correct for stats
                score: known ? 10 : 0,
                timeSpentSecs: 5, // Estimate for flashcards
            },
        });

        // Update user's XP if they marked it as known
        if (known) {
            await prisma.user.update({
                where: { id: session.user.id },
                data: { xp: { increment: 5 } }, // Small XP for flashcard review
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error submitting flashcard:', error);
        return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
    }
}
