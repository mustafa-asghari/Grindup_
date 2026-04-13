'use client';

import { useState } from 'react';
import { ContestMode } from './contest-mode';
import { ExerciseRunner } from '@/components/exercise/exercise-runner';
import { ProblemWorkspace } from '@/components/editor/problem-workspace';
import { ExerciseData } from '@/lib/exercise-types';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContestChat } from '@/components/contest/contest-chat';

type ContestProblem = {
    id: string;
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    points: number;
    solved: boolean;
    problemData: any; // Full problem data for workspace
};

type ContestExercise = {
    id: string;
    title: string;
    points: number;
    exerciseData: ExerciseData;
    solved: boolean;
};

interface ContestWorkspaceProps {
    contestId: string;
    contestTitle: string;
    startTime: Date;
    endTime: Date;
    problems: ContestProblem[];
    exercises: ContestExercise[];
    userId: string;
}

export function ContestWorkspace({
    contestId,
    contestTitle,
    startTime,
    endTime,
    problems,
    exercises,
    userId,
}: ContestWorkspaceProps) {
    const [activeItemId, setActiveItemId] = useState<string>(
        problems[0]?.id || exercises[0]?.id || ''
    );
    const [isChatOpen, setIsChatOpen] = useState(false);

    const activeProblem = problems.find(p => p.id === activeItemId);
    const activeExercise = exercises.find(e => e.id === activeItemId);

    // Combine for navigation
    const navItems = [
        ...problems.map(p => ({
            id: p.id,
            title: p.title,
            points: p.points,
            solved: p.solved,
            type: 'problem' as const
        })),
        ...exercises.map(e => ({
            id: e.id,
            title: e.title,
            points: e.points,
            solved: e.solved,
            type: 'exercise' as const
        }))
    ];

    const handleSubmitProblem = async (problemId: string, code: string) => {
        // Implement submission logic here or pass down
        console.log('Submitting problem', problemId, code);
        return true;
    };

    const handleIntegrityViolation = (type: string) => {
        console.log('Integrity violation', type);
    };

    const handleExerciseComplete = (success: boolean, score: number) => {
        console.log('Exercise completed', success, score);
    };

    return (
        <div className="min-h-screen bg-black text-white pt-24 pb-8 px-4">
            <ContestMode
                contestId={contestId}
                contestTitle={contestTitle}
                startTime={startTime}
                endTime={endTime}
                // Pass a unified list or modify ContestMode to accept both.
                // For now, let's just pass problems as "items" concept or map them.
                // ContestMode internally maps them to pills.
                // We'll update ContestMode to support onClick.
                problems={navItems.map(item => ({
                    ...item,
                    difficulty: 'medium', // Default/Placeholder as ContestMode expects it
                }))}
                currentProblemId={activeItemId}
                onSelectProblem={setActiveItemId} // We need to add this prop to ContestMode
                onSubmit={handleSubmitProblem}
                onIntegrityViolation={handleIntegrityViolation}
            />

            <div className="max-w-[1600px] mx-auto mt-4">
                {activeProblem && (
                    <div className="h-[calc(100vh-140px)]">
                        <ProblemWorkspace
                            problem={activeProblem.problemData}
                            userStats={{ streak: 0, xp: 0 }} // Minimal stats
                        />
                    </div>
                )}

                {activeExercise && (
                    <div className="max-w-4xl mx-auto py-8">
                        <div className="bg-gray-950 rounded-3xl p-8 border border-gray-900 min-h-[500px]">
                            <ExerciseRunner
                                key={activeExercise.id}
                                exercise={activeExercise.exerciseData}
                                onComplete={handleExerciseComplete}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Floating Chat */}
            <AnimatePresence>
                {isChatOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-24 right-8 w-96 h-[600px] z-50 shadow-2xl"
                    >
                        <div className="relative h-full">
                            <Button
                                size="icon"
                                variant="secondary"
                                className="absolute -top-3 -right-3 rounded-full w-8 h-8 shadow-lg z-10"
                                onClick={() => setIsChatOpen(false)}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                            <ContestChat apiEndpoint={`/api/contests/${contestId}/messages`} currentUserId={userId} className="h-full bg-gray-900/95 backdrop-blur border-gray-700" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Button
                size="lg"
                className="fixed bottom-8 right-8 rounded-full h-14 w-14 shadow-xl bg-purple-600 hover:bg-purple-500 z-40 p-0"
                onClick={() => setIsChatOpen(!isChatOpen)}
            >
                <MessageSquare className="w-6 h-6" />
            </Button>
        </div>
    );
}
