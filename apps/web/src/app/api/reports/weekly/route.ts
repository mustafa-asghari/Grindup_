import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Get weekly learning report
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const weekOffset = parseInt(url.searchParams.get('weekOffset') || '0');

        // Calculate week boundaries
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() - (weekOffset * 7));
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Generate report on-the-fly
        const report = await generateWeeklyReport(session.user.id, weekStart, weekEnd);

        return NextResponse.json({
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString(),
            ...report,
        });
    } catch (error) {
        console.error('Weekly report error:', error);
        // Return empty report instead of error
        return NextResponse.json({
            weekStart: new Date().toISOString(),
            weekEnd: new Date().toISOString(),
            totalMinutes: 0,
            problemsSolved: 0,
            exercisesCompleted: 0,
            topicsImproved: [],
            weakAreas: [],
            recommendations: ['Start practicing to generate your first weekly report!'],
            metaInsights: null,
            error: 'Unable to generate report',
        });
    }
}

async function generateWeeklyReport(userId: string, weekStart: Date, weekEnd: Date) {
    // Get submissions this week
    const submissions = await prisma.submission.findMany({
        where: {
            userId: userId,
            submittedAt: { gte: weekStart, lte: weekEnd },
        },
        include: {
            problem: {
                include: {
                    topics: {
                        include: { topic: true },
                    },
                },
            },
        },
    });

    // Get unique problems solved
    const uniqueProblems = new Set(
        submissions
            .filter(s => s.status === 'accepted')
            .map(s => s.problemId)
    );

    // Get exercise attempts this week
    const exercises = await prisma.exerciseAttempt.findMany({
        where: {
            userId: userId,
            createdAt: { gte: weekStart, lte: weekEnd },
        },
    });

    const completedExercises = exercises.filter(e => e.isCorrect === true);

    // Calculate total time
    const totalMinutes = exercises.reduce((sum, e) => sum + (e.timeSpentSecs || 60) / 60, 0);

    // Get topic progress
    const topicProgress = await prisma.userTopicProgress.findMany({
        where: { userId: userId },
        include: {
            subjectTopic: {
                include: { subject: true }
            }
        },
        orderBy: { masteryPercent: 'asc' },
    });

    // Identify weak areas (mastery < 50%)
    const weakAreas = topicProgress
        .filter(t => t.masteryPercent < 50)
        .slice(0, 5)
        .map(t => {
            const topicName = t.subjectTopic?.name || 'Unknown';
            // @ts-ignore
            const subjectName = t.subjectTopic?.subject?.name;
            return {
                topic: subjectName ? `${topicName} (${subjectName})` : topicName,
                mastery: t.masteryPercent,
            };
        });

    // Identify improved topics (any with recent activity)
    const topicsImproved = topicProgress
        .filter(t => t.lastPracticed && new Date(t.lastPracticed) >= weekStart)
        .map(t => {
            const topicName = t.subjectTopic?.name || 'Unknown';
            // @ts-ignore
            const subjectName = t.subjectTopic?.subject?.name;
            return subjectName ? `${topicName} (${subjectName})` : topicName;
        });

    // Generate recommendations based on data
    const recommendations = generateRecommendations(
        Math.round(totalMinutes),
        uniqueProblems.size,
        completedExercises.length,
        weakAreas
    );

    // Meta insights (simple heuristics for now)
    const metaInsights = generateMetaInsights(exercises);

    return {
        totalMinutes: Math.round(totalMinutes),
        problemsSolved: uniqueProblems.size,
        exercisesCompleted: completedExercises.length,
        topicsImproved,
        weakAreas,
        recommendations,
        metaInsights,
    };
}

function generateRecommendations(
    totalMinutes: number,
    problemsSolved: number,
    exercisesCompleted: number,
    weakAreas: { topic: string; mastery: number }[]
) {
    const recommendations: string[] = [];

    if (totalMinutes < 120) {
        recommendations.push('Try to spend at least 2 hours studying this week for steady progress.');
    }

    if (problemsSolved < 3) {
        recommendations.push('Aim for at least 3 problems per week to build problem-solving skills.');
    }

    if (weakAreas.length > 0) {
        const weakestTopic = weakAreas[0].topic;
        recommendations.push(`Focus on "${weakestTopic}" - it could use some extra practice.`);
    }

    if (exercisesCompleted > 10) {
        recommendations.push('Great exercise completion! Consider challenging yourself with harder problems.');
    }

    if (recommendations.length === 0) {
        recommendations.push('Keep up the great work! You\'re making excellent progress.');
    }

    return recommendations;
}

function generateMetaInsights(exercises: any[]) {
    if (exercises.length === 0) {
        return null;
    }

    // Analyze when user is most active
    const hourCounts: Record<number, number> = {};

    exercises.forEach(e => {
        const hour = new Date(e.createdAt).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const sortedHours = Object.entries(hourCounts).sort(([, a], [, b]) => b - a);

    if (sortedHours.length === 0) {
        return null;
    }

    const [hour] = sortedHours[0];
    const hourNum = parseInt(hour);

    if (hourNum < 12) {
        return 'You seem to study best in the morning. Keep up the early bird habit!';
    } else if (hourNum < 17) {
        return 'Afternoon study sessions work well for you.';
    } else {
        return 'You\'re most productive in the evening. Consider protecting this time for focused work.';
    }
}
