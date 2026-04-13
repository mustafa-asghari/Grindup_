import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Background job to evaluate and complete expired challenges.
 * Should be called periodically (e.g., every minute via cron).
 */
export async function POST() {
    try {
        const now = new Date();

        // Find all active challenges that have ended
        const expiredChallenges = await prisma.studyChallenge.findMany({
            where: {
                status: 'active',
                endsAt: { lte: now }
            },
            include: {
                challenger: { select: { id: true, name: true } },
                challenged: { select: { id: true, name: true } }
            }
        });

        const results = [];

        for (const challenge of expiredChallenges) {
            try {
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

                let winnerId: string | null = null;
                let loserId: string | null = null;

                if (challenge.challengeType === 'leetcode_race') {
                    if (scoreChallenger === Infinity && scoreChallenged === Infinity) {
                        winnerId = null;
                    } else if (scoreChallenger === Infinity) {
                        winnerId = challenge.challengedId;
                    } else if (scoreChallenged === Infinity) {
                        winnerId = challenge.challengerId;
                    } else if (scoreChallenger < scoreChallenged) {
                        winnerId = challenge.challengerId;
                    } else if (scoreChallenged < scoreChallenger) {
                        winnerId = challenge.challengedId;
                    }
                } else {
                    if (scoreChallenger > scoreChallenged) {
                        winnerId = challenge.challengerId;
                    } else if (scoreChallenged > scoreChallenger) {
                        winnerId = challenge.challengedId;
                    }
                }

                if (winnerId) {
                    loserId = winnerId === challenge.challengerId ? challenge.challengedId : challenge.challengerId;
                }

                const stake = challenge.xpStake;

                await prisma.$transaction(async (tx) => {
                    await tx.studyChallenge.update({
                        where: { id: challenge.id },
                        data: { status: 'completed', winnerId }
                    });

                    if (winnerId && loserId) {
                        const winnings = stake * 2;
                        await tx.user.update({
                            where: { id: winnerId },
                            data: { xp: { increment: winnings } }
                        });
                        await tx.xpTransactions.create({
                            data: {
                                id: uuidv4(),
                                userId: winnerId,
                                amount: winnings,
                                reason: `Won ${challenge.challengeType.replace('_', ' ')} challenge!`
                            }
                        });
                        await tx.xpTransactions.create({
                            data: {
                                id: uuidv4(),
                                userId: loserId,
                                amount: 0,
                                reason: `Lost ${challenge.challengeType.replace('_', ' ')} challenge`
                            }
                        });
                    } else {
                        await tx.user.update({
                            where: { id: challenge.challengerId },
                            data: { xp: { increment: stake } }
                        });
                        await tx.user.update({
                            where: { id: challenge.challengedId },
                            data: { xp: { increment: stake } }
                        });
                        await tx.xpTransactions.create({
                            data: {
                                id: uuidv4(),
                                userId: challenge.challengerId,
                                amount: stake,
                                reason: `Challenge draw - stake refunded`
                            }
                        });
                        await tx.xpTransactions.create({
                            data: {
                                id: uuidv4(),
                                userId: challenge.challengedId,
                                amount: stake,
                                reason: `Challenge draw - stake refunded`
                            }
                        });
                    }
                });

                results.push({
                    challengeId: challenge.id,
                    winnerId,
                    status: 'completed'
                });
            } catch (err) {
                console.error(`Failed to evaluate challenge ${challenge.id}:`, err);
                results.push({
                    challengeId: challenge.id,
                    status: 'error',
                    error: String(err)
                });
            }
        }

        return NextResponse.json({
            processed: expiredChallenges.length,
            results
        });
    } catch (error) {
        console.error('Evaluate challenges error:', error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
