import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculateLevel } from '@/lib/level-utils';
import { v4 as uuidv4 } from 'uuid';

async function scheduleReviewCard(opts: {
    userId: string;
    problemId: string;
    problemTitle?: string;
}) {
    const { userId, problemId, problemTitle } = opts;
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Try to find an existing review card for this user/problem (stored in JSON content)
    const existing = await prisma.reviewCards.findFirst({
        where: {
            userId,
            cardType: 'problem',
            content: {
                path: ['problemId'],
                equals: problemId,
            },
        },
    });

    if (existing) {
        await prisma.reviewCards.update({
            where: { id: existing.id },
            data: {
                repetitions: existing.repetitions + 1,
                intervalDays: 1,
                nextReview: tomorrow,
                content: {
                    problemId,
                    title: problemTitle,
                } as any,
            },
        });
    } else {
        await prisma.reviewCards.create({
            data: {
                id: uuidv4(),
                userId,
                cardType: 'problem',
                content: {
                    problemId,
                    title: problemTitle,
                } as any,
                easeFactor: 2.5,
                intervalDays: 1,
                repetitions: 1,
                nextReview: tomorrow,
            },
        });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const body = await req.json();

        const { code, language, problem_id, test_cases, time_limit_ms, memory_limit_kb } = body;

        // Validate required fields
        if (!code || !language || !problem_id || !test_cases) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Get problem version
        const problem = await prisma.problem.findUnique({
            where: { id: problem_id },
            select: { version: true, difficulty: true, title: true }
        });

        if (!problem) {
            return NextResponse.json(
                { error: 'Problem not found' },
                { status: 404 }
            );
        }

        const correlationId = uuidv4();

        // Create submission record (pending state)
        const submission = await prisma.submission.create({
            data: {
                id: uuidv4(),
                userId,
                problemId: problem_id,
                problemVersion: problem.version,
                code,
                language,
                status: 'running',
                correlationId,
            },
        });

        // Call the runner service
        let result;
        try {
            const runnerUrl = process.env.RUNNER_URL || 'http://localhost:8080';
            const runnerHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            const runnerSharedSecret = process.env.RUNNER_SHARED_SECRET;

            if (runnerSharedSecret) {
                runnerHeaders['X-Runner-Token'] = runnerSharedSecret;
            }

            const runnerResponse = await fetch(`${runnerUrl}/execute`, {
                method: 'POST',
                headers: runnerHeaders,
                body: JSON.stringify({
                    code,
                    language,
                    test_cases,
                    time_limit_ms: time_limit_ms || 2000,
                    memory_limit_kb: memory_limit_kb || 256000,
                }),
            });

            result = await runnerResponse.json();

            if (!runnerResponse.ok) {
                throw new Error('Runner service rejected execution request');
            }
        } catch {
            // Update submission with error status
            await prisma.submission.update({
                where: { id: submission.id },
                data: {
                    status: 'error',
                    testResults: { error: 'Runner service unavailable' },
                },
            });

            return NextResponse.json({
                error: 'Failed to connect to runner service',
                status: 'error',
                test_results: [],
            });
        }

        // Update submission with results
        if (submission) {
            // Calculate runtime from test results
            const totalRuntime = result.test_results?.reduce(
                (sum: number, r: { runtime_ms?: number }) => sum + (r.runtime_ms || 0),
                0
            ) || 0;

            await prisma.submission.update({
                where: { id: submission.id },
                data: {
                    status: result.status || 'error',
                    runtimeMs: totalRuntime,
                    testResults: result.test_results || result.error,
                },
            });

            // If accepted, update user stats
            if (result.status === 'accepted') {
                const existingAccepted = await prisma.submission.findFirst({
                    where: {
                        userId: userId,
                        problemId: problem_id,
                        status: 'accepted',
                        id: { not: submission.id },
                    },
                });

                // First time solving this problem - award XP
                if (!existingAccepted) {
                    const xpReward = problem.difficulty === 'hard' ? 40 : problem.difficulty === 'medium' ? 20 : 10;

                    // Get current user XP to calculate new level
                    const currentUser = await prisma.user.findUnique({
                        where: { id: userId },
                        select: { xp: true }
                    });
                    const newTotalXP = (currentUser?.xp || 0) + xpReward;
                    const newLevel = calculateLevel(newTotalXP);

                    await prisma.user.update({
                        where: { id: userId },
                        data: {
                            xp: { increment: xpReward },
                            level: newLevel,
                            currentStreak: { increment: 1 },
                        },
                    });

                    // Log XP transaction
                    await prisma.xpTransactions.create({
                        data: {
                            id: uuidv4(),
                            userId: userId,
                            amount: xpReward,
                            reason: `Solved problem: ${problem_id}`,
                            metadata: { problemId: problem_id },
                        },
                    });
                }

                // Create/update review card for spaced repetition queue
                await scheduleReviewCard({
                    userId,
                    problemId: problem_id,
                    problemTitle: problem.title,
                });

                // Check for active LeetCode Race challenges
                const activeChallenge = await prisma.studyChallenge.findFirst({
                    where: {
                        OR: [{ challengerId: userId }, { challengedId: userId }],
                        status: 'active',
                        challengeType: 'leetcode_race',
                        targetProblemId: problem_id
                    },
                    include: {
                        challenger: { select: { id: true, name: true } },
                        challenged: { select: { id: true, name: true } }
                    }
                });

                if (activeChallenge) {
                    const winnerId = userId;
                    const loserId = activeChallenge.challengerId === userId ? activeChallenge.challengedId : activeChallenge.challengerId;
                    const stake = activeChallenge.xpStake;

                    // Complete the challenge
                    await prisma.studyChallenge.update({
                        where: { id: activeChallenge.id },
                        data: {
                            status: 'completed',
                            winnerId: winnerId,
                            endsAt: new Date() // Mark ended now
                        }
                    });

                    // Transfer Winnings (2x stake)
                    const winnings = stake * 2;

                    // Add winnings to winner
                    await prisma.user.update({
                        where: { id: winnerId },
                        data: { xp: { increment: winnings } }
                    });

                    await prisma.xpTransactions.create({
                        data: {
                            id: uuidv4(),
                            userId: winnerId,
                            amount: winnings,
                            reason: `Won LeetCode Race challenge!`
                        }
                    });

                    // Log loss for loser (0 amount since escrowed)
                    await prisma.xpTransactions.create({
                        data: {
                            id: uuidv4(),
                            userId: loserId,
                            amount: 0,
                            reason: `Lost LeetCode Race challenge`
                        }
                    });
                }
            }
        }

        return NextResponse.json({
            ...result,
            submission_id: submission?.id,
        });

    } catch (error) {
        console.error('Execution error:', error);
        return NextResponse.json(
            { error: 'Internal server error', status: 'error' },
            { status: 500 }
        );
    }
}

function getXPReward(problemId: string): number {
    // In a real app, this would look up difficulty from DB
    // For now, return a fixed amount
    return 50;
}
