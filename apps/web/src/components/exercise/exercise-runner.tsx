'use client';

import { ExerciseData } from '@/lib/exercise-types';
import { McqRunner } from './types/mcq-runner';
import { FlashcardRunner } from './types/flashcard-runner';
import { Code2, PenTool } from 'lucide-react';
import Link from 'next/link';

interface ExerciseRunnerProps {
    exercise: ExerciseData;
    onComplete: (success: boolean, score: number) => void;
}

export function ExerciseRunner({ exercise, onComplete }: ExerciseRunnerProps) {
    if (exercise.type === 'mcq') {
        return <McqRunner exercise={exercise} onComplete={onComplete} />;
    }

    if (exercise.type === 'flashcard') {
        return <FlashcardRunner exercise={exercise} onComplete={onComplete} />;
    }

    if (exercise.type === 'coding') {
        // Coding exercises are handled by the dedicated workspace
        // This is a comprehensive fallback if reached
        return (
            <div className="text-center py-20 bg-gray-900 rounded-3xl border border-gray-800">
                <Code2 className="w-16 h-16 mx-auto text-blue-500 mb-6" />
                <h2 className="text-2xl font-bold text-white mb-4">Coding Exercise</h2>
                <p className="text-gray-400 mb-8 max-w-md mx-auto">
                    This exercise requires the advanced code editor.
                </p>
                {/* Assuming content has problemId */}
                <Link
                    href={`/problems/${exercise.content.problemId}`}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
                >
                    Open Editor
                </Link>
            </div>
        );
    }

    // Fallback for unimplemented types
    return (
        <div className="text-center py-20 bg-gray-900 rounded-3xl border border-gray-800">
            <PenTool className="w-16 h-16 mx-auto text-purple-500 mb-6" />
            <h2 className="text-2xl font-bold text-white mb-4">
                {exercise.type.charAt(0).toUpperCase() + exercise.type.slice(1)} Exercise
            </h2>
            <p className="text-gray-400 mb-8">
                This exercise type is not yet supported in the runner.
            </p>
        </div>
    );
}
