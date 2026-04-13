'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Play } from 'lucide-react';

type MCQContent = {
    question?: string;
    options?: string[];
    correctAnswers?: number[];
    correctAnswer?: number;
    correct?: number | number[];
    answer?: number | number[];
};

type FlashcardContent = {
    front?: string;
    back?: string;
};

type MCQQuestion = {
    id: string;
    title: string;
    type: 'MCQ';
    content: MCQContent;
    points: number;
};

type FlashcardQuestion = {
    id: string;
    title: string;
    type: 'FLASHCARD';
    content: FlashcardContent;
    points: number;
};

type Question = MCQQuestion | FlashcardQuestion;

interface AssessmentClientProps {
    subjectId: string;
    subjectSlug: string;
    topicId?: string; // Optional: assess specific topic vs whole subject
    subjectName: string;
    questions: Question[];
}

export function AssessmentClient({ subjectId, subjectSlug, subjectName, questions: initialQuestions }: AssessmentClientProps) {
    const router = useRouter();
    const [status, setStatus] = useState<'intro' | 'active' | 'review' | 'submitting'>('intro');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, number | string | undefined>>({}); // questionId -> answer

    // Timer
    const durationMinutes = 20; // Hardcoded for now
    const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);

    // Results (after grading)
    type Result = {
        score: number;
        totalPoints: number;
        correctCount: number;
        details: { questionId: string; isCorrect: boolean; userAnswer: number | string | undefined }[];
    };
    const [results, setResults] = useState<Result | null>(null);

    const submitAssessment = useCallback(async () => {
        setStatus('submitting');

        let score = 0;
        let totalPoints = 0;
        let correctCount = 0;
        const details: Result['details'] = [];

        for (const q of initialQuestions) {
            totalPoints += q.points;
            const userAns = answers[q.id];
            let isCorrect = false;

            if (q.type === 'MCQ') {
                const correctAnswers = q.content.correctAnswers || q.content.correctAnswer || q.content.correct;

                if (Array.isArray(correctAnswers)) {
                    isCorrect = correctAnswers.includes(Number(userAns));
                } else if (typeof correctAnswers === 'number') {
                    isCorrect = Number(userAns) === correctAnswers;
                }

                if (!isCorrect && q.content.answer !== undefined) {
                    if (typeof q.content.answer === 'number') {
                        isCorrect = Number(userAns) === q.content.answer;
                    } else if (Array.isArray(q.content.answer)) {
                        isCorrect = q.content.answer.includes(Number(userAns));
                    }
                }
            } else if (q.type === 'FLASHCARD') {
                isCorrect = userAns === 'known';
            }

            if (isCorrect) {
                score += q.points;
                correctCount++;
            }
            details.push({ questionId: q.id, isCorrect, userAnswer: userAns });

            if (userAns !== undefined) {
                // Format response correctly based on question type
                const formattedResponse = q.type === 'MCQ'
                    ? { selectedIndices: [Number(userAns)] }  // MCQ expects { selectedIndices: number[] }
                    : { rating: userAns === 'known' ? 'GOOD' : 'AGAIN' };  // Flashcard expects { rating: string }

                fetch('/api/exercises/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exerciseId: q.id, response: formattedResponse, timeSpentSecs: 60, subjectId })
                }).catch(() => {});
            }
        }

        setResults({ score, totalPoints, correctCount, details });
        setStatus('review');
    }, [answers, initialQuestions, subjectId]);

    useEffect(() => {
        if (status === 'active' && timeLeft > 0) {
            const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
            return () => clearInterval(timer);
        }
        if (status === 'active' && timeLeft === 0) {
            void submitAssessment();
        }
    }, [status, timeLeft, submitAssessment]);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleAnswer = (questionId: string, value: number | string) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    if (status === 'intro') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative"
                >
                    <div className="w-24 h-24 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-full flex items-center justify-center mb-6 border-2 border-yellow-500/30">
                        <span className="text-5xl">🏆</span>
                    </div>
                    <div className="absolute -top-2 -right-2 px-2 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold rounded-full">
                        FINAL BOSS
                    </div>
                </motion.div>
                <h1 className="text-3xl font-bold mb-2">{subjectName}</h1>
                <h2 className="text-xl text-yellow-400 font-semibold mb-4">🎯 Final Assessment</h2>
                <p className="text-gray-400 max-w-md mb-8">
                    This is the ultimate test of your knowledge! Questions from <strong className="text-white">all topics</strong> will be mixed together.
                    You have {durationMinutes} minutes to prove your mastery.
                </p>
                <div className="bg-gray-900 border border-yellow-500/20 rounded-xl p-6 mb-8 w-full max-w-sm">
                    <div className="flex justify-between mb-3">
                        <span className="text-gray-400">Questions</span>
                        <span className="font-bold text-white">{initialQuestions.length}</span>
                    </div>
                    <div className="flex justify-between mb-3">
                        <span className="text-gray-400">Time Limit</span>
                        <span className="font-bold text-white">{durationMinutes} mins</span>
                    </div>
                    <div className="flex justify-between pt-3 border-t border-gray-800">
                        <span className="text-gray-400">Coverage</span>
                        <span className="font-bold text-yellow-400">All Topics</span>
                    </div>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setStatus('active')}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black px-10 py-4 rounded-xl font-bold text-lg flex items-center gap-2 shadow-lg shadow-yellow-500/25"
                >
                    <Play className="w-5 h-5 fill-current" />
                    Begin Final Challenge
                </motion.button>
                <p className="text-gray-600 text-sm mt-6">
                    💡 Take your time and think carefully. Good luck!
                </p>
            </div>
        );
    }


    if (status === 'review' && results) {
        const percentage = Math.round((results.score / results.totalPoints) * 100);
        const isPassing = percentage >= 70;

        return (
            <div className="max-w-3xl mx-auto p-8 text-center">
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="mb-6"
                >
                    {isPassing ? (
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-500/20 to-green-500/20 rounded-full border-2 border-green-500/30">
                            <span className="text-5xl">🎉</span>
                        </div>
                    ) : (
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full border-2 border-orange-500/30">
                            <span className="text-5xl">💪</span>
                        </div>
                    )}
                </motion.div>

                <h2 className="text-3xl font-bold mb-2">
                    {isPassing ? 'Congratulations!' : 'Assessment Complete'}
                </h2>
                <p className="text-gray-400 mb-4">
                    {isPassing ? "You've mastered this subject!" : "Keep practicing, you're getting better!"}
                </p>

                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className={`text-7xl font-black mb-6 ${isPassing ? 'text-green-400' : 'text-orange-400'}`}
                >
                    {percentage}%
                </motion.div>

                <p className="text-gray-500 mb-12">
                    {results.correctCount} out of {initialQuestions.length} questions correct • {results.score}/{results.totalPoints} points
                </p>

                <div className="grid gap-4 text-left mb-12">
                    {initialQuestions.map(q => {
                        const res = results.details.find(d => d.questionId === q.id);
                        return (
                            <motion.div
                                key={q.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`p-4 rounded-xl border ${res?.isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <h4 className="font-medium text-gray-200">{q.title}</h4>
                                    {res?.isCorrect ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 text-red-500" />
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => router.push(`/subjects/${subjectSlug}`)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg"
                    >
                        🏠 Return to Subject
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => router.push('/')}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-medium border border-gray-700"
                    >
                        📊 Go to Dashboard
                    </motion.button>
                </div>
            </div>
        );
    }

    // Active State
    const currentQ = initialQuestions[currentQuestionIndex];
    const questionTitle = currentQ.type === 'MCQ'
        ? currentQ.content.question ?? currentQ.title
        : currentQ.content.front ?? currentQ.title;
    const mcqOptions = currentQ.type === 'MCQ' ? currentQ.content.options ?? [] : [];

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <span className="text-sm text-gray-400">Question {currentQuestionIndex + 1} of {initialQuestions.length}</span>
                    <div className="h-2 w-32 bg-gray-800 rounded-full mt-1 overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${((currentQuestionIndex + 1) / initialQuestions.length) * 100}%` }}
                        />
                    </div>
                </div>
                <div className="px-4 py-2 bg-gray-800 rounded-lg font-mono text-xl font-bold text-white border border-gray-700">
                    {formatTime(timeLeft)}
                </div>
            </div>

            {/* Question Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 min-h-[400px] flex flex-col">
                <h3 className="text-xl font-bold mb-6">{questionTitle}</h3>

                <div className="flex-1">
                    {currentQ.type === 'MCQ' && (
                        <div className="space-y-3">
                            {mcqOptions.map((opt: string, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAnswer(currentQ.id, idx)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all ${answers[currentQ.id] === idx
                                        ? 'border-blue-500 bg-blue-500/10 text-white'
                                        : 'border-gray-700 hover:border-gray-600 text-gray-300'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    )}
                    {currentQ.type === 'FLASHCARD' && (
                        <div className="text-center p-12 bg-gray-800 rounded-xl">
                            <p className="italic text-gray-400">For flashcards, just mark if you know it.</p>
                            <div className="flex justify-center gap-4 mt-8">
                                <button
                                    onClick={() => handleAnswer(currentQ.id, 'known')}
                                    className={`px-6 py-3 rounded-lg bg-green-900/30 text-green-400 border border-green-900 ${answers[currentQ.id] === 'known' ? 'ring-2 ring-green-500' : ''}`}
                                >
                                    I know this
                                </button>
                                <button
                                    onClick={() => handleAnswer(currentQ.id, 'unknown')}
                                    className={`px-6 py-3 rounded-lg bg-red-900/30 text-red-400 border border-red-900 ${answers[currentQ.id] === 'unknown' ? 'ring-2 ring-red-500' : ''}`}
                                >
                                    I don&apos;t know
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Nav */}
                <div className="flex justify-between mt-8 pt-8 border-t border-gray-800">
                    <button
                        onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentQuestionIndex === 0}
                        className="px-6 py-3 rounded-lg text-gray-400 hover:text-white disabled:opacity-30"
                    >
                        Previous
                    </button>

                    {currentQuestionIndex < initialQuestions.length - 1 ? (
                        <button
                            onClick={() => setCurrentQuestionIndex(prev => Math.min(initialQuestions.length - 1, prev + 1))}
                            className="bg-white text-black px-8 py-3 rounded-lg font-bold hover:bg-gray-200"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={submitAssessment}
                            className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-500"
                        >
                            Submit All
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
