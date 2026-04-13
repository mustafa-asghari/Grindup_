import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { HistoryClient } from '@/components/history/history-client';

function formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

export default async function HistoryPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    // Fetch user submissions (coding problems)
    const submissions = await prisma.submission.findMany({
        where: { userId: session.user.id },
        orderBy: { submittedAt: 'desc' },
        take: 50,
        include: {
            problem: {
                select: {
                    id: true,
                    title: true,
                    difficulty: true,
                },
            },
        },
    });

    // Fetch exercise attempts (quizzes, flashcards, etc.)
    const exerciseAttempts = await prisma.exerciseAttempt.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
            exercise: {
                select: {
                    id: true,
                    title: true,
                    type: true,
                    difficulty: true,
                    subject: {
                        select: { name: true }
                    }
                },
            },
        },
    });

    // Fetch homework submissions
    const homeworkSubmissions = await prisma.homeworkSubmissions.findMany({
        where: { userId: session.user.id },
        orderBy: { submittedAt: 'desc' },
        take: 20,
        include: {
            homeworkAssignment: {
                select: {
                    id: true,
                    title: true,
                    assignmentType: true,
                    topic: { select: { slug: true } },
                    subject: { select: { name: true, slug: true } },
                }
            }
        }
    });

    // Fetch topic progress
    const topicProgressEvents = await prisma.userTopicProgress.findMany({
        where: { userId: session.user.id, lastPracticed: { not: null } },
        orderBy: { lastPracticed: 'desc' },
        take: 20,
        include: {
            subjectTopic: {
                select: { name: true, slug: true, subject: { select: { name: true, slug: true } } }
            }
        }
    });

    // Fetch user stats
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            xp: true,
            currentStreak: true,
        },
    });

    // Combine and sort all activity
    const allActivity = [
        ...submissions.map((s: any) => ({
            id: s.id,
            type: 'submission' as const,
            title: s.problem.title,
            difficulty: s.problem.difficulty,
            status: s.status === 'accepted' ? 'accepted' as const : s.status === 'pending' || s.status === 'running' ? 'pending' as const : 'error' as const,
            timestamp: formatDate(s.submittedAt),
            rawDate: s.submittedAt,
            language: s.language,
            runtimeMs: s.runtimeMs,
            problemId: s.problemId,
        })),
        ...exerciseAttempts.map((a: any) => ({
            id: a.id,
            type: 'exercise' as const,
            title: a.exercise.title,
            difficulty: a.exercise.difficulty,
            status: a.isCorrect ? 'correct' as const : 'incorrect' as const,
            timestamp: formatDate(a.createdAt),
            rawDate: a.createdAt,
            subjectName: a.exercise.subject?.name,
            exerciseType: a.exercise.type,
            attemptId: a.id,
        })),
        ...homeworkSubmissions.map((h: any) => ({
            id: h.id,
            type: 'homework' as const,
            title: h.homeworkAssignment.title,
            difficulty: '',
            status: 'accepted' as const,
            timestamp: formatDate(h.submittedAt),
            rawDate: h.submittedAt,
            subjectName: h.homeworkAssignment.subject?.name,
            assignmentType: h.homeworkAssignment.assignmentType,
            assignmentId: h.homeworkId,
            topicSlug: h.homeworkAssignment.topic?.slug,
            subjectSlug: h.homeworkAssignment.subject?.slug,
        })),
        ...topicProgressEvents.map((t: any) => ({
            id: t.id,
            type: 'topic' as const,
            title: t.subjectTopic?.name || 'Topic Progress',
            difficulty: '',
            status: t.status === 'mastered' ? 'accepted' : 'in_progress',
            timestamp: formatDate(t.lastPracticed!),
            rawDate: t.lastPracticed!,
            subjectName: t.subjectTopic?.subject?.name,
            topicSlug: t.subjectTopic?.slug,
            subjectSlug: t.subjectTopic?.subject?.slug,
        })),
    ].sort((a, b) => {
        // Sort by raw timestamp descending
        return new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime();
    }).slice(0, 100);

    // Calculate stats
    // Note: We might want to include homework in "totalExercises" or keep separate
    // For now, keeping stats per original logic but ensuring list is full.
    const totalSubmissions = submissions.length;
    const acceptedSubmissions = submissions.filter((s: any) => s.status === 'accepted').length;
    const uniqueProblemsSolved = new Set(
        submissions.filter((s: any) => s.status === 'accepted').map((s: any) => s.problemId)
    ).size;
    const totalExercises = exerciseAttempts.length;
    const correctExercises = exerciseAttempts.filter((a: any) => a.isCorrect).length;

    return (
        <HistoryClient
            allActivity={allActivity as any[]} // weak cast to match expanded interface
            user={user}
            stats={{
                totalSubmissions,
                acceptedSubmissions,
                uniqueProblemsSolved,
                totalExercises,
                correctExercises,
            }}
        />
    );
}
