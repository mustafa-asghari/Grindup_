
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

/**
 * Evaluate and complete a challenge.
 * Can be called by either participant when the challenge time has ended.
 */
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { challengeId } = await req.json();

        const challenge = await prisma.studyChallenge.findUnique({
            where: { id: challengeId },
            include: {
                challenger: { select: { id: true, name: true } },
                challenged: { select: { id: true, name: true } }
            }
        });

        if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });

        // Only active challenges can be completed
        if (challenge.status === 'completed') {
            return NextResponse.json({
                error: "Challenge already completed",
                winnerId: challenge.winnerId
            }, { status: 400 });
        }

        if (challenge.status !== 'active') {
            return NextResponse.json({ error: "Challenge not active" }, { status: 400 });
        }

        // Only participants can claim
        if (challenge.challengerId !== session.user.id && challenge.challengedId !== session.user.id) {
            return NextResponse.json({ error: "Not a participant" }, { status: 403 });
        }

        // Check if challenge time has ended
        if (!challenge.endsAt || new Date() < new Date(challenge.endsAt)) {
            return NextResponse.json({ error: "Challenge is still ongoing" }, { status: 400 });
        }

        // Calculate scores based on challenge type
        const getScore = async (userId: string): Promise<number> => {
            const startTime = challenge.startsAt!;
            const endTime = challenge.endsAt!;

            switch (challenge.challengeType) {
                case 'xp_race': {
                    const txs = await prisma.xpTransactions.findMany({
                        where: {
                            userId,
                            createdAt: { gte: startTime, lte: endTime }
                        }
                    });
                    return txs.reduce((acc, t) => acc + Math.max(0, t.amount), 0);
                }
                case 'exercise_count': {
                    return await prisma.exerciseAttempt.count({
                        where: {
                            userId,
                            createdAt: { gte: startTime, lte: endTime },
                            isCorrect: true
                        }
                    });
                }
                case 'study_time': {
                    const events = await prisma.events.findMany({
                        where: {
                            userId,
                            eventType: 'study_session',
                            createdAt: { gte: startTime, lte: endTime }
                        }
                    });
                    return events.reduce((acc, e) => {
                        const payload = e.payload as any;
                        return acc + (payload?.durationMins || payload?.duration || 0);
                    }, 0);
                }
                case 'leetcode_race': {
                    // Check if solved the target problem
                    if (challenge.targetProblemId) {
                        const solved = await prisma.submission.findFirst({
                            where: {
                                userId,
                                problemId: challenge.targetProblemId,
                                status: 'accepted',
                                submittedAt: { gte: startTime, lte: endTime }
                            },
                            orderBy: { submittedAt: 'asc' }
                        });
                        // Return timestamp as score (lower is better) or 0 if not solved
                        return solved ? solved.submittedAt.getTime() : Infinity;
                    }
                    return 0;
                }
                default:
                    return 0;
            }
        };

        const scoreChallenger = await getScore(challenge.challengerId);
        const scoreChallenged = await getScore(challenge.challengedId);

        // Determine winner
        let winnerId: string | null = null;
        let loserId: string | null = null;

        if (challenge.challengeType === 'leetcode_race') {
            // For racing, lower time wins (but only if they solved it)
            if (scoreChallenger === Infinity && scoreChallenged === Infinity) {
                winnerId = null; // Neither solved - draw
            } else if (scoreChallenger === Infinity) {
                winnerId = challenge.challengedId;
            } else if (scoreChallenged === Infinity) {
                winnerId = challenge.challengerId;
            } else if (scoreChallenger < scoreChallenged) {
                winnerId = challenge.challengerId;
            } else if (scoreChallenged < scoreChallenger) {
                winnerId = challenge.challengedId;
            }
            // If equal, it's a draw
        } else {
            // For other types, higher score wins
            if (scoreChallenger > scoreChallenged) {
                winnerId = challenge.challengerId;
            } else if (scoreChallenged > scoreChallenger) {
                winnerId = challenge.challengedId;
            }
            // If equal, it's a draw
        }

        if (winnerId) {
            loserId = winnerId === challenge.challengerId ? challenge.challengedId : challenge.challengerId;
        }

        const stake = challenge.xpStake;
        const winnerName = winnerId === challenge.challengerId
            ? challenge.challenger.name
            : challenge.challenged.name;

        // Transaction to complete challenge
        await prisma.$transaction(async (tx) => {
            // Update challenge status
            await tx.studyChallenge.update({
                where: { id: challengeId },
                data: {
                    status: 'completed',
                    winnerId: winnerId
                }
            });

            if (winnerId && loserId) {
                // Winner gets their stake back PLUS loser's stake (2x total since both escrowed)
                const winnings = stake * 2;

                // Give winnings to winner
                await tx.user.update({
                    where: { id: winnerId },
                    data: { xp: { increment: winnings } }
                });

                // Record transaction for winner
                await tx.xpTransactions.create({
                    data: {
                        id: uuidv4(),
                        userId: winnerId,
                        amount: winnings,
                        reason: `Won ${challenge.challengeType.replace('_', ' ')} challenge!`
                    }
                });

                // Record transaction for loser (they already lost their stake during escrow)
                await tx.xpTransactions.create({
                    data: {
                        id: uuidv4(),
                        userId: loserId,
                        amount: 0, // Already deducted as escrow
                        reason: `Lost ${challenge.challengeType.replace('_', ' ')} challenge - stake forfeited`
                    }
                });

            } else {
                // Draw - refund both participants their escrowed XP
                await tx.user.update({
                    where: { id: challenge.challengerId },
                    data: { xp: { increment: stake } }
                });
                await tx.user.update({
                    where: { id: challenge.challengedId },
                    data: { xp: { increment: stake } }
                });

                // Record refund transactions
                await tx.xpTransactions.create({
                    data: {
                        id: uuidv4(),
                        userId: challenge.challengerId,
                        amount: stake,
                        reason: `Challenge ended in a draw - stake refunded`
                    }
                });
                await tx.xpTransactions.create({
                    data: {
                        id: uuidv4(),
                        userId: challenge.challengedId,
                        amount: stake,
                        reason: `Challenge ended in a draw - stake refunded`
                    }
                });
            }
        });

        return NextResponse.json({
            success: true,
            winnerId,
            winnerName: winnerName || 'Draw',
            scoreChallenger: challenge.challengeType === 'leetcode_race' && scoreChallenger === Infinity ? 'Not solved' : scoreChallenger,
            scoreChallenged: challenge.challengeType === 'leetcode_race' && scoreChallenged === Infinity ? 'Not solved' : scoreChallenged,
            isDraw: winnerId === null,
            xpWon: winnerId ? stake * 2 : stake // Amount given (for winner, 2x; for draw, refund)
        });

    } catch (error) {
        console.error('Claim error:', error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
