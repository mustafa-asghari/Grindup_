import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Record a mistake replay attempt
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { mistakeCardId, newSubmissionId, wasSuccessful } = body;

        // Verify the mistake card belongs to this user
        const mistakeCard = await prisma.mistakeCards.findUnique({
            where: { id: mistakeCardId },
        });

        if (!mistakeCard || mistakeCard.userId !== session.user.id) {
            return NextResponse.json({ error: 'Mistake not found' }, { status: 404 });
        }

        // Create replay record
        const replay = await prisma.mistakeReplays.create({
            data: {
                id: uuidv4(),
                mistakeCardId: mistakeCardId,
                userId: session.user.id,
                newSubmissionId: newSubmissionId,
                wasSuccessful: wasSuccessful ?? false,
            },
        });

        // If successful, potentially mark as mastered
        if (wasSuccessful) {
            // Check if this is the second successful attempt
            const successfulReplays = await prisma.mistakeReplays.count({
                where: {
                    mistakeCardId: mistakeCardId,
                    wasSuccessful: true,
                },
            });

            if (successfulReplays >= 2) {
                await prisma.mistakeCards.update({
                    where: { id: mistakeCardId },
                    data: { mastered: true },
                });
            }
        }

        // Log activity
        await prisma.userActivities.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                activityType: 'mistake_replay',
                refId: mistakeCardId,
                metadata: { wasSuccessful },
            },
        });

        return NextResponse.json(replay);
    } catch (error) {
        console.error('Mistake replay error:', error);
        return NextResponse.json({ error: 'Failed to record replay' }, { status: 500 });
    }
}
