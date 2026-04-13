import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { SubjectDashboardClient } from '@/components/subjects/subject-dashboard-client';
import { AppShell } from '@/components/layout/app-shell';

interface PageProps {
    params: Promise<{ slug: string }>;
}
// ... (rest of imports)

export async function generateMetadata({ params }: PageProps) {
    const { slug } = await params;
    const subject = await prisma.subject.findUnique({
        where: { slug },
        select: { name: true, description: true },
    });

    if (!subject) {
        return { title: 'Subject Not Found | GrindUp' };
    }

    return {
        title: `${subject.name} | GrindUp`,
        description: subject.description || `Learn ${subject.name} with GrindUp`,
    };
}

export default async function SubjectPage({ params }: PageProps) {
    const { slug } = await params;
    const session = await auth();
    const userId = session?.user?.id;

    // Fetch subject with nested topics
    const subject = await prisma.subject.findUnique({
        where: { slug, isActive: true },
        include: {
            topics: {
                where: { parentId: null },
                orderBy: { order: 'asc' },
                include: {
                    otherSubjecttopic: {
                        orderBy: { order: 'asc' },
                        include: {
                            otherSubjecttopic: {
                                orderBy: { order: 'asc' },
                                include: {
                                    _count: {
                                        select: { exercise: true },
                                    },
                                },
                            },
                            _count: {
                                select: { exercise: true },
                            },
                        },
                    },
                    _count: {
                        select: { exercise: true },
                    },
                },
            },
            _count: {
                select: {
                    exercises: true,
                    userSubjects: true,
                    topics: true,
                },
            },
        },
    });

    if (!subject) {
        notFound();
    }

    // Check if user is enrolled
    let enrollment = null;
    let topicProgress: Record<string, { masteryPercent: number; status: string }> = {};
    let recentExercises: any[] = [];
    let flashcards: any[] = [];

    if (userId) {
        enrollment = await prisma.userSubject.findUnique({
            where: {
                userId_subjectId: {
                    userId: userId,
                    subjectId: subject.id,
                },
            },
        });

        // Get topic progress
        const progressRecords = await prisma.userTopicProgress.findMany({
            where: {
                userId: userId,
                subjectTopic: {
                    subjectId: subject.id,
                },
            },
            select: {
                topicId: true,
                masteryPercent: true,
                status: true,
            },
        });

        topicProgress = progressRecords.reduce((acc: any, p: any) => { // Fix 'any' type error
            acc[p.topicId] = { masteryPercent: p.masteryPercent, status: p.status };
            return acc;
        }, {} as Record<string, { masteryPercent: number; status: string }>);

        // Get recent exercise attempts
        recentExercises = await prisma.exerciseAttempt.findMany({
            where: {
                userId: userId,
                exercise: {
                    subjectId: subject.id,
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                exercise: {
                    select: {
                        id: true,
                        title: true,
                        type: true,
                        difficulty: true,
                    },
                },
            },
        });

        // Get flashcards (Exercises of type 'flashcard')
        flashcards = await prisma.exercise.findMany({
            where: {
                subjectId: subject.id,
                type: 'flashcard'
            },
            include: {
                topic: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    // Fetch homework assignments for all topics in this subject
    let topicHomework: Record<string, { isCompleted: boolean; id: string } | null> = {};
    if (userId) {
        const homeworkAssignments = await prisma.homeworkAssignment.findMany({
            where: {
                userId: userId,
                subjectId: subject.id,
                topicId: { not: null },
            },
            select: {
                topicId: true,
                isCompleted: true,
                id: true,
            },
        });
        topicHomework = homeworkAssignments.reduce((acc: any, hw: any) => {
            if (hw.topicId) {
                acc[hw.topicId] = { isCompleted: hw.isCompleted, id: hw.id };
            }
            return acc;
        }, {});
    }

    // Fetch Global User Stats
    let userStats = { streak: 0, xp: 0, level: 1 };
    let displayName = '';
    let displayInitial = '';

    if (userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { xp: true, currentStreak: true, level: true, name: true }
        });
        if (user) {
            userStats = {
                streak: user.currentStreak,
                xp: user.xp,
                level: user.level
            };
            displayName = user.name || 'User';
            displayInitial = user.name?.[0]?.toUpperCase() || 'U';
        }
    }

    // Calculate overall stats
    const totalExercises = subject._count.exercises;
    const completedExercises = enrollment?.exercisesCompleted || 0;
    // progressPercent is in enrollment

    // Transform topics for client with unlock status
    const transformTopic = (topic: any, index: number, siblings: any[], parentUnlocked: boolean = true): any => {
        // Unlock logic is scoped to siblings: each topic unlocks after the previous sibling is mastered or its homework is done.
        const previousSibling = index > 0 ? siblings[index - 1] : null;
        const previousHomework = previousSibling ? topicHomework[previousSibling.id] : null;
        const prevProgress = previousSibling ? topicProgress[previousSibling.id] : null;
        const isPreviousMastered = prevProgress?.status === 'mastered';
        const isPreviousCompleted = !previousSibling || previousHomework?.isCompleted === true || isPreviousMastered;
        const isUnlocked = true; // TEMPORARY UNLOCK: Always true for now as requested.
        // const isUnlocked = parentUnlocked && (index === 0 || isPreviousCompleted);

        return {
            id: topic.id,
            name: topic.name,
            slug: topic.slug,
            description: topic.description,
            icon: topic.icon,
            exerciseCount: topic._count?.exercise || 0,
            progress: topicProgress[topic.id] || { masteryPercent: 0, status: 'not_started' },
            homework: topicHomework[topic.id] || null,
            isUnlocked,
            children: topic.otherSubjecttopic?.map((child: any, childIdx: number) =>
                transformTopic(child, childIdx, topic.otherSubjecttopic || [], isUnlocked)
            ) || [],
        };
    };

    const subjectData = {
        id: subject.id,
        name: subject.name,
        slug: subject.slug,
        description: subject.description,
        icon: subject.icon,
        color: subject.color,
        category: subject.category,
        estimatedHours: subject.estimatedHours,
        difficultyLevel: subject.difficultyLevel,
        exerciseTypes: subject.exerciseTypes,
        enrollmentCount: subject._count.userSubjects,
        totalExercises,
        topicCount: subject._count.topics,
    };

    const enrollmentData = enrollment ? {
        enrolledAt: enrollment.enrolledAt.toISOString(),
        lastAccessedAt: enrollment.lastAccessedAt.toISOString(),
        status: enrollment.status,
        progressPercent: enrollment.progressPercent,
        xpEarned: enrollment.xpEarned,
        streak: enrollment.streak,
        totalTimeSpent: enrollment.totalTimeSpent,
        exercisesCompleted: enrollment.exercisesCompleted,
        goalHoursPerWeek: enrollment.goalHoursPerWeek,
        targetDeadline: enrollment.targetDeadline?.toISOString() || null,
    } : null;

    const topicsData = subject.topics.map((topic: any, index: number) => transformTopic(topic, index, subject.topics, true));

    const recentExercisesData = recentExercises.map(attempt => ({
        id: attempt.id,
        exerciseId: attempt.exercise.id,
        exerciseTitle: attempt.exercise.title,
        exerciseType: attempt.exercise.type,
        difficulty: attempt.exercise.difficulty,
        isCorrect: attempt.isCorrect,
        score: attempt.score,
        createdAt: attempt.createdAt.toISOString(),
    }));

    // Fetch Learning Contract
    let learningContractData: any = null;
    if (userId && subject) {
        try {
            const contract = await prisma.learningContracts.findFirst({
                where: {
                    userId,
                    subjectId: subject.id,
                    isActive: true,
                },
                orderBy: { signedAt: 'desc' },
            });

            if (contract) {
                learningContractData = {
                    id: contract.id,
                    weeklyHoursCommitment: contract.weeklyHoursCommitment,
                    targetCompletionDate: contract.targetCompletionDate?.toISOString(),
                    goals: contract.goals,
                    signedAt: contract.signedAt.toISOString(),
                };
            }
        } catch (e) {
            console.error('Failed to fetch learning contract', e);
        }
    }

    return (
        <AppShell
            isLoggedIn={!!session}
            userStats={userStats}
            displayName={displayName}
            displayInitial={displayInitial}
        >
            <SubjectDashboardClient
                subject={subjectData}
                enrollment={enrollmentData}
                topics={topicsData}
                recentExercises={recentExercisesData}
                learningContract={learningContractData}
                isLoggedIn={!!session}
                userId={userId || null}
                userStats={userStats}
                displayName={displayName}
                displayInitial={displayInitial}
                flashcards={flashcards}
            />
        </AppShell>
    );
}
