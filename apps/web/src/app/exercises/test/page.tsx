'use client';

import { useState } from 'react';
import { ExerciseRunner } from '@/components/exercise/exercise-runner';
import { ExerciseData } from '@/lib/exercise-types';

const MOCK_MCQ: ExerciseData = {
    id: 'mcq-1',
    title: 'Time Complexity Analysis',
    type: 'mcq',
    difficulty: 'medium',
    points: 10,
    subjectId: 'sub-1',
    content: {
        question: 'What is the time complexity of searching in a balanced Binary Search Tree (BST)?',
        options: [
            'O(1)',
            'O(n)',
            'O(log n)',
            'O(n log n)'
        ],
        correctAnswers: [2],
        explanation: 'In a balanced BST, we eliminate half the remaining nodes at each step, making the height O(log n). Since search follows a path from root to leaf, it takes O(log n) time.'
    }
};

const MOCK_FLASHCARD: ExerciseData = {
    id: 'fc-1',
    title: 'Python List Comprehension',
    type: 'flashcard',
    difficulty: 'easy',
    points: 5,
    subjectId: 'sub-1',
    content: {
        front: 'Syntax for list comprehension to square even numbers from 0 to 9',
        back: '[x**2 for x in range(10) if x % 2 == 0]',
        hints: [
            'Use range(10) for numbers',
            'Use "if" to filter even numbers',
            'Put the expression x**2 at the start'
        ]
    }
};

export default function ExerciseTestPage() {
    const [activeExercise, setActiveExercise] = useState<ExerciseData>(MOCK_MCQ);
    const [lastResult, setLastResult] = useState<{ success: boolean, score: number } | null>(null);

    const handleComplete = (success: boolean, score: number) => {
        setLastResult({ success, score });
        console.log('Completed:', success, score);
    };

    return (
        <div className="min-h-screen bg-black text-white p-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-12 border-b border-gray-800 pb-6">
                    <h1 className="text-3xl font-bold">Exercise UI Playground</h1>

                    <div className="flex gap-4">
                        <button
                            onClick={() => { setActiveExercise(MOCK_MCQ); setLastResult(null); }}
                            className={`px-4 py-2 rounded-lg ${activeExercise.type === 'mcq' ? 'bg-blue-600' : 'bg-gray-800 text-gray-400'}`}
                        >
                            MCQ
                        </button>
                        <button
                            onClick={() => { setActiveExercise(MOCK_FLASHCARD); setLastResult(null); }}
                            className={`px-4 py-2 rounded-lg ${activeExercise.type === 'flashcard' ? 'bg-blue-600' : 'bg-gray-800 text-gray-400'}`}
                        >
                            Flashcard
                        </button>
                    </div>
                </header>

                <div className="bg-gray-950 rounded-3xl p-8 border border-gray-900 min-h-[500px]">
                    <ExerciseRunner
                        key={activeExercise.id} // Reset state on change
                        exercise={activeExercise}
                        onComplete={handleComplete}
                    />
                </div>

                {lastResult && (
                    <div className="mt-8 p-6 bg-gray-900 rounded-xl border border-gray-800">
                        <h3 className="text-lg font-semibold mb-2">Last Result</h3>
                        <pre className="text-gray-400 font-mono">
                            {JSON.stringify(lastResult, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
