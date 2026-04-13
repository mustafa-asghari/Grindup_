'use client';

import { motion } from 'framer-motion';

interface ProgressRingProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    color?: string;
    bgColor?: string;
    children?: React.ReactNode;
}

export function ProgressRing({
    progress,
    size = 120,
    strokeWidth = 8,
    color = '#22c55e',
    bgColor = '#1f2937',
    children,
}: ProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={bgColor}
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                />
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex items-center justify-center">
                {children}
            </div>
        </div>
    );
}

interface StudyGoalsProps {
    dailyGoalHours: number;
    dailyHoursCompleted: number;
    weeklyGoalHours: number;
    weeklyHoursCompleted: number;
    onAdjustGoals?: () => void;
}

export function StudyGoals({
    dailyGoalHours = 3,
    dailyHoursCompleted = 1.5,
    weeklyGoalHours = 15,
    weeklyHoursCompleted = 8.5,
    onAdjustGoals,
}: StudyGoalsProps) {
    const dailyProgress = Math.min((dailyHoursCompleted / dailyGoalHours) * 100, 100);
    const weeklyProgress = Math.min((weeklyHoursCompleted / weeklyGoalHours) * 100, 100);

    return (
        <div className="p-8 rounded-2xl bg-gray-900 border border-gray-800 h-[320px]">
            <h3 className="text-xl font-semibold text-white mb-6">Study Goals</h3>

            <div className="flex items-center justify-around">
                {/* Daily Goal */}
                <div className="flex flex-col items-center">
                    <ProgressRing
                        progress={dailyProgress}
                        size={140}
                        strokeWidth={10}
                        color="#22c55e"
                    >
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">
                                {dailyHoursCompleted.toFixed(1)}h
                            </div>
                            <div className="text-xs text-gray-500">
                                of {dailyGoalHours}h goal
                            </div>
                        </div>
                    </ProgressRing>
                    <span className="mt-4 text-sm text-gray-400">Today</span>
                </div>

                {/* Weekly Goal */}
                <div className="flex flex-col items-center">
                    <ProgressRing
                        progress={weeklyProgress}
                        size={140}
                        strokeWidth={10}
                        color="#eab308"
                    >
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">
                                {weeklyHoursCompleted.toFixed(1)}h
                            </div>
                            <div className="text-xs text-gray-500">
                                of {weeklyGoalHours}h goal
                            </div>
                        </div>
                    </ProgressRing>
                    <span className="mt-4 text-sm text-gray-400">This Week</span>
                </div>
            </div>

            {/* Set Goal Button */}
            <button
                onClick={onAdjustGoals}
                className="w-full mt-6 py-2 px-4 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors text-sm"
            >
                Adjust Goals
            </button>
        </div>
    );
}
