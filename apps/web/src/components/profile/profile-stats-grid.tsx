
'use client';

import { Flame, Zap, Trophy, Target } from 'lucide-react';
import { useLiveStats } from '@/hooks/use-live-stats';

interface ProfileStatsGridProps {
    initialStats: {
        xp: number;
        streak: number;
        skillRating: number;
        exercisesDone: number;
        level: number;
    }
}

export function ProfileStatsGrid({ initialStats }: ProfileStatsGridProps) {
    // We only poll for XP/Streak/DailyHours. The hook also returns level/skillRating.
    // exercisesDone is not currently in the API response, so we keep it static or add it later.
    const liveStats = useLiveStats({
        xp: initialStats.xp,
        streak: initialStats.streak,
        dailyHours: 0, // Not used here
        weeklyHours: 0 // Not used here
    });

    // Merge live data with initial data for fields not in API
    const stats = {
        ...initialStats,
        xp: liveStats.xp,
        streak: liveStats.streak,
        skillRating: liveStats.skillRating || initialStats.skillRating // API returns skillRating now
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-gray-800/50 transition-colors group">
                <Flame className="w-8 h-8 text-orange-500 group-hover:scale-110 transition-transform" />
                <span className="text-2xl font-bold animate-in fade-in">{stats.streak}</span>
                <span className="text-sm text-gray-400">Day Streak</span>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-gray-800/50 transition-colors group">
                <Zap className="w-8 h-8 text-yellow-500 group-hover:scale-110 transition-transform" />
                <span className="text-2xl font-bold animate-in fade-in" key={stats.xp}>{stats.xp.toLocaleString()}</span>
                <span className="text-sm text-gray-400">Total XP</span>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-gray-800/50 transition-colors group">
                <Trophy className="w-8 h-8 text-indigo-500 group-hover:scale-110 transition-transform" />
                <span className="text-2xl font-bold animate-in fade-in">{stats.skillRating}</span>
                <span className="text-sm text-gray-400">ELO Rating</span>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-gray-800/50 transition-colors group">
                <Target className="w-8 h-8 text-green-500 group-hover:scale-110 transition-transform" />
                <span className="text-2xl font-bold">{stats.exercisesDone}</span>
                <span className="text-sm text-gray-400">Exercises Done</span>
            </div>
        </div>
    );
}
