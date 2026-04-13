'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, CheckCircle, XCircle, ChevronLeft, Brain, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface Flashcard {
    id: string;
    front: string;
    back: string;
    subject: string;
    topic: string;
}

interface FlashcardStudyProps {
    subjectId: string;
    topicId?: string;
}

export function FlashcardStudy({ subjectId, topicId }: FlashcardStudyProps) {
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [studied, setStudied] = useState<{ known: number; learning: number }>({ known: 0, learning: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFlashcards();
    }, [subjectId, topicId]);

    const fetchFlashcards = async () => {
        try {
            const params = new URLSearchParams({ subjectId });
            if (topicId) params.append('topicId', topicId);

            const res = await fetch(`/api/flashcards?${params}`);
            const data = await res.json();
            setCards(data.flashcards || []);
        } catch (e) {
            console.error('Failed to load flashcards', e);
        } finally {
            setLoading(false);
        }
    };

    const handleResponse = async (known: boolean) => {
        if (known) {
            setStudied(prev => ({ ...prev, known: prev.known + 1 }));
        } else {
            setStudied(prev => ({ ...prev, learning: prev.learning + 1 }));
        }

        // Submit the response
        try {
            await fetch('/api/flashcards/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    flashcardId: cards[currentIndex].id,
                    known,
                }),
            });
        } catch (e) {
            console.error('Failed to submit response', e);
        }

        // Move to next card
        if (currentIndex < cards.length - 1) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(currentIndex + 1), 300);
        }
    };

    const resetSession = () => {
        setCurrentIndex(0);
        setIsFlipped(false);
        setStudied({ known: 0, learning: 0 });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center">
                    <Brain className="w-12 h-12 mx-auto mb-4 text-indigo-500 animate-pulse" />
                    <p className="text-muted-foreground">Loading flashcards...</p>
                </div>
            </div>
        );
    }

    if (cards.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center max-w-md p-8">
                    <Sparkles className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h2 className="text-2xl font-bold text-foreground mb-2">No Flashcards Yet</h2>
                    <p className="text-muted-foreground mb-6">
                        Flashcards will be generated from your course content. Start learning topics to create flashcards!
                    </p>
                    <Link href="/subjects">
                        <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                            Browse Subjects
                        </button>
                    </Link>
                </div>
            </div>
        );
    }

    const currentCard = cards[currentIndex];
    const isComplete = currentIndex >= cards.length - 1;
    const progress = ((currentIndex + 1) / cards.length) * 100;

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <Link href="/subjects" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                        Back to Subjects
                    </Link>
                    <button
                        onClick={resetSession}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset
                    </button>
                </div>

                {/* Progress */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">
                            Card {currentIndex + 1} of {cards.length}
                        </span>
                        <div className="flex gap-4 text-sm">
                            <span className="flex items-center gap-1 text-green-500">
                                <CheckCircle className="w-4 h-4" />
                                {studied.known}
                            </span>
                            <span className="flex items-center gap-1 text-yellow-500">
                                <Brain className="w-4 h-4" />
                                {studied.learning}
                            </span>
                        </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-indigo-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>

                {/* Flashcard */}
                <AnimatePresence mode="wait">
                    {!isComplete ? (
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="mb-8"
                        >
                            <div
                                onClick={() => setIsFlipped(!isFlipped)}
                                className="relative h-96 cursor-pointer perspective-1000"
                            >
                                <motion.div
                                    className="w-full h-full preserve-3d transition-transform duration-500"
                                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                                >
                                    {/* Front */}
                                    <div className="absolute inset-0 backface-hidden bg-card border border-border rounded-2xl p-8 flex flex-col items-center justify-center">
                                        <p className="text-sm text-muted-foreground mb-4">Front</p>
                                        <p className="text-2xl text-center text-foreground font-medium">
                                            {currentCard.front}
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-6">Click to flip</p>
                                    </div>

                                    {/* Back */}
                                    <div
                                        className="absolute inset-0 backface-hidden bg-indigo-950/50 border border-indigo-700 rounded-2xl p-8 flex flex-col items-center justify-center"
                                        style={{ transform: 'rotateY(180deg)' }}
                                    >
                                        <p className="text-sm text-indigo-400 mb-4">Back</p>
                                        <p className="text-xl text-center text-white">
                                            {currentCard.back}
                                        </p>
                                        <p className="text-sm text-indigo-400 mt-6">Click to flip back</p>
                                    </div>
                                </motion.div>
                            </div>

                            {/* Action Buttons */}
                            {isFlipped && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex gap-4 justify-center mt-8"
                                >
                                    <button
                                        onClick={() => handleResponse(false)}
                                        className="flex items-center gap-2 px-8 py-4 bg-yellow-900/20 border border-yellow-700 text-yellow-500 rounded-xl hover:bg-yellow-900/40 transition-colors"
                                    >
                                        <Brain className="w-5 h-5" />
                                        Still Learning
                                    </button>
                                    <button
                                        onClick={() => handleResponse(true)}
                                        className="flex items-center gap-2 px-8 py-4 bg-green-900/20 border border-green-700 text-green-500 rounded-xl hover:bg-green-900/40 transition-colors"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        I Know This
                                    </button>
                                </motion.div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-16"
                        >
                            <CheckCircle className="w-20 h-20 mx-auto mb-6 text-green-500" />
                            <h2 className="text-3xl font-bold text-foreground mb-4">Session Complete!</h2>
                            <p className="text-muted-foreground mb-8">
                                You reviewed {cards.length} flashcards
                            </p>
                            <div className="flex gap-4 justify-center mb-8">
                                <div className="px-6 py-4 bg-green-900/20 border border-green-700 rounded-xl">
                                    <p className="text-2xl font-bold text-green-500">{studied.known}</p>
                                    <p className="text-sm text-green-400">Known</p>
                                </div>
                                <div className="px-6 py-4 bg-yellow-900/20 border border-yellow-700 rounded-xl">
                                    <p className="text-2xl font-bold text-yellow-500">{studied.learning}</p>
                                    <p className="text-sm text-yellow-400">Learning</p>
                                </div>
                            </div>
                            <button
                                onClick={resetSession}
                                className="px-8 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                            >
                                Study Again
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Metadata */}
                <div className="text-center text-sm text-muted-foreground mt-8">
                    <p>{currentCard?.subject} • {currentCard?.topic}</p>
                </div>
            </div>

            <style jsx>{`
                .perspective-1000 {
                    perspective: 1000px;
                }
                .preserve-3d {
                    transform-style: preserve-3d;
                }
                .backface-hidden {
                    backface-visibility: hidden;
                }
            `}</style>
        </div>
    );
}
