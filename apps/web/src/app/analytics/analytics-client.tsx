'use client';

import { useState } from 'react';
import type { ComponentType } from 'react';
import {
    ActivityHeatmap,
    WeaknessRadar,
    WeeklyReportCard,
    WellbeingBanner
} from '@/components/dashboard';
import { StudyGoals } from '@/components/dashboard/progress-rings';
import { motion } from 'framer-motion';
import {
    BarChart3,
    Target,
    BookOpen,
    Flame,
    TrendingUp,
    X
} from 'lucide-react';
import { useStudyGoals } from '@/hooks/use-study-goals';

interface AnalyticsClientProps {
    heatmapData: { date: string; count: number }[];
    radarData: { topic: string; mastery: number }[];
    stats: {
        totalProblems: number;
        totalExercises: number;
        streakDays: number;
        topicsInProgress: number;
    };
    studyStats: {
        dailyGoal: number;
        dailyCompleted: number;
        weeklyGoal: number;
        weeklyCompleted: number;
    };
}

// Inline Goal Modal for simplicity since we moved it here
interface GoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentGoals: { daily: number; weekly: number };
    onSave: (daily: number, weekly: number) => void;
}

function GoalAdjustmentModal({ isOpen, onClose, currentGoals, onSave }: GoalModalProps) {
    const [daily, setDaily] = useState(currentGoals.daily);
    const [weekly, setWeekly] = useState(currentGoals.weekly);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Adjust Study Goals</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Daily Goal (Hours)
                        </label>
                        <input
                            type="number"
                            value={daily === 0 ? '' : daily}
                            onChange={(e) => setDaily(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                            className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            min="0.1"
                            step="0.1"
                            placeholder="Enter hours..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Weekly Goal (Hours)
                        </label>
                        <input
                            type="number"
                            value={weekly === 0 ? '' : weekly}
                            onChange={(e) => setWeekly(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                            className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            min="0.1"
                            step="0.1"
                            placeholder="Enter hours..."
                        />
                    </div>

                    <div className="flex gap-4 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl border border-gray-800 text-gray-400 hover:bg-gray-800 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(daily, weekly)}
                            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium"
                        >
                            Save Goals
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export function AnalyticsClient({ heatmapData, radarData, stats, studyStats }: AnalyticsClientProps) {
    const { goals, setGoals } = useStudyGoals({ daily: studyStats.dailyGoal, weekly: studyStats.weeklyGoal });
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

    const handleSaveGoals = (daily: number, weekly: number) => {
        if (daily > 0 && weekly > 0) {
            const newGoals = { daily, weekly };
            setGoals(newGoals);
            setIsGoalModalOpen(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            <BarChart3 className="w-8 h-8 text-indigo-500" />
                            Analytics Dashboard
                        </h1>
                        <p className="text-zinc-400">
                            Track your progress, identify patterns, and optimize your learning journey.
                        </p>
                    </div>
                    <div>
                        <button
                            onClick={() => setIsGoalModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                            <Target className="w-4 h-4 text-zinc-400" />
                            <span>Adjust Goals</span>
                        </button>
                    </div>
                </div>

                {/* Wellbeing Banner */}
                <WellbeingBanner />

                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        icon={Target}
                        label="Problems Solved"
                        value={stats.totalProblems}
                        color="text-green-400"
                        bgColor="bg-green-500/10"
                    />
                    <StatCard
                        icon={BookOpen}
                        label="Exercises Completed"
                        value={stats.totalExercises}
                        color="text-blue-400"
                        bgColor="bg-blue-500/10"
                    />
                    <StatCard
                        icon={Flame}
                        label="Day Streak"
                        value={stats.streakDays}
                        color="text-orange-400"
                        bgColor="bg-orange-500/10"
                    />
                    <StatCard
                        icon={TrendingUp}
                        label="Topics in Progress"
                        value={stats.topicsInProgress}
                        color="text-purple-400"
                        bgColor="bg-purple-500/10"
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Left Column: Weakness Radar */}
                    <div className="h-full">
                        {radarData.length >= 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="h-full"
                            >
                                <WeaknessRadar topics={radarData} size={300} />
                            </motion.div>
                        )}
                    </div>

                    {/* Right Column: Goals & Weekly Report */}
                    <div className="flex flex-col gap-6">
                        <StudyGoals
                            dailyGoalHours={goals.daily}
                            dailyHoursCompleted={studyStats.dailyCompleted}
                            weeklyGoalHours={goals.weekly}
                            weeklyHoursCompleted={studyStats.weeklyCompleted}
                            onAdjustGoals={() => setIsGoalModalOpen(true)}
                        />

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <WeeklyReportCard />
                        </motion.div>
                    </div>
                </div>

                {/* Bottom Section: Activity Heatmap */}
                <div className="mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <ActivityHeatmap data={heatmapData} weeks={52} />
                    </motion.div>
                </div>

                {isGoalModalOpen && (
                    <GoalAdjustmentModal
                        isOpen={isGoalModalOpen}
                        onClose={() => setIsGoalModalOpen(false)}
                        currentGoals={goals}
                        onSave={handleSaveGoals}
                    />
                )}
            </div>
        </div>
    );
}

interface StatCardProps {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: number;
    color: string;
    bgColor: string;
}

function StatCard({ icon: Icon, label, value, color, bgColor }: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-950 rounded-xl border border-zinc-800 p-6"
        >
            <div className={`inline-flex p-2 rounded-lg ${bgColor} mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-2xl font-bold text-white mb-1">{value}</div>
            <div className="text-sm text-zinc-500">{label}</div>
        </motion.div>
    );
}
