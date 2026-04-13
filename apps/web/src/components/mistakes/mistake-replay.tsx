'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RotateCcw,
    CheckCircle2,
    XCircle,
    ArrowRight,
    Code2,
    Lightbulb,
    Clock,
    FileText,
    MessageSquare
} from 'lucide-react';
import Link from 'next/link';

interface MistakeCard {
    id: string;
    mistakeTag: string;
    category: string;
    description?: string;
    correctedConcept?: string;
    occurrenceCount: number;
    lastOccurred: string;
    mastered: boolean;
    submission?: {
        id: string;
        code: string;
        problem: {
            id: string;
            title: string;
            difficulty: string;
        };
    };
}

interface MistakeReplayProps {
    mistake: MistakeCard;
    onClosure?: (type: 'understood' | 'needs_more_practice' | 'revisit_later', note?: string) => void;
    onRetry?: () => void;
}

export function MistakeReplay({ mistake, onClosure, onRetry }: MistakeReplayProps) {
    const [showCode, setShowCode] = useState(false);
    const [showClosure, setShowClosure] = useState(false);
    const [closureNote, setClosureNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleClosure = async (type: 'understood' | 'needs_more_practice' | 'revisit_later') => {
        setIsSubmitting(true);
        try {
            await fetch('/api/mistakes/closure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mistakeCardId: mistake.id,
                    closureType: type,
                    closureNote,
                    thenCode: mistake.submission?.code,
                }),
            });
            onClosure?.(type, closureNote);
        } catch (error) {
            console.error('Failed to close mistake:', error);
        } finally {
            setIsSubmitting(false);
            setShowClosure(false);
        }
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty?.toLowerCase()) {
            case 'easy': return 'text-green-400 bg-green-500/10 border-green-500/30';
            case 'medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
            case 'hard': return 'text-red-400 bg-red-500/10 border-red-500/30';
            default: return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30';
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category?.toLowerCase()) {
            case 'edge-case': return 'text-amber-400 bg-amber-500/10';
            case 'logic': return 'text-red-400 bg-red-500/10';
            case 'syntax': return 'text-blue-400 bg-blue-500/10';
            case 'complexity': return 'text-purple-400 bg-purple-500/10';
            default: return 'text-zinc-400 bg-zinc-500/10';
        }
    };

    return (
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-zinc-800">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(mistake.category)}`}>
                                {mistake.category}
                            </span>
                            <span className="text-xs text-zinc-500">•</span>
                            <span className="px-2 py-0.5 rounded bg-zinc-900 text-xs text-zinc-400 font-mono">
                                {mistake.mistakeTag}
                            </span>
                        </div>
                        <h3 className="font-semibold text-white text-lg">
                            {mistake.submission?.problem?.title || 'Unknown Problem'}
                        </h3>
                        {mistake.submission?.problem && (
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded border text-xs font-medium ${getDifficultyColor(mistake.submission.problem.difficulty)}`}>
                                {mistake.submission.problem.difficulty}
                            </span>
                        )}
                    </div>
                    <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-zinc-400">
                            <RotateCcw className="w-4 h-4" />
                            <span>×{mistake.occurrenceCount}</span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                            Last: {new Date(mistake.lastOccurred).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Description & Corrected Concept */}
            <div className="p-6 space-y-4">
                {mistake.description && (
                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                        <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-2">
                            <XCircle className="w-4 h-4" />
                            What went wrong
                        </div>
                        <p className="text-sm text-zinc-300">{mistake.description}</p>
                    </div>
                )}

                {mistake.correctedConcept && (
                    <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
                        <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-2">
                            <Lightbulb className="w-4 h-4" />
                            Corrected concept
                        </div>
                        <p className="text-sm text-zinc-300">{mistake.correctedConcept}</p>
                    </div>
                )}

                {/* Original Code */}
                {mistake.submission?.code && (
                    <div>
                        <button
                            onClick={() => setShowCode(!showCode)}
                            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-2"
                        >
                            <Code2 className="w-4 h-4" />
                            {showCode ? 'Hide' : 'Show'} original code
                            <ArrowRight className={`w-4 h-4 transition-transform ${showCode ? 'rotate-90' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {showCode && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <pre className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 text-sm text-zinc-300 overflow-x-auto font-mono">
                                        <code>{mistake.submission.code}</code>
                                    </pre>
                                    <p className="text-xs text-zinc-600 mt-2 italic">
                                        This was your code when the mistake occurred. Compare with your current understanding.
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-zinc-800 bg-zinc-900/50">
                {!showClosure ? (
                    <div className="flex items-center gap-3">
                        <Link
                            href={`/problems/${mistake.submission?.problem?.id}`}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors"
                            onClick={() => {
                                // Log replay attempt
                                fetch('/api/mistakes/replay', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ mistakeCardId: mistake.id }),
                                });
                            }}
                        >
                            <RotateCcw className="w-4 h-4" />
                            Retry Problem
                        </Link>

                        <button
                            onClick={() => setShowClosure(true)}
                            className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 font-medium transition-colors"
                        >
                            <CheckCircle2 className="w-4 h-4 inline mr-2" />
                            Mark Closure
                        </button>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
                            <MessageSquare className="w-4 h-4" />
                            How do you feel about this mistake?
                        </div>

                        <textarea
                            value={closureNote}
                            onChange={(e) => setClosureNote(e.target.value)}
                            placeholder="Optional: What did you learn? (This helps track your growth)"
                            className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder:text-zinc-600 resize-none focus:border-green-500 outline-none"
                            rows={2}
                        />

                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => handleClosure('understood')}
                                disabled={isSubmitting}
                                className="flex flex-col items-center gap-1 p-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 transition-colors disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-xs font-medium">I understand</span>
                            </button>

                            <button
                                onClick={() => handleClosure('needs_more_practice')}
                                disabled={isSubmitting}
                                className="flex flex-col items-center gap-1 p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400 transition-colors disabled:opacity-50"
                            >
                                <RotateCcw className="w-5 h-5" />
                                <span className="text-xs font-medium">Need practice</span>
                            </button>

                            <button
                                onClick={() => handleClosure('revisit_later')}
                                disabled={isSubmitting}
                                className="flex flex-col items-center gap-1 p-3 bg-zinc-500/10 hover:bg-zinc-500/20 border border-zinc-500/30 rounded-lg text-zinc-400 transition-colors disabled:opacity-50"
                            >
                                <Clock className="w-5 h-5" />
                                <span className="text-xs font-medium">Revisit later</span>
                            </button>
                        </div>

                        <button
                            onClick={() => setShowClosure(false)}
                            className="w-full text-sm text-zinc-500 hover:text-zinc-300"
                        >
                            Cancel
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
