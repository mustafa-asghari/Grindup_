'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Code2, BookOpen, CheckCircle2, ChevronRight, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ExerciseRunner } from '@/components/exercise/exercise-runner';
import { ExerciseData } from '@/lib/exercise-types';

interface ReviewItem {
    cardId: string;
    exercise: ExerciseData;
}

interface ReviewClientProps {
    reviews: ReviewItem[];
    isLoggedIn: boolean;
}

export function ReviewClient({ reviews: initialReviews, isLoggedIn }: ReviewClientProps) {
    const router = useRouter();
    const [reviews, setReviews] = useState(initialReviews);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isComplete, setIsComplete] = useState(false);

    const currentReview = reviews[currentIndex];

    const handleExerciseComplete = (success: boolean, score: number) => {
        // Prepare next
        setTimeout(() => {
            if (currentIndex < reviews.length - 1) {
                setCurrentIndex(currentIndex + 1);
            } else {
                setIsComplete(true);
            }
        }, 500); // 500ms delay for visual feedback
    };

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <header className="border-b border-gray-800 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <Code2 className="w-7 h-7 text-white" />
                        <span className="text-xl font-semibold">GrindUp</span>
                    </Link>

                    <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
                        <span>Daily Review</span>
                        {reviews.length > 0 && !isComplete && (
                            <span className="px-2 py-1 bg-gray-800 rounded-lg text-white">
                                {currentIndex + 1} / {reviews.length}
                            </span>
                        )}
                    </div>

                    <Link href="/" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
                <AnimatePresence mode="wait">
                    {isComplete ? (
                        <motion.div
                            key="complete"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center max-w-lg"
                        >
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-10 h-10 text-green-500" />
                            </div>
                            <h1 className="text-3xl font-bold mb-4">All Caught Up!</h1>
                            <p className="text-gray-400 mb-8">
                                You have completed your daily reviews. Great job maintaining your streak!
                            </p>
                            <div className="flex gap-4 justify-center">
                                <Link href="/" className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl transition-colors font-medium">
                                    Home
                                </Link>
                                <Link href="/subjects" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl transition-colors font-medium">
                                    Learn New Topics
                                </Link>
                            </div>
                        </motion.div>
                    ) : reviews.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center"
                        >
                            <BookOpen className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold mb-2">No Reviews Due</h2>
                            <p className="text-gray-500 mb-6">Check back later or start a new topic.</p>
                            <Link href="/subjects" className="text-blue-400 hover:text-blue-300 flex items-center gap-2 justify-center">
                                Browse Subjects <ChevronRight className="w-4 h-4" />
                            </Link>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={currentReview.cardId}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="w-full max-w-3xl"
                        >
                            <ExerciseRunner
                                exercise={currentReview.exercise}
                                onComplete={handleExerciseComplete}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
