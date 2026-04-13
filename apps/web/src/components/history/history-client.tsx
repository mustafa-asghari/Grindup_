'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Code2,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    ChevronLeft,
    Flame,
    Zap,
    BookOpen,
    Brain,
    X,
} from 'lucide-react';

interface ActivityItem {
    id: string;
    type: 'submission' | 'exercise' | 'homework' | 'topic';
    title: string;
    difficulty: string;
    status: 'correct' | 'incorrect' | 'accepted' | 'error' | 'pending' | 'in_progress';
    timestamp: string;
    subjectName?: string;
    exerciseType?: string;
    language?: string;
    runtimeMs?: number | null;
    problemId?: string;
    attemptId?: string;
    assignmentType?: string;
    assignmentId?: string;
    topicSlug?: string;
    subjectSlug?: string;
}

interface HistoryClientProps {
    allActivity: ActivityItem[];
    user: { xp: number; currentStreak: number } | null;
    stats: {
        totalSubmissions: number;
        acceptedSubmissions: number;
        uniqueProblemsSolved: number;
        totalExercises: number;
        correctExercises: number;
    };
}

export function HistoryClient({ allActivity, user, stats }: HistoryClientProps) {
    const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
    const [activityDetails, setActivityDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Fetch activity details when an exercise is selected
    useEffect(() => {
        if (selectedActivity?.attemptId) {
            setLoadingDetails(true);
            fetch(`/api/exercises/attempt/${selectedActivity.attemptId}`)
                .then(res => res.json())
                .then(data => {
                    setActivityDetails(data);
                    setLoadingDetails(false);
                })
                .catch(() => setLoadingDetails(false));
        }
    }, [selectedActivity]);

    const handleClick = (item: ActivityItem) => {
        if (item.type === 'exercise' && item.attemptId) {
            setSelectedActivity(item);
        }
    };

    const getLink = (item: ActivityItem) => {
        if (item.type === 'submission' && item.problemId) return `/problems/${item.problemId}`;
        if (item.type === 'homework') {
            if (item.subjectSlug && item.topicSlug) return `/subjects/${item.subjectSlug}/${item.topicSlug}`;
            if (item.subjectSlug) return `/subjects/${item.subjectSlug}`;
        }
        if (item.type === 'topic' && item.subjectSlug && item.topicSlug) return `/subjects/${item.subjectSlug}/${item.topicSlug}`;
        return null;
    };

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <header className="border-b border-gray-800 bg-black sticky top-0 z-50">
                <div className="w-full px-16 lg:px-24 xl:px-32 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-3">
                            <Code2 className="w-7 h-7 text-white" />
                            <span className="text-xl font-semibold text-white">GrindUp</span>
                        </Link>

                        <nav className="hidden md:flex items-center gap-8">
                            <Link href="/problems" className="text-gray-400 hover:text-white transition-colors">
                                LeetCode
                            </Link>
                            <Link href="/subjects" className="text-gray-400 hover:text-white transition-colors">
                                Subjects
                            </Link>
                            <Link href="/history" className="text-white font-medium">
                                History
                            </Link>
                        </nav>
                    </div>

                    <div className="flex items-center gap-6 text-gray-400">
                        <div className="flex items-center gap-2">
                            <Flame className="w-5 h-5 text-orange-500" />
                            <span className="font-medium">{user?.currentStreak || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-500" />
                            <span className="font-medium">{user?.xp?.toLocaleString() || 0}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="w-full px-16 lg:px-24 xl:px-32 py-12">
                {/* Page Title */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href="/"
                        className="p-2 rounded-lg bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Activity History</h1>
                        <p className="text-gray-500 mt-1">
                            Track all your learning progress - problems, quizzes, and exercises
                        </p>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-12">
                    <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800">
                        <div className="text-2xl font-bold text-white mb-1">{stats.totalSubmissions}</div>
                        <div className="text-gray-500 text-sm">Code Submissions</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800">
                        <div className="text-2xl font-bold text-green-500 mb-1">{stats.acceptedSubmissions}</div>
                        <div className="text-gray-500 text-sm">Accepted</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800">
                        <div className="text-2xl font-bold text-white mb-1">{stats.uniqueProblemsSolved}</div>
                        <div className="text-gray-500 text-sm">Problems Solved</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800">
                        <div className="text-2xl font-bold text-blue-400 mb-1">{stats.totalExercises}</div>
                        <div className="text-gray-500 text-sm">Quiz Attempts</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800">
                        <div className="text-2xl font-bold text-green-500 mb-1">{stats.correctExercises}</div>
                        <div className="text-gray-500 text-sm">Correct Answers</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-gray-900 border border-gray-800">
                        <div className="text-2xl font-bold text-purple-400 mb-1">
                            {stats.totalExercises > 0 ? Math.round((stats.correctExercises / stats.totalExercises) * 100) : 0}%
                        </div>
                        <div className="text-gray-500 text-sm">Quiz Accuracy</div>
                    </div>
                </div>

                {/* Activity List */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-gray-800">
                        <h2 className="text-xl font-semibold text-white flex items-center gap-3">
                            <Clock className="w-6 h-6 text-gray-500" />
                            All Activity
                        </h2>
                    </div>

                    {allActivity.length === 0 ? (
                        <div className="p-12 text-center">
                            <Brain className="w-16 h-16 mx-auto text-gray-700 mb-4" />
                            <h3 className="text-xl font-medium text-gray-400 mb-2">No activity yet</h3>
                            <p className="text-gray-500 mb-6">Start learning to see your history here!</p>
                            <Link
                                href="/subjects"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
                            >
                                Browse Subjects
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-800">
                            {allActivity.map((item) => {
                                const link = getLink(item);
                                if (link) {
                                    return (
                                        <Link
                                            key={item.id}
                                            href={link}
                                            className="flex items-center justify-between p-6 hover:bg-gray-800/50 transition-colors"
                                        >
                                            <ActivityContent item={item} />
                                        </Link>
                                    );
                                }
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleClick(item)}
                                        className="flex items-center justify-between p-6 hover:bg-gray-800/50 transition-colors cursor-pointer"
                                    >
                                        <ActivityContent item={item} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {/* Activity Details Modal */}
            <AnimatePresence>
                {selectedActivity && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => { setSelectedActivity(null); setActivityDetails(null); }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-gray-800 flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1">{selectedActivity.title}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <span>{selectedActivity.timestamp}</span>
                                        <span>•</span>
                                        <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${selectedActivity.status === 'correct' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                            {selectedActivity.status}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setSelectedActivity(null); setActivityDetails(null); }}
                                    className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6">
                                {loadingDetails ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                                        Loading details...
                                    </div>
                                ) : activityDetails ? (
                                    <div className="space-y-6">
                                        {/* Question Content */}
                                        <div className="bg-gray-950 rounded-xl p-6 border border-gray-800">
                                            <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-wider">Question</h4>
                                            <div className="text-white text-lg font-medium">
                                                {activityDetails.exercise.content.question || activityDetails.exercise.content.front}
                                            </div>
                                        </div>

                                        {/* Your Answer vs Correct Answer */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-gray-950 rounded-xl p-6 border border-gray-800">
                                                <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-wider">Your Answer</h4>
                                                <div className="font-mono text-gray-300">
                                                    {activityDetails.exercise.type === 'mcq' && activityDetails.response?.selectedIndices !== undefined ? (
                                                        activityDetails.exercise.content.options[activityDetails.response.selectedIndices[0]]
                                                    ) : (
                                                        JSON.stringify(activityDetails.response?.userAnswer || activityDetails.response)
                                                    )}
                                                </div>
                                            </div>

                                            <div className="bg-gray-950 rounded-xl p-6 border border-gray-800">
                                                <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 tracking-wider">Correct Answer</h4>
                                                <div className="font-mono text-green-400">
                                                    {activityDetails.exercise.type === 'mcq' ? (
                                                        activityDetails.exercise.content.options[activityDetails.exercise.content.correctAnswers[0]]
                                                    ) : (
                                                        "See explanation"
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex gap-4 pt-4 border-t border-gray-800">
                                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                                <Clock className="w-4 h-4" />
                                                {Math.round(activityDetails.timeSpentSecs || 0)}s spent
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                                <Zap className="w-4 h-4" />
                                                {activityDetails.score} XP Earned
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-500">
                                        Failed to load details.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ActivityContent({ item }: { item: ActivityItem }) {
    return (
        <>
            <div className="flex items-center gap-6">
                <ActivityIcon item={item} />
                <div>
                    <div className="text-white font-medium mb-1">
                        {item.title}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${!item.difficulty ? 'hidden' : item.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                            item.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                            }`}>
                            {item.difficulty && item.difficulty}
                        </span>
                        {item.type === 'submission' ? (
                            <>
                                <span className="text-gray-500">{item.language}</span>
                                <span className="text-gray-500">
                                    {item.runtimeMs ? `${item.runtimeMs}ms` : '-'}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="text-blue-400 capitalize">{item.exerciseType}</span>
                                {item.subjectName && (
                                    <span className="text-gray-500">{item.subjectName}</span>
                                )}
                            </>
                        )}
                        {item.type === 'homework' && (
                            <span className="text-indigo-400">
                                {item.assignmentType === 'reading' ? 'Reading' :
                                    item.assignmentType === 'exercise' || item.assignmentType === 'topic_practice' ? 'Practice' :
                                        item.assignmentType === 'problem' ? 'Problem' :
                                            'Assignment'}
                            </span>
                        )}
                        {item.type === 'topic' && (
                            <span className="text-purple-400">Topic Progress</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="text-right">
                <div className={getStatusColor(item.status)}>
                    {formatStatus(item.status)}
                </div>
                <div className="text-gray-500 text-sm mt-1">
                    {item.timestamp}
                </div>
            </div>
        </>
    );
}

function ActivityIcon({ item }: { item: ActivityItem }) {
    if (item.type === 'exercise') {
        const isCorrect = item.status === 'correct';
        return (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isCorrect ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                <BookOpen className={`w-5 h-5 ${isCorrect ? 'text-green-500' : 'text-red-500'}`} />
            </div>
        );
    }

    if (item.type === 'homework') {
        return (
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Brain className="w-5 h-5 text-indigo-500" />
            </div>
        );
    }

    if (item.type === 'topic') {
        const isMastered = item.status === 'accepted'; // mapped to accepted/mastered
        return (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMastered ? 'bg-purple-500/20' : 'bg-gray-800'}`}>
                <Zap className={`w-5 h-5 ${isMastered ? 'text-purple-500' : 'text-gray-500'}`} />
            </div>
        );
    }

    switch (item.status) {
        case 'accepted':
            return (
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
            );
        case 'error':
        case 'incorrect':
            return (
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-500" />
                </div>
            );
        default:
            return (
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-gray-500" />
                </div>
            );
    }
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'accepted':
        case 'correct':
            return 'text-green-500 font-medium';
        case 'incorrect':
        case 'error':
            return 'text-red-500 font-medium';
        case 'pending':
            return 'text-yellow-500 font-medium';
        case 'in_progress':
            return 'text-blue-400 font-medium';
        default:
            return 'text-gray-400';
    }
}

function formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
        accepted: 'Accepted',
        correct: 'Correct',
        incorrect: 'Incorrect',
        error: 'Error',
        pending: 'Pending',
        in_progress: 'In Progress',
    };
    return statusMap[status] || status;
}
