'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp,
    TrendingDown,
    Clock,
    Target,
    BookOpen,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Lightbulb,
    Brain,
    Calendar
} from 'lucide-react';

interface WeeklyReport {
    weekStart: string;
    weekEnd: string;
    totalMinutes: number;
    problemsSolved: number;
    exercisesCompleted: number;
    topicsImproved: string[] | null;
    weakAreas: { topic: string; mastery: number }[] | null;
    recommendations: string[] | null;
    metaInsights: string | null;
}

export function WeeklyReportCard() {
    const [report, setReport] = useState<WeeklyReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [weekOffset, setWeekOffset] = useState(0);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/reports/weekly?weekOffset=${weekOffset}`);
                if (res.ok) {
                    const data = await res.json();
                    setReport(data);
                }
            } catch (error) {
                console.error('Failed to fetch weekly report:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [weekOffset]);

    const formatDateRange = (start: string, end: string) => {
        if (!start || !end) return 'Date Range Unavailable';
        const startDate = new Date(start);
        const endDate = new Date(end);

        // Check for invalid dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return 'Invalid Date Range';
        }

        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
    };

    if (loading) {
        return (
            <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-8 animate-pulse h-full">
                <div className="h-6 bg-zinc-800 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-zinc-800 rounded w-1/2 mb-8"></div>
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-zinc-800 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-8 text-center h-full flex items-center justify-center">
                <p className="text-zinc-500">No report available for this week</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden h-full flex flex-col"
        >
            {/* Header */}
            <div className="p-6 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-white text-lg flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-indigo-500" />
                            Weekly Report
                        </h3>
                        <p className="text-sm text-zinc-500">
                            {formatDateRange(report.weekStart, report.weekEnd)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setWeekOffset(weekOffset + 1)}
                            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                            disabled={weekOffset === 0}
                            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white disabled:opacity-50"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 divide-x divide-zinc-800 border-b border-zinc-800">
                <div className="p-6 text-center">
                    <div className="flex items-center justify-center gap-2 text-blue-400 mb-2">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {report.totalMinutes}
                    </div>
                    <div className="text-xs text-zinc-500">minutes studied</div>
                </div>
                <div className="p-6 text-center">
                    <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                        <Target className="w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {report.problemsSolved}
                    </div>
                    <div className="text-xs text-zinc-500">problems solved</div>
                </div>
                <div className="p-6 text-center">
                    <div className="flex items-center justify-center gap-2 text-purple-400 mb-2">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {report.exercisesCompleted}
                    </div>
                    <div className="text-xs text-zinc-500">exercises completed</div>
                </div>
            </div>

            {/* Topics Improved */}
            {report.topicsImproved && report.topicsImproved.length > 0 && (
                <div className="p-6 border-b border-zinc-800">
                    <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-3">
                        <TrendingUp className="w-4 h-4" />
                        Topics Improved
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {report.topicsImproved.slice(0, 5).map((topic, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-1 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-400"
                            >
                                {topic}
                            </span>
                        ))}
                        {report.topicsImproved.length > 5 && (
                            <span className="px-2 py-1 text-xs text-zinc-500">
                                +{report.topicsImproved.length - 5} more
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Weak Areas */}
            {report.weakAreas && report.weakAreas.length > 0 && (
                <div className="p-6 border-b border-zinc-800">
                    <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-3">
                        <AlertTriangle className="w-4 h-4" />
                        Focus Areas
                    </div>
                    <div className="space-y-2">
                        {report.weakAreas.slice(0, 3).map((area, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <span className="text-sm text-zinc-300">{area.topic}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${area.mastery < 30 ? 'bg-red-500' : 'bg-amber-500'
                                                }`}
                                            style={{ width: `${area.mastery}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-zinc-500 w-8">
                                        {Math.round(area.mastery)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recommendations */}
            {report.recommendations && report.recommendations.length > 0 && (
                <div className="p-6 border-b border-zinc-800 flex-grow">
                    <div className="flex items-center gap-2 text-indigo-400 text-sm font-medium mb-3">
                        <Lightbulb className="w-4 h-4" />
                        Recommendations
                    </div>
                    <ul className="space-y-2">
                        {report.recommendations.map((rec, idx) => (
                            <li key={idx} className="text-sm text-zinc-400 flex items-start gap-2">
                                <span className="text-indigo-500 mt-1">•</span>
                                {rec}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Meta Insights */}
            {report.metaInsights && (
                <div className="p-6 bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                            <Brain className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-zinc-300 mb-1">
                                Learning Insight
                            </div>
                            <p className="text-sm text-zinc-400 italic">
                                "{report.metaInsights}"
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
