import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AnalyticsClient } from './analytics-client';

export default async function AnalyticsPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    // Fetch activity data for heatmap
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    let activities: { date: Date }[] = [];
    let submissions: { submittedAt: Date }[] = [];
    let exercises: { createdAt: Date }[] = [];
    let homeworks: { completedAt: Date | null }[] = [];
    let topicProgress: any[] = [];

    try {
        // Try to fetch from user_activities (new table)
        activities = await prisma.userActivities.findMany({
            where: {
                userId: session.user.id,
                date: { gte: startDate },
            },
            select: { date: true },
        });
    } catch (e) {
        console.log('user_activities not available, using fallback');
    }

    try {
        // Get user's enrolled subjects first
        const enrolledSubjects = await prisma.userSubject.findMany({
            where: { userId: session.user.id },
            select: { subjectId: true }
        });
        const enrolledSubjectIds = enrolledSubjects.map(e => e.subjectId);

        [submissions, exercises, homeworks, topicProgress] = await Promise.all([
            prisma.submission.findMany({
                where: {
                    userId: session.user.id,
                    submittedAt: { gte: startDate },
                },
                select: { submittedAt: true },
            }),
            prisma.exerciseAttempt.findMany({
                where: {
                    userId: session.user.id,
                    createdAt: { gte: startDate },
                },
                select: { createdAt: true },
            }),
            prisma.homeworkAssignment.findMany({
                where: {
                    userId: session.user.id,
                    completedAt: { gte: startDate },
                },
                select: { completedAt: true },
            }),
            // Fetch topic progress for ALL enrolled subjects (not just top 8)
            prisma.userTopicProgress.findMany({
                where: {
                    userId: session.user.id,
                    // Only get topics from subjects user is enrolled in
                    subjectTopic: enrolledSubjectIds.length > 0 ? {
                        subjectId: { in: enrolledSubjectIds }
                    } : undefined
                },
                orderBy: { masteryPercent: 'desc' },
                include: {
                    subjectTopic: {
                        select: {
                            name: true,
                            subjectId: true,
                            subject: { select: { name: true } }
                        }
                    }
                }
            }),
        ]);
    } catch (e) {
        console.error('Error fetching analytics data:', e);
    }   

    // Aggregate heatmap data
    const dateMap = new Map<string, number>();



    // Helper for local date string YYYY-MM-DD
    const toLocalYMD = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    activities.forEach(a => {
        const dateStr = toLocalYMD(new Date(a.date));
        dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    });

    submissions.forEach(s => {
        const dateStr = toLocalYMD(new Date(s.submittedAt));
        dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    });

    exercises.forEach(e => {
        const dateStr = toLocalYMD(new Date(e.createdAt));
        dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    });

    homeworks.forEach(h => {
        if (h.completedAt) {
            const dateStr = toLocalYMD(new Date(h.completedAt));
            dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
        }
    });

    const heatmapData = Array.from(dateMap.entries()).map(([date, count]) => ({
        date,
        count,
    }));

    // Prepare radar data - get ALL main topics (level 0) from enrolled subjects
    // This ensures we show topics user is studying, not just those with progress
    let allMainTopics: { name: string; subjectName: string; masteryPercent: number }[] = [];

    try {
        // Get user's enrolled subjects with their main topics (level 0)
        const enrolledSubjectsWithTopics = await prisma.userSubject.findMany({
            where: { userId: session.user.id },
            include: {
                subject: {
                    include: {
                        topics: {
                            where: { level: 0 }, // Only main topics, not subtopics
                            orderBy: { order: 'asc' },
                            select: {
                                id: true,
                                name: true,
                            }
                        }
                    }
                }
            }
        });

        // Create a map of topic progress for quick lookup
        const progressMap = new Map(
            topicProgress.map((tp: any) => [tp.subjectTopicId, tp.masteryPercent || 0])
        );

        // Build the radar data from all enrolled topics
        for (const enrollment of enrolledSubjectsWithTopics) {
            const subjectName = enrollment.subject.name;
            for (const topic of enrollment.subject.topics) {
                allMainTopics.push({
                    name: topic.name,
                    subjectName,
                    masteryPercent: progressMap.get(topic.id) || 0,
                });
            }
        }
    } catch (e) {
        console.error('Error fetching enrolled topics:', e);
    }

    // Take up to 12 topics for the radar chart, prioritizing ones with progress
    // Sort by mastery so we show a mix of strengths and weaknesses
    const sortedTopics = allMainTopics.sort((a, b) => {
        // Prioritize topics with some progress
        if (a.masteryPercent > 0 && b.masteryPercent === 0) return -1;
        if (b.masteryPercent > 0 && a.masteryPercent === 0) return 1;
        return b.masteryPercent - a.masteryPercent;
    });

    const radarData = sortedTopics.slice(0, 12).map((topic) => {
        // Distinguish identical topic names by appending subject name if needed
        const hasDuplicate = sortedTopics.filter(t => t.name === topic.name).length > 1;
        const displayName = hasDuplicate ? `${topic.name} (${topic.subjectName})` : topic.name;

        return {
            topic: displayName,
            mastery: topic.masteryPercent,
        };
    });


    // Calculate overall stats
    let totalProblems = 0;
    let totalExercises = 0;

    try {
        totalProblems = await prisma.submission.count({
            where: { userId: session.user.id, status: 'accepted' },
        });

        totalExercises = await prisma.exerciseAttempt.count({
            where: { userId: session.user.id, isCorrect: true },
        });
    } catch (e) {
        console.error('Error counting stats:', e);
    }

    // Calculate study stats
    let dailyMins = 0;
    let weeklyMins = 0;

    const oneDayAgo = new Date();
    oneDayAgo.setHours(0, 0, 0, 0);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Fetch exercises for stats
    const recentExercises = await prisma.exerciseAttempt.findMany({
        where: {
            userId: session.user.id,
            createdAt: { gte: oneWeekAgo },
        },
        select: {
            createdAt: true,
            timeSpentSecs: true,
        },
    });

    recentExercises.forEach(ex => {
        const mins = (ex.timeSpentSecs || 60) / 60; // Default 1 min if null
        weeklyMins += mins;
        if (new Date(ex.createdAt) >= oneDayAgo) {
            dailyMins += mins;
        }
    });

    const dailyHoursCompleted = Math.round((dailyMins / 60) * 10) / 10;
    const weeklyHoursCompleted = Math.round((weeklyMins / 60) * 10) / 10;

    const streakDays = await calculateStreak(session.user.id);

    return (
        <AnalyticsClient
            heatmapData={heatmapData}
            radarData={radarData}
            stats={{
                totalProblems,
                totalExercises,
                streakDays,
                topicsInProgress: topicProgress.length,
            }}
            studyStats={{
                dailyGoal: 2, // Default, will be overridden by client state if saved
                dailyCompleted: dailyHoursCompleted,
                weeklyGoal: 10,
                weeklyCompleted: weeklyHoursCompleted
            }}
        />
    );
}

async function calculateStreak(userId: string): Promise<number> {
    // Get streak from user table
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { currentStreak: true },
        });
        return user?.currentStreak || 0;
    } catch (e) {
        return 0;
    }
}
