'use client';

import Link from 'next/link';
import {
    Play,
    BookOpen,
    CheckCircle2,
    Clock,
    Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLiveStats } from '@/hooks/use-live-stats';
import { ProgressRing } from '@/components/dashboard/progress-rings';
import { useStudyGoals } from '@/hooks/use-study-goals';

type EnrolledSubject = {
    id: string;
    name: string;
    slug: string;
    progressPercent: number;
    icon?: string | null;
    color?: string | null;
    category?: string | null;
    estimatedHours?: number | null;
    xpEarned?: number | null;
    streak?: number | null;
    lastAccessedAt?: string | null;
    topics?: string[];
};

type ActivityItem = {
    title: string;
    time: string;
    status?: 'accepted' | 'wrong_answer' | string;
    difficulty?: 'easy' | 'medium' | 'hard' | string;
};

type HomeworkItem = {
    id: string;
    title: string;
    subjectName?: string;
    subjectSlug?: string;
    topicSlug?: string;
    topicName?: string;
    estimatedMins: number;
    type?: 'exercise' | 'problem' | 'reading' | 'general';
    isLate: boolean;
    isCompleted?: boolean;
    latePenalty?: number;
};

interface HomeDashboardProps {
    displayName: string;
    enrolledSubjects: EnrolledSubject[];
    recentActivity: ActivityItem[];
    homeworkQueue: HomeworkItem[];
    studyStats: {
        dailyGoal: number;
        dailyCompleted: number;
        weeklyGoal: number;
        weeklyCompleted: number;
    };
}

