'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain,
    Eye,
    EyeOff,
    MessageSquare,
    CheckCircle2,
    XCircle,
    RotateCcw,
    ChevronRight,
    Clock,
    Lightbulb,
    Code2
} from 'lucide-react';

interface ReviewCard {
    id: string;
    cardType: 'concept' | 'problem' | 'mistake';
    content: {
        question?: string;
        answer?: string;
        problemId?: string;
        problemTitle?: string;
        concept?: string;
        code?: string;
    };
    topic?: {
        id: string;
        name: string;
    };
    nextReview: string;
    easeFactor: number;
    intervalDays: number;
    repetitions: number;
}

type ReviewMode = 'standard' | 'recall' | 'explain';

interface EnhancedReviewQueueProps {
    cards: ReviewCard[];
    mode?: ReviewMode;
    onComplete?: (cardId: string, quality: number) => void;
    onModeChange?: (mode: ReviewMode) => void;
}

export function EnhancedReviewQueue({
    cards,
    mode = 'standard',
    onComplete,
    onModeChange
}: EnhancedReviewQueueProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [userExplanation, setUserExplanation] = useState('');
    const [showExplanationFeedback, setShowExplanationFeedback] = useState(false);
    const [recallAttempt, setRecallAttempt] = useState('');
    const [isComplete, setIsComplete] = useState(false);

    const currentCard = cards[currentIndex];

    const handleRating = async (quality: number) => {
        // quality: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy
        onComplete?.(currentCard.id, quality);

        // Move to next card or complete
        if (currentIndex < cards.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setShowAnswer(false);
            setUserExplanation('');
            setRecallAttempt('');
            setShowExplanationFeedback(false);
        } else {
            setIsComplete(true);
        }
    };

    const getModeDescription = (m: ReviewMode) => {
        switch (m) {
            case 'standard': return 'See prompt, reveal answer, rate difficulty';
            case 'recall': return 'Try to recall without seeing the answer first';
            case 'explain': return 'Explain the concept in your own words';
        }
    };

    if (cards.length === 0) {
        return (
            <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-12 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">All caught up!</h2>
                <p className="text-zinc-400">No reviews due right now. Check back later.</p>
            </div>
        );
    }

    if (isComplete) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-950 rounded-xl border border-zinc-800 p-12 text-center"
            >
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Session Complete!</h2>
                <p className="text-zinc-400 mb-6">You reviewed {cards.length} cards. Great job!</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-medium transition-colors"
                >
                    Done
                </button>
            </motion.div>
        );
    }

    return (
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
            {/* Mode Selector */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500">Mode:</span>
                    <div className="flex bg-zinc-900 rounded-lg p-1">
                        {(['standard', 'recall', 'explain'] as ReviewMode[]).map((m) => (
                            <button
                                key={m}
                                onClick={() => onModeChange?.(m)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === m
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                {m === 'standard' && <Eye className="w-4 h-4 inline mr-1" />}
                                {m === 'recall' && <Brain className="w-4 h-4 inline mr-1" />}
                                {m === 'explain' && <MessageSquare className="w-4 h-4 inline mr-1" />}
                                {m.charAt(0).toUpperCase() + m.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="text-sm text-zinc-400">
                    {currentIndex + 1} / {cards.length}
                </div>
            </div>

            {/* Mode Description */}
            <div className="px-6 py-3 bg-zinc-900/50 border-b border-zinc-800">
                <p className="text-xs text-zinc-500 flex items-center gap-2">
                    <Lightbulb className="w-3 h-3" />
                    {getModeDescription(mode)}
                </p>
            </div>

            {/* Card Content */}
            <div className="p-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentCard.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        {/* Topic Badge */}
                        {currentCard.topic && (
                            <div className="mb-4">
                                <span className="px-2 py-1 bg-zinc-900 rounded text-xs text-zinc-400 border border-zinc-800">
                                    {currentCard.topic.name}
                                </span>
                            </div>
                        )}

                        {/* Question/Prompt */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-white mb-2">
                                {currentCard.content.question || currentCard.content.concept || 'Review this concept'}
                            </h3>
                            {currentCard.cardType === 'problem' && currentCard.content.problemTitle && (
                                <p className="text-sm text-zinc-400 flex items-center gap-2">
                                    <Code2 className="w-4 h-4" />
                                    Problem: {currentCard.content.problemTitle}
                                </p>
                            )}
                        </div>

                        {/* Mode-specific UI */}
                        {mode === 'recall' && !showAnswer && (
                            <div className="mb-6">
                                <textarea
                                    value={recallAttempt}
                                    onChange={(e) => setRecallAttempt(e.target.value)}
                                    placeholder="Try to recall the answer from memory..."
                                    className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-600 resize-none focus:border-indigo-500 outline-none"
                                    rows={4}
                                />
                                <button
                                    onClick={() => setShowAnswer(true)}
                                    className="mt-3 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors"
                                >
                                    <Eye className="w-4 h-4 inline mr-2" />
                                    Reveal Answer
                                </button>
                            </div>
                        )}

                        {mode === 'explain' && !showExplanationFeedback && (
                            <div className="mb-6">
                                <textarea
                                    value={userExplanation}
                                    onChange={(e) => setUserExplanation(e.target.value)}
                                    placeholder="Explain this concept in your own words..."
                                    className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder:text-zinc-600 resize-none focus:border-indigo-500 outline-none"
                                    rows={4}
                                />
                                <button
                                    onClick={() => setShowExplanationFeedback(true)}
                                    disabled={!userExplanation.trim()}
                                    className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-white text-sm transition-colors"
                                >
                                    <CheckCircle2 className="w-4 h-4 inline mr-2" />
                                    Check My Explanation
                                </button>
                            </div>
                        )}

                        {mode === 'standard' && !showAnswer && (
                            <button
                                onClick={() => setShowAnswer(true)}
                                className="w-full p-4 bg-zinc-900 border border-zinc-800 border-dashed rounded-lg text-zinc-400 hover:border-zinc-700 hover:text-zinc-300 transition-colors"
                            >
                                <EyeOff className="w-5 h-5 inline mr-2" />
                                Click to reveal answer
                            </button>
                        )}

                        {/* Answer/Feedback */}
                        {(showAnswer || showExplanationFeedback) && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                {/* Show recall attempt comparison if in recall mode */}
                                {mode === 'recall' && recallAttempt && (
                                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                        <div className="text-sm font-medium text-blue-400 mb-2">Your Recall:</div>
                                        <p className="text-sm text-zinc-300">{recallAttempt}</p>
                                    </div>
                                )}

                                {/* Show user explanation if in explain mode */}
                                {mode === 'explain' && userExplanation && (
                                    <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                                        <div className="text-sm font-medium text-purple-400 mb-2">Your Explanation:</div>
                                        <p className="text-sm text-zinc-300">{userExplanation}</p>
                                    </div>
                                )}

                                {/* Correct Answer */}
                                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                                    <div className="text-sm font-medium text-green-400 mb-2">Answer:</div>
                                    <p className="text-sm text-zinc-300">
                                        {currentCard.content.answer || currentCard.content.code || 'No answer provided'}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Rating Buttons */}
            {(showAnswer || showExplanationFeedback) && (
                <div className="p-6 border-t border-zinc-800 bg-zinc-900/50">
                    <p className="text-sm text-zinc-500 mb-3">How well did you know this?</p>
                    <div className="grid grid-cols-4 gap-2">
                        <button
                            onClick={() => handleRating(0)}
                            className="flex flex-col items-center gap-1 p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 transition-colors"
                        >
                            <XCircle className="w-5 h-5" />
                            <span className="text-xs font-medium">Again</span>
                            <span className="text-[10px] text-zinc-500">~1 min</span>
                        </button>

                        <button
                            onClick={() => handleRating(1)}
                            className="flex flex-col items-center gap-1 p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400 transition-colors"
                        >
                            <Clock className="w-5 h-5" />
                            <span className="text-xs font-medium">Hard</span>
                            <span className="text-[10px] text-zinc-500">~10 min</span>
                        </button>

                        <button
                            onClick={() => handleRating(2)}
                            className="flex flex-col items-center gap-1 p-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 transition-colors"
                        >
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="text-xs font-medium">Good</span>
                            <span className="text-[10px] text-zinc-500">~{currentCard.intervalDays}d</span>
                        </button>

                        <button
                            onClick={() => handleRating(3)}
                            className="flex flex-col items-center gap-1 p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 transition-colors"
                        >
                            <ChevronRight className="w-5 h-5" />
                            <span className="text-xs font-medium">Easy</span>
                            <span className="text-[10px] text-zinc-500">~{Math.round(currentCard.intervalDays * 1.5)}d</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
