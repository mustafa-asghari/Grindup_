import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Get homework assignments
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const subjectId = url.searchParams.get('subjectId');
        const topicId = url.searchParams.get('topicId');
        const includeCompleted = url.searchParams.get('includeCompleted') === 'true';
        const limit = parseInt(url.searchParams.get('limit') || '50');

        const now = new Date();

        const whereClause: any = {
            userId: session.user.id,
        };

        if (subjectId) {
            whereClause.subjectId = subjectId;
        }

        if (topicId) {
            whereClause.topicId = topicId;
        }

        if (!includeCompleted) {
            whereClause.completedAt = null;
        }

        const assignments = await prisma.homeworkAssignment.findMany({
            where: whereClause,
            orderBy: [
                { dueDate: 'asc' },
                { createdAt: 'desc' },
            ],
            take: limit,
            include: {
                subject: {
                    select: { name: true, slug: true },
                },
                topic: {
                    select: { id: true, name: true, slug: true },
                },
            },
        });

        // Process assignments to add computed fields
        const processed = assignments.map(a => {
            const dueDate = new Date(a.dueDate);
            const isLate = !a.completedAt && dueDate < now;
            const daysOverdue = isLate
                ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            // Calculate late penalty (5% per day, max 50%)
            const latePenalty = isLate ? Math.min(50, daysOverdue * 5) : 0;

            return {
                id: a.id,
                title: a.title,
                description: a.description,
                type: a.assignmentType,
                subjectId: a.subjectId,
                subjectName: a.subject?.name,
                subjectSlug: a.subject?.slug,
                topicId: a.topicId,
                topicName: a.topic?.name,
                topicSlug: a.topic?.slug,
                dueDate: a.dueDate.toISOString(),
                estimatedMins: a.estimatedMins || 30,
                isLate,
                daysOverdue,
                latePenalty,
                isCompleted: !!a.completedAt,
                completedAt: a.completedAt?.toISOString(),
                xpReward: a.xpReward,
                effectiveXp: a.xpReward ? Math.floor(a.xpReward * (1 - latePenalty / 100)) : 0,
            };
        });

        // Separate by status
        const late = processed.filter(a => a.isLate);
        const today = processed.filter(a => {
            if (a.isLate || a.isCompleted) return false;
            const due = new Date(a.dueDate);
            return due.toDateString() === now.toDateString();
        });
        const upcoming = processed.filter(a => {
            if (a.isLate || a.isCompleted) return false;
            const due = new Date(a.dueDate);
            return due > now;
        });
        const completed = processed.filter(a => a.isCompleted);

        return NextResponse.json({
            assignments: processed,
            summary: {
                late: late.length,
                today: today.length,
                upcoming: upcoming.length,
                completed: completed.length,
                totalPendingXp: [...late, ...today, ...upcoming].reduce((sum, a) => sum + a.effectiveXp, 0),
            },
        });
    } catch (error) {
        console.error('Homework fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch homework' }, { status: 500 });
    }
}

// Create homework assignment
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { subjectId, topicId, title, description, type, dueDate, estimatedMins, xpReward, relatedId } = body;

        if (!subjectId || !title || !dueDate) {
            return NextResponse.json({ error: 'Subject, title, and due date required' }, { status: 400 });
        }

        const assignment = await prisma.homeworkAssignment.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                subjectId: subjectId,
                topicId: topicId || null,
                title,
                description,
                assignmentType: type || 'general',
                dueDate: new Date(dueDate),
                estimatedMins: estimatedMins || 30,
                xpReward: xpReward || 50,
                relatedExerciseId: relatedId,
            },
        });

        // Create reminder for 24h before due date
        const reminderDate = new Date(dueDate);
        reminderDate.setHours(reminderDate.getHours() - 24);

        if (reminderDate > new Date()) {
            await prisma.homeworkReminders.create({
                data: {
                    id: uuidv4(),
                    homeworkId: assignment.id,
                    reminderType: 'before_due',
                    scheduledFor: reminderDate,
                },
            });
        }

        return NextResponse.json({
            success: true,
            assignment: {
                id: assignment.id,
                title: assignment.title,
                dueDate: assignment.dueDate.toISOString(),
            },
        });
    } catch (error) {
        console.error('Homework create error:', error);
        return NextResponse.json({ error: 'Failed to create homework' }, { status: 500 });
    }
}

// Mark assignment as complete
export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { assignmentId, action } = body;

        if (!assignmentId) {
            return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });
        }

        const assignment = await prisma.homeworkAssignment.findFirst({
            where: {
                id: assignmentId,
                userId: session.user.id,
            },
        });

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        if (action === 'complete') {
            const now = new Date();
            const dueDate = new Date(assignment.dueDate);
            const isLate = dueDate < now;
            const daysLate = isLate
                ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                : 0;
            const latePenalty = Math.min(50, daysLate * 5);
            const effectiveXp = Math.floor((assignment.xpReward || 0) * (1 - latePenalty / 100));

            // Update assignment
            await prisma.homeworkAssignment.update({
                where: { id: assignmentId },
                data: {
                    completedAt: now,
                    lateDays: daysLate,
                    effectiveXpEarned: effectiveXp,
                },
            });

            // Award XP
            if (effectiveXp > 0) {
                await prisma.user.update({
                    where: { id: session.user.id },
                    data: { xp: { increment: effectiveXp } },
                });

                await prisma.xpTransactions.create({
                    data: {
                        id: uuidv4(),
                        userId: session.user.id,
                        amount: effectiveXp,
                        reason: isLate
                            ? `Homework completed (${latePenalty}% late penalty)`
                            : 'Homework completed on time',
                        metadata: { assignmentId, latePenalty },
                    },
                });
            }


            // Update Streak Logic
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
                        id: uuidv4(),
                        userId: session.user.id,
                        date: today,
                        streakMaintained: true,
                        exercisesCompleted: 1, // Treating homework as exercise for stats
                        xpEarned: effectiveXp
                    }
                });
            } else {
                // Update existing snapshot
                await prisma.dailySnapshots.update({
                    where: { userId_date: { userId: session.user.id, date: today } },
                    data: {
                        exercisesCompleted: { increment: 1 },
                        xpEarned: { increment: effectiveXp }
                    }
                });
            }

            // Log late penalty if applicable
            if (isLate) {
                await prisma.latePenalties.create({
                    data: {
                        id: uuidv4(),
                        userId: session.user.id,
                        homeworkId: assignmentId,
                        penaltyType: 'extra_reviews',
                        daysLate: daysLate,
                        penaltyPercent: latePenalty,
                        originalXp: assignment.xpReward || 0,
                        effectiveXp: effectiveXp,
                        applied: true,
                        appliedAt: now,
                    },
                });
            }

            return NextResponse.json({
                success: true,
                xpEarned: effectiveXp,
                wasLate: isLate,
                latePenalty: isLate ? latePenalty : 0,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Homework update error:', error);
        return NextResponse.json({ error: 'Failed to update homework' }, { status: 500 });
    }
}
