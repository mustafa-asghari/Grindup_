'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle, CheckCircle2, Calendar, ChevronRight, BookOpen, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { HomeworkSubmit } from './homework-submit';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

interface Assignment {
    id: string;
    title: string;
    subjectName: string;
    subjectSlug: string;
    dueDate: string;
    estimatedMins: number;
    type: 'exercise' | 'problem' | 'reading';
    isLate: boolean;
    isCompleted: boolean;
    latePenalty?: number; // Percentage penalty
}

interface HomeworkQueueProps {
    assignments: Assignment[];
    onComplete?: (id: string) => void;
    showCatchup?: boolean;
}

export function HomeworkQueue({ assignments, onComplete, showCatchup = true }: HomeworkQueueProps) {
    const [filter, setFilter] = useState<'all' | 'today' | 'late' | 'upcoming'>('all');
    const [selectedHomework, setSelectedHomework] = useState<Assignment | null>(null);

    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const lateAssignments = assignments.filter(a => !a.isCompleted && a.isLate);
    const todayAssignments = assignments.filter(a => {
        const due = new Date(a.dueDate);
        return !a.isCompleted && !a.isLate && due <= todayEnd;
    });
    const upcomingAssignments = assignments.filter(a => {
        const due = new Date(a.dueDate);
        return !a.isCompleted && !a.isLate && due > todayEnd;
    });
    const completedAssignments = assignments.filter(a => a.isCompleted);

    const getFilteredAssignments = () => {
        switch (filter) {
            case 'late': return lateAssignments;
            case 'today': return todayAssignments;
            case 'upcoming': return upcomingAssignments;
            default: return [...lateAssignments, ...todayAssignments, ...upcomingAssignments];
        }
    };

    const formatDueDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const isToday = date.toDateString() === now.toDateString();
        const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();

        if (isToday) return 'Today';
        if (isTomorrow) return 'Tomorrow';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'exercise': return '📝';
            case 'problem': return '💻';
            case 'reading': return '📖';
            default: return '📚';
        }
    };

    const filteredAssignments = getFilteredAssignments();

    return (
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-zinc-500" />
                        Homework Queue
                    </h2>
                    {lateAssignments.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-sm text-red-400">{lateAssignments.length} late</span>
                        </div>
                    )}
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2">
                    {[
                        { key: 'all', label: 'All', count: filteredAssignments.length },
                        { key: 'late', label: 'Late', count: lateAssignments.length },
                        { key: 'today', label: 'Today', count: todayAssignments.length },
                        { key: 'upcoming', label: 'Upcoming', count: upcomingAssignments.length },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === tab.key
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                                }`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className="ml-2 text-xs opacity-60">({tab.count})</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Catch-up Mode Notice */}
            {showCatchup && lateAssignments.length >= 3 && (
                <div className="mx-6 mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-300">Catch-up Mode Available</p>
                            <p className="text-sm text-amber-400/70 mt-1">
                                You have {lateAssignments.length} late assignments. Consider activating catch-up mode for a focused recovery plan.
                            </p>
                            <button className="mt-3 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-medium transition-colors">
                                Activate Catch-up Mode
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assignment List */}
            <div className="p-6 space-y-3">
                <AnimatePresence mode="popLayout">
                    {filteredAssignments.length > 0 ? (
                        filteredAssignments.map((assignment, idx) => (
                            <motion.div
                                key={assignment.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: idx * 0.05 }}
                                className={`p-4 rounded-xl border transition-all cursor-pointer group ${assignment.isLate
                                    ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl">{getTypeIcon(assignment.type)}</span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-white">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkMath]}
                                                        rehypePlugins={[rehypeKatex]}
                                                        components={{
                                                            p: ({ children }) => <span>{children}</span>,
                                                        }}
                                                    >
                                                        {assignment.title}
                                                    </ReactMarkdown>
                                                </span>
                                                {assignment.isLate && assignment.latePenalty && (
                                                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                                                        -{assignment.latePenalty}% penalty
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500">
                                                <Link href={`/subjects/${assignment.subjectSlug}`} className="hover:text-white transition-colors">
                                                    {assignment.subjectName}
                                                </Link>
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {assignment.estimatedMins} min
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedHomework(assignment);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-medium transition-colors"
                                        >
                                            <Upload className="w-3.5 h-3.5" />
                                            Submit
                                        </button>
                                        <div className={`text-sm font-medium ${assignment.isLate ? 'text-red-400' : 'text-zinc-400'}`}>
                                            {assignment.isLate ? 'Overdue' : formatDueDate(assignment.dueDate)}
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-white transition-colors" />
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-12"
                        >
                            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
                            <p className="text-lg font-medium text-white mb-1">All caught up!</p>
                            <p className="text-sm text-zinc-500">
                                {filter === 'all'
                                    ? "You have no pending assignments."
                                    : `No ${filter} assignments.`
                                }
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Completed Section */}
            {completedAssignments.length > 0 && (
                <div className="px-6 pb-6">
                    <div className="pt-4 border-t border-zinc-800">
                        <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-zinc-900/50 transition-colors">
                            <span className="text-sm text-zinc-500">
                                {completedAssignments.length} completed this week
                            </span>
                            <ChevronRight className="w-4 h-4 text-zinc-600" />
                        </button>
                    </div>
                </div>
            )}

            {/* Submit Modal */}
            <AnimatePresence>
                {selectedHomework && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setSelectedHomework(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full max-w-lg"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="relative">
                                <button
                                    onClick={() => setSelectedHomework(null)}
                                    className="absolute -top-12 right-0 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <HomeworkSubmit
                                    homeworkId={selectedHomework.id}
                                    homeworkTitle={selectedHomework.title}
                                    onSubmitted={(result) => {
                                        setSelectedHomework(null);
                                        onComplete?.(selectedHomework.id);
                                    }}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