export function HomeDashboard({
    displayName,
    enrolledSubjects,
    recentActivity,
    homeworkQueue,
    studyStats
}: HomeDashboardProps) {
    const firstName = displayName.split(' ')[0];
    const lastSubject = enrolledSubjects.length > 0 ? enrolledSubjects[0] : null;

    // Use live stats to update study time dynamically
    const liveStats = useLiveStats({
        dailyHours: studyStats.dailyCompleted,
        weeklyHours: studyStats.weeklyCompleted,
        xp: 0,
        streak: 0
    });

    const { goals } = useStudyGoals({ daily: studyStats.dailyGoal, weekly: studyStats.weeklyGoal });
    const currentDaily = liveStats.dailyHours;
    const dailyGoal = goals.daily || studyStats.dailyGoal || 1;
    const weeklyGoal = goals.weekly || studyStats.weeklyGoal || 1;
    const dailyProgress = Math.min((currentDaily / dailyGoal) * 100, 100);
    const weeklyProgress = Math.min((liveStats.weeklyHours / weeklyGoal) * 100, 100);

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                    Good Morning, {firstName}
                </h1>
                <p className="text-muted-foreground">
                    Ready to continue your learning journey?
                </p>
            </div>

            {/* Main Action Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Resume Learning Card (Span 2) */}
                <Card className="md:col-span-2 bg-gradient-to-br from-indigo-900/20 to-zinc-900 border-indigo-500/20">
                    <CardHeader>
                        <CardDescription className="text-indigo-400 font-medium">Continue Learning</CardDescription>
                        <CardTitle className="text-xl">
                            {lastSubject ? lastSubject.name : "Get Started"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-4">
                            {lastSubject ? (
                                <>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Progress</span>
                                            <span className="font-medium">{Math.round(lastSubject.progressPercent)}%</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-zinc-800">
                                            <div
                                                className="h-full rounded-full bg-indigo-500"
                                                style={{ width: `${lastSubject.progressPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Link href={`/subjects/${lastSubject.slug}`}>
                                            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                                                <Play className="h-4 w-4" />
                                                Resume
                                            </Button>
                                        </Link>
                                        <Link href="/subjects">
                                            <Button variant="outline">View All Subjects</Button>
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <div className="flex gap-3">
                                    <Link href="/subjects">
                                        <Button className="bg-indigo-600 text-white">Browse Subjects</Button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Daily Goals Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Target className="h-5 w-5 text-emerald-500" />
                            Daily Goal
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mt-4 flex flex-col items-center justify-center gap-4">
                            <ProgressRing progress={dailyProgress} size={140} strokeWidth={10} color="#22c55e" bgColor="#1f2937">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{currentDaily.toFixed(1)}h</div>
                                    <div className="text-xs text-muted-foreground">/ {dailyGoal}h Today</div>
                                </div>
                            </ProgressRing>
                            <ProgressRing progress={weeklyProgress} size={120} strokeWidth={8} color="#eab308" bgColor="#1f2937">
                                <div className="text-center">
                                    <div className="text-lg font-semibold text-white">{liveStats.weeklyHours.toFixed(1)}h</div>
                                    <div className="text-[11px] text-muted-foreground">/ {weeklyGoal}h This Week</div>
                                </div>
                            </ProgressRing>
                            <p className="text-center text-sm text-muted-foreground">
                                {currentDaily >= dailyGoal
                                    ? "Daily goal reached! Great job!"
                                    : `${(dailyGoal - currentDaily).toFixed(1)}h remaining today`}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Two Column Layout: Homework & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Due Tasks */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Clock className="h-5 w-5 text-orange-500" />
                            Up Next
                        </h2>
                        <Link
                            href={homeworkQueue[0]?.subjectSlug ? `/subjects/${homeworkQueue[0].subjectSlug}` : '/review'}
                            className="text-sm text-indigo-400 hover:text-indigo-300"
                        >
                            View all
                        </Link>
                    </div>
                    {homeworkQueue.length > 0 ? (
                        <div className="space-y-3">
                            {homeworkQueue.slice(0, 3).map((task) => (
                                <div key={task.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-zinc-900 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "h-2 w-2 rounded-full",
                                            task.isLate ? "bg-red-500" : "bg-orange-500"
                                        )} />
                                        <div>
                                            <p className="font-medium text-sm">{task.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {task.subjectName || 'Subject'}{task.topicName ? ` • ${task.topicName}` : ''} • {task.estimatedMins} min
                                            </p>
                                        </div>
                                    </div>
                                    {task.subjectSlug ? (
                                        <Link
                                            href={task.topicSlug
                                                ? `/subjects/${task.subjectSlug}/topics/${task.topicSlug}`
                                                : `/subjects/${task.subjectSlug}`
                                            }
                                        >
                                            <Button size="sm" variant="ghost" className="h-8">
                                                Start
                                            </Button>
                                        </Link>
                                    ) : (
                                        <Button size="sm" variant="ghost" className="h-8" disabled>
                                            Start
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 border border-dashed border-border rounded-lg text-center text-muted-foreground text-sm">
                            No assignments due. You&apos;re all caught up!
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-blue-500" />
                            Recent Activity
                        </h2>
                        <Link href="/history" className="text-sm text-indigo-400 hover:text-indigo-300">History</Link>
                    </div>
                    <div className="space-y-3">
                        {recentActivity.length > 0 ? (
                            recentActivity.slice(0, 4).map((activity, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground",
                                            activity.status === 'accepted' && "bg-green-500/10 text-green-500",
                                            activity.status === 'wrong_answer' && "bg-red-500/10 text-red-500"
                                        )}>
                                            {activity.status === 'accepted' ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm truncate max-w-[200px]">{activity.title}</p>
                                            <p className="text-xs text-muted-foreground">{activity.time}</p>
                                        </div>
                                    </div>
                                    {activity.difficulty && (
                                        <Badge variant="secondary" className={cn(
                                            "text-[10px] uppercase",
                                            activity.difficulty === 'easy' && "text-green-500 bg-green-500/10",
                                            activity.difficulty === 'medium' && "text-yellow-500 bg-yellow-500/10",
                                            activity.difficulty === 'hard' && "text-red-500 bg-red-500/10"
                                        )}>
                                            {activity.difficulty}
                                        </Badge>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-8 border border-dashed border-border rounded-lg text-center text-muted-foreground text-sm space-y-2">
                                <p>No recent activity.</p>
                                {homeworkQueue[0]?.subjectSlug && (
                                    <Link
                                        href={homeworkQueue[0].topicSlug
                                            ? `/subjects/${homeworkQueue[0].subjectSlug}/topics/${homeworkQueue[0].topicSlug}`
                                            : `/subjects/${homeworkQueue[0].subjectSlug}`
                                        }
                                        className="inline-flex items-center justify-center rounded-lg border border-indigo-500/40 px-3 py-2 text-indigo-300 hover:text-white hover:bg-indigo-600/10 transition-colors text-sm"
                                    >
                                        Start your next assignment
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
