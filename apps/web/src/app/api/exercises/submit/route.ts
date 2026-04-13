import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { ExerciseData, McqContent } from '@/lib/exercise-types';
import { calculateSM2, INITIAL_SM2_STATE } from '@/lib/sm2';
import { calculateLevel } from '@/lib/level-utils';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { exerciseId, response, timeSpentSecs, hintsUsed } = await request.json();

        if (!exerciseId || response === undefined) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const exercise = await prisma.exercise.findUnique({
            where: { id: exerciseId },
            include: { subject: true }
        });

        if (!exercise) {
            return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
        }

        let isCorrect = false;
        let score = 0;
        let feedback = '';
        let sm2Quality = 0; // 0-5 for SM2

        // Validation Logic
        if (exercise.type === 'mcq') {
            const content = exercise.content as unknown as McqContent;
            const userSelected = (response.selectedIndices as number[] || []).sort().join(',');
            const correct = (content.correctAnswers || []).sort().join(',');

            isCorrect = userSelected === correct;
            score = isCorrect ? exercise.points : 0;
            // Deduct points for hints? Optional.
        }
        else if (exercise.type === 'flashcard') {
            // Self-rated: 'AGAIN', 'HARD', 'GOOD', 'EASY'
            // Always "correct" if submitted, but score depends on rating
            isCorrect = true;
            const rating = response.rating as string;
            switch (rating) {
                case 'EASY': score = exercise.points; sm2Quality = 5; break;
                case 'GOOD': score = Math.floor(exercise.points * 0.8); sm2Quality = 4; break;
                case 'HARD': score = Math.floor(exercise.points * 0.5); sm2Quality = 3; break;
                case 'AGAIN': score = 0; isCorrect = false; sm2Quality = 1; break; // Failed recall
                default: score = 0; sm2Quality = 0;
            }
        }
        else {
            // Default fallback for manual/client validated
            isCorrect = true;
            score = exercise.points;
        }

        // Save Attempt
        const attempt = await prisma.exerciseAttempt.create({
            data: {
                id: crypto.randomUUID(),
                userId: session.user.id,
                exerciseId,
                response: response as any,
                isCorrect,
                score,
                feedback,
                timeSpentSecs: timeSpentSecs || 0,
                hintsUsed: hintsUsed || 0,
            }
        });

        // ======================================
        // Spaced Repetition (Flashcards)
        // ======================================
        if (exercise.type === 'flashcard' && session.user.id) {
            // Find existing card using JSON filter
            // Assuming we store { exerciseId: ... } in content for mapping
            const existingCard = await prisma.reviewCards.findFirst({
                where: {
                    userId: session.user.id,
                    content: {
                        path: ['exerciseId'],
                        equals: exerciseId
                    }
                }
            });

            const currentState = existingCard ? {
                easeFactor: existingCard.easeFactor,
                intervalDays: existingCard.intervalDays,
                repetitions: existingCard.repetitions
            } : INITIAL_SM2_STATE;

            const nextState = calculateSM2(sm2Quality, currentState);

            const nextReview = new Date();
            nextReview.setDate(nextReview.getDate() + nextState.intervalDays);

            if (existingCard) {
                await prisma.reviewCards.update({
                    where: { id: existingCard.id },
                    data: {
                        easeFactor: nextState.easeFactor,
                        intervalDays: nextState.intervalDays,
                        repetitions: nextState.repetitions,
                        nextReview
                    }
                });
            } else {
                await prisma.reviewCards.create({
                    data: {
                        id: crypto.randomUUID(),
                        userId: session.user.id,
                        topicId: exercise.topicId,
                        cardType: 'concept', // Default for flashcards
                        content: { exerciseId: exercise.id, front: (exercise.content as any).front }, // Store link
                        easeFactor: nextState.easeFactor,
                        intervalDays: nextState.intervalDays,
                        repetitions: nextState.repetitions,
                        nextReview
                    }
                });
            }
        }

        // Update User Progress (XP, Stats)
        // 1. Update User Subject Enrollment
        if (exercise.subjectId) {
            const enrollment = await prisma.userSubject.findUnique({
                where: {
                    userId_subjectId: { userId: session.user.id, subjectId: exercise.subjectId }
                }
            });

            if (enrollment) {
                await prisma.userSubject.update({
                    where: { id: enrollment.id },
                    data: {
                        xpEarned: { increment: score },
                        exercisesCompleted: { increment: 1 },
                        lastAccessedAt: new Date(),
                        // Streak update logic could go here too
                    }
                });
            }
        }

        // 2. Update Topic Progress (if tied to topic)
        if (exercise.topicId) {
            // Calculate new mastery based on correctness weight
            // Simple logic: if correct, boost mastery.
            // ... (Simple increment for now)
            const progress = await prisma.userTopicProgress.findUnique({
                where: { userId_topicId: { userId: session.user.id, topicId: exercise.topicId } }
            });

            if (progress) {
                const current = progress.masteryPercent;
                const boost = isCorrect ? 5 : -2; // +5% or -2%
                const newMastery = Math.min(100, Math.max(0, current + boost));

                await prisma.userTopicProgress.update({
                    where: { id: progress.id },
                    data: {
                        masteryPercent: newMastery,
                        lastPracticed: new Date(),
                        status: newMastery >= 90 ? 'mastered' : progress.status
                    }
                });
            } else {
                // Create initial progress
                await prisma.userTopicProgress.create({
                    data: {
                        id: crypto.randomUUID(),
                        userId: session.user.id,
                        topicId: exercise.topicId,
                        masteryPercent: isCorrect ? 10 : 0,
                        status: 'in_progress',
                        lastPracticed: new Date()
                    }
                });
            }
        }

        // 3. Update Global User XP, Level, and Streak
        if (score > 0) {
            // Get current user to calculate new level
            const currentUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { xp: true, level: true }
            });

            const newTotalXP = (currentUser?.xp || 0) + score;
            const newLevel = calculateLevel(newTotalXP);

            // Update User XP and Level
            await prisma.user.update({
                where: { id: session.user.id },
                data: {
                    xp: { increment: score },
                    level: newLevel
                }
            });

            // Create XP Transaction
            await prisma.xpTransactions.create({
                data: {
                    id: crypto.randomUUID(),
                    userId: session.user.id,
                    amount: score,
                    reason: `Exercise completed: ${exercise.title}`,
                    metadata: { exerciseId, attemptId: attempt.id }
                }
            });
        }

        // Update Streak Logic (Daily Snapshot)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingSnapshot = await prisma.dailySnapshots.findUnique({
            where: { userId_date: { userId: session.user.id, date: today } }
        });

        if (!existingSnapshot) {
            // Check yesterday for streak continuity
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const yesterdaySnapshot = await prisma.dailySnapshots.findUnique({
                where: { userId_date: { userId: session.user.id, date: yesterday } }
            });

            // New streak value
            const updateData = yesterdaySnapshot
                ? { currentStreak: { increment: 1 } }
                : { currentStreak: 1 };

            // Update User Streak
            await prisma.user.update({
                where: { id: session.user.id },
                data: updateData
            });

            // Create Today's Snapshot
            await prisma.dailySnapshots.create({
                data: {
                    id: crypto.randomUUID(),
                    userId: session.user.id,
                    date: today,
                    streakMaintained: true,
                    exercisesCompleted: 1,
                    xpEarned: score
                }
            });
        } else {
            // Update existing snapshot
            await prisma.dailySnapshots.update({
                where: { userId_date: { userId: session.user.id, date: today } },
                data: {
                    exercisesCompleted: { increment: 1 },
                    xpEarned: { increment: score }
                }
            });
        }

        // Check for Badges
        // const newBadges = await checkAndAwardBadges(session.user.id);
        const newBadges: any[] = [];

        return NextResponse.json({
            success: true,
            isCorrect,
            score,
            attemptId: attempt.id,
            newBadges
        });

    } catch (error) {
        console.error('Submission failed:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
