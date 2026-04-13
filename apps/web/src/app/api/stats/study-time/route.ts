
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())); // Sunday start

        // Fetch submissions for problem time estimation
        const submissions = await prisma.submission.findMany({
            where: {
                userId,
                submittedAt: { gte: startOfWeek }
            },
            include: { problem: { select: { difficulty: true } } }
        });

        // Fetch exercise attempts
        const attempts = await prisma.exerciseAttempt.findMany({
            where: {
                userId,
                createdAt: { gte: startOfWeek }
            },
            select: {
                createdAt: true,
                timeSpentSecs: true
            }
        });

        // Fetch study session events (reading time)
        const studySessions = await prisma.events.findMany({
            where: {
                userId,
                eventType: 'study_session',
                createdAt: { gte: startOfWeek }
            },
            select: {
                createdAt: true,
                payload: true
            }
        });

        const getProblemMins = (diff: string) => diff === 'easy' ? 5 : diff === 'medium' ? 10 : 15;

        // Calculate Daily
        let dailyMins = 0;
        const dailySubmissions = submissions.filter(s => new Date(s.submittedAt) >= startOfDay);
        const uniqueDailyProblems = new Set(dailySubmissions.map(s => s.problemId));
        uniqueDailyProblems.forEach(pid => {
            const sub = dailySubmissions.find(s => s.problemId === pid);
            if (sub) dailyMins += getProblemMins(sub.problem.difficulty);
        });

        const dailyAttempts = attempts.filter(a => new Date(a.createdAt) >= startOfDay);
        dailyAttempts.forEach(a => dailyMins += (a.timeSpentSecs || 60) / 60);

        // Add reading time from study sessions
        const dailySessions = studySessions.filter(s => new Date(s.createdAt) >= startOfDay);
        dailySessions.forEach(s => {
            try {
                const payload = typeof s.payload === 'string' ? JSON.parse(s.payload) : s.payload;
                dailyMins += (payload?.secondsSpent || 0) / 60;
            } catch { }
        });

        // Calculate Weekly
        let weeklyMins = 0;
        const uniqueWeeklyProblems = new Set(submissions.map(s => s.problemId));
        uniqueWeeklyProblems.forEach(pid => {
            const sub = submissions.find(s => s.problemId === pid);
            if (sub) weeklyMins += getProblemMins(sub.problem.difficulty);
        });

        attempts.forEach(a => weeklyMins += (a.timeSpentSecs || 60) / 60);

        // Add reading time from study sessions
        studySessions.forEach(s => {
            try {
                const payload = typeof s.payload === 'string' ? JSON.parse(s.payload) : s.payload;
                weeklyMins += (payload?.secondsSpent || 0) / 60;
            } catch { }
        });

        // Fetch user stats
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { xp: true, currentStreak: true, level: true, skillRating: true }
        });

        return NextResponse.json({
            dailyMins: Math.round(dailyMins),
            weeklyMins: Math.round(weeklyMins),
            dailyHours: Math.round((dailyMins / 60) * 10) / 10,
            weeklyHours: Math.round((weeklyMins / 60) * 10) / 10,
            xp: user?.xp || 0,
            streak: user?.currentStreak || 0,
            level: user?.level || 1,
            skillRating: user?.skillRating || 0
        });

    } catch (error) {
        console.error('Failed to fetch study stats:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
