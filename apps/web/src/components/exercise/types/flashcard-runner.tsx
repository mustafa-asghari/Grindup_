'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, RotateCw, Check, X, ThumbsUp, ThumbsDown, HelpCircle } from 'lucide-react';
import { ExerciseData, FlashcardContent } from '@/lib/exercise-types';

interface FlashcardRunnerProps {
    exercise: ExerciseData;
    onComplete: (success: boolean, score: number) => void;
}

export function FlashcardRunner({ exercise, onComplete }: FlashcardRunnerProps) {
    const content = exercise.content as FlashcardContent;
    const [isFlipped, setIsFlipped] = useState(false);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [showHint, setShowHint] = useState(false);

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    const handleRate = async (rating: 'AGAIN' | 'HARD' | 'GOOD' | 'EASY') => {
        let score = 0;
        let success = true;

        switch (rating) {
            case 'EASY': score = exercise.points; break;
            case 'GOOD': score = Math.floor(exercise.points * 0.8); break;
            case 'HARD': score = Math.floor(exercise.points * 0.5); break;
            case 'AGAIN': score = 0; success = false; break;
        }

        // Submit to API
        try {
            await fetch('/api/exercises/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exerciseId: exercise.id,
                    response: { rating },
                    timeSpentSecs: 30, // TODO: track actual time
                    hintsUsed: hintsUsed
                })
            });
        } catch (e) {
            console.warn('Failed to submit flashcard result', e);
        }

        if (onComplete) {
            onComplete(success, score);
        }
    };

    return (
        <div className="max-w-xl mx-auto w-full perspective-1000">
            {/* Card Container - 3D Flip */}
            <div
                className="relative h-[400px] w-full cursor-pointer group"
                onClick={handleFlip}
                style={{ perspective: '1000px' }}
            >
                <motion.div
                    className="w-full h-full relative preserve-3d transition-all duration-500"
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                    style={{ transformStyle: 'preserve-3d' }}
                >
                    {/* Front */}
                    <div
                        className="absolute inset-0 backface-hidden rounded-3xl bg-gray-900 border border-gray-800 flex flex-col items-center justify-center p-8 text-center shadow-2xl"
                        style={{ backfaceVisibility: 'hidden' }}
                    >
                        <span className="text-sm text-gray-500 uppercase tracking-widest mb-4 font-medium">Front</span>
                        <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                            {content.front}
                        </h3>
                        <p className="mt-8 text-sm text-gray-600 flex items-center gap-2 group-hover:text-gray-400 transition-colors">
                            <RotateCw className="w-4 h-4" /> Click to flip
                        </p>
                    </div>

                    {/* Back */}
                    <div
                        className="absolute inset-0 backface-hidden rounded-3xl bg-blue-900/20 border border-blue-500/30 flex flex-col items-center justify-center p-8 text-center shadow-2xl bg-gray-900"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                        <span className="text-sm text-blue-400 uppercase tracking-widest mb-4 font-medium">Back</span>
                        <h3 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                            {content.back}
                        </h3>
                    </div>
                </motion.div>
            </div>

            {/* Controls */}
            <AnimatePresence mode="wait">
                {!isFlipped ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-8 flex justify-center"
                    >
                        {content.hints && content.hints.length > 0 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowHint(true); setHintsUsed(h => h + 1); }}
                                className="flex items-center gap-2 text-yellow-500 hover:text-yellow-400 transition-colors px-4 py-2 rounded-lg hover:bg-yellow-500/10"
                            >
                                <Lightbulb className="w-5 h-5" />
                                {showHint ? 'Next Hint' : 'Need a hint?'}
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-8 grid grid-cols-4 gap-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => handleRate('AGAIN')}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-red-500/10 text-red-400 border border-transparent hover:border-red-500/20 transition-all"
                        >
                            <span className="text-xl font-bold">Again</span>
                            <span className="text-xs opacity-60">Forgot</span>
                        </button>
                        <button
                            onClick={() => handleRate('HARD')}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-orange-500/10 text-orange-400 border border-transparent hover:border-orange-500/20 transition-all"
                        >
                            <span className="text-xl font-bold">Hard</span>
                            <span className="text-xs opacity-60">Struggled</span>
                        </button>
                        <button
                            onClick={() => handleRate('GOOD')}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-blue-500/10 text-blue-400 border border-transparent hover:border-blue-500/20 transition-all"
                        >
                            <span className="text-xl font-bold">Good</span>
                            <span className="text-xs opacity-60">Recalled</span>
                        </button>
                        <button
                            onClick={() => handleRate('EASY')}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-green-500/10 text-green-400 border border-transparent hover:border-green-500/20 transition-all"
                        >
                            <span className="text-xl font-bold">Easy</span>
                            <span className="text-xs opacity-60">Instant</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hint Display */}
            <AnimatePresence>
                {showHint && content.hints && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 p-4 rounded-xl bg-yellow-900/20 border border-yellow-500/20 text-yellow-200 text-sm text-center"
                    >
                        <span className="font-bold mr-2">Hint:</span>
                        {content.hints[Math.min(hintsUsed - 1, content.hints.length - 1)]}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
