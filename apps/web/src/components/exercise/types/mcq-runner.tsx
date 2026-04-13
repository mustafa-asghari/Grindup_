'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { ExerciseData, McqContent } from '@/lib/exercise-types';

interface McqRunnerProps {
    exercise: ExerciseData;
    onComplete: (success: boolean, score: number) => void;
}

export function McqRunner({ exercise, onComplete }: McqRunnerProps) {
    const content = exercise.content as McqContent;
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const isMultiple = content.correctAnswers.length > 1;

    const toggleOption = (idx: number) => {
        if (isSubmitted) return;

        if (isMultiple) {
            if (selectedIndices.includes(idx)) {
                setSelectedIndices(selectedIndices.filter(i => i !== idx));
            } else {
                setSelectedIndices([...selectedIndices, idx]);
            }
        } else {
            setSelectedIndices([idx]);
        }
    };

    const handleSubmit = async () => {
        if (selectedIndices.length === 0) return;

        // Check correctness
        const correctIndices = content.correctAnswers || [];
        const isCorrect =
            selectedIndices.length === correctIndices.length &&
            selectedIndices.every(i => correctIndices.includes(i));

        // Calculate optimistic score
        const points = exercise.points || 10;
        const score = isCorrect ? points : 0;

        // Submit to API
        try {
            await fetch('/api/exercises/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exerciseId: exercise.id,
                    response: { selectedIndices },
                    timeSpentSecs: 30, // TODO: track actual time
                    hintsUsed: 0
                })
            });
        } catch (e) {
            console.warn('Failed to submit exercise result', e);
        }

        setIsSubmitted(true);
        onComplete(isCorrect, score);
    };

    // Determine correct/incorrect for specific option display
    const getOptionStatus = (idx: number) => {
        if (!isSubmitted) return selectedIndices.includes(idx) ? 'selected' : 'default';

        const isSelected = selectedIndices.includes(idx);
        const isCorrectAnswer = content.correctAnswers.includes(idx);

        if (isCorrectAnswer && isSelected) return 'correct';
        if (isCorrectAnswer && !isSelected) return 'missed';
        if (!isCorrectAnswer && isSelected) return 'wrong';
        return 'default';
    };

    const styles = {
        default: 'border-gray-800 hover:bg-gray-800/50 hover:border-gray-600',
        selected: 'border-blue-500 bg-blue-500/10 text-blue-200',
        correct: 'border-green-500 bg-green-500/10 text-green-200',
        wrong: 'border-red-500 bg-red-500/10 text-red-200',
        missed: 'border-green-500 border-dashed opacity-70',
    };

    return (
        <div className="max-w-3xl mx-auto w-full">
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {isMultiple ? 'Multiple Choice' : 'Single Choice'}
                    </span>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-gray-800 text-gray-400 border border-gray-700">
                        {exercise.points} pts
                    </span>
                </div>
                <h2 className="text-xl md:text-2xl font-semibold leading-relaxed text-gray-100">
                    {content.question}
                </h2>
            </div>

            <div className="space-y-3">
                {content.options.map((option, idx) => {
                    const status = getOptionStatus(idx);

                    return (
                        <motion.button
                            key={idx}
                            whileTap={{ scale: isSubmitted ? 1 : 0.99 }}
                            onClick={() => toggleOption(idx)}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${styles[status]}`}
                            disabled={isSubmitted}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                                    ${status === 'selected' || status === 'correct' || status === 'wrong' ? 'border-current' : 'border-gray-600 group-hover:border-gray-400'}
                                `}>
                                    {status === 'correct' && <CheckCircle2 className="w-4 h-4" />}
                                    {status === 'wrong' && <XCircle className="w-4 h-4" />}
                                    {status === 'selected' && !isSubmitted && <div className="w-2.5 h-2.5 rounded-full bg-current" />}
                                </div>
                                <span className="text-lg">{option}</span>
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            <AnimatePresence>
                {isSubmitted && content.explanation && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 p-6 rounded-xl bg-gray-900 border border-gray-800"
                    >
                        <h4 className="flex items-center gap-2 font-semibold text-gray-300 mb-2">
                            <AlertCircle className="w-5 h-5" />
                            Explanation
                        </h4>
                        <p className="text-gray-400 leading-relaxed">
                            {content.explanation}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="mt-8 flex justify-end">
                {!isSubmitted ? (
                    <button
                        onClick={handleSubmit}
                        disabled={selectedIndices.length === 0}
                        className="px-8 py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Submit Answer
                    </button>
                ) : (
                    <div className="text-gray-500 text-sm">

                    </div>
                )}
            </div>
        </div>
    );
}
