'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Calendar, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

interface Question {
    id: string;
    prompt: string;
    topicName: string;
    topicId?: string;
    maxScore: number;
}

interface SetupClientProps {
    subject: {
        id: string;
        name: string;
        slug: string;
        category: string;
    };
}

export function SetupClient({ subject }: SetupClientProps) {
    const router = useRouter();
    const [step, setStep] = useState<'goals' | 'diagnostic' | 'generating' | 'done'>('goals');

    // Goals State
    const [hoursPerWeek, setHoursPerWeek] = useState<number>(5);
    const [deadlineMonths, setDeadlineMonths] = useState<number>(3);

    // Diagnostic State
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [answers, setAnswers] = useState<Record<string, number>>({}); // id -> score (0-10) self-rating for now?
    // Note: The API returns "diagnostic questions" which are usually self-relfection or simple conceptual prompts.
    // Real MCQs would require options. The current API (from onboarding) seems to return prompts.
    // If they are prompts, we might ask user to "Rate your confidence on this topic".

    const fetchQuestions = useCallback(async () => {
        setIsLoadingQuestions(true);
        try {
            // Pass subjectId to ensure questions match real DB topics
            const res = await fetch(`/api/onboarding/questions?subjectId=${subject.id}&track=${encodeURIComponent(subject.name)}&goal=${encodeURIComponent(subject.category)}`);
            if (res.ok) {
                const data = await res.json();
                // Ensure questions have IDs (AI generated ones might not)
                const mappedQuestions: Question[] = (data.questions.slice(0, 5) || []).map((q: Partial<Question>, idx: number) => ({
                    id: q.id || `q-${idx}`,
                    prompt: q.prompt || 'Untitled question',
                    topicName: q.topicName || 'General',
                    topicId: q.topicId,
                    maxScore: q.maxScore ?? 10
                }));
                setQuestions(mappedQuestions);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingQuestions(false);
        }
    }, [subject.category, subject.id, subject.name]);

    useEffect(() => {
        if (step === 'diagnostic') {
            void fetchQuestions();
        }
    }, [step, fetchQuestions]);

    const handleEnroll = async () => {
        setStep('generating');

        try {
            const targetDeadline = new Date();
            targetDeadline.setMonth(targetDeadline.getMonth() + deadlineMonths);

            const diagnosticResults = questions.map(q => ({
                topicName: q.topicName,
                topicId: q.topicId,
                score: answers[q.id] || 0
            }));

            const res = await fetch('/api/subjects/generate-roadmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subjectId: subject.id,
                    goalHoursPerWeek: hoursPerWeek,
                    targetDeadline: targetDeadline.toISOString(),
                    diagnosticResults
                }),
            });

            if (res.ok) {
                setStep('done');
                setTimeout(() => {
                    router.push(`/subjects/${subject.slug}`);
                    router.refresh();
                }, 1500);
            }
        } catch (e) {
            console.error('Enrollment failed', e);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
            <div className="max-w-2xl w-full">
                <div className="mb-12">
                    <h1 className="text-3xl font-bold mb-2">Setup {subject.name}</h1>
                    <div className="flex items-center gap-2 text-gray-500">
                        <div className={`h-1 flex-1 rounded-full ${step === 'goals' ? 'bg-blue-600' : 'bg-gray-800'}`} />
                        <div className={`h-1 flex-1 rounded-full ${step === 'diagnostic' ? 'bg-blue-600' : 'bg-gray-800'}`} />
                        <div className={`h-1 flex-1 rounded-full ${step === 'generating' || step === 'done' ? 'bg-green-600' : 'bg-gray-800'}`} />
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {step === 'goals' && (
                        <motion.div
                            key="goals"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div>
                                <h2 className="text-2xl font-semibold mb-6">Learning Goals</h2>

                                <div className="space-y-6">
                                    <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800">
                                        <label className="flex items-center gap-3 text-lg font-medium mb-4">
                                            <Clock className="w-5 h-5 text-blue-400" />
                                            Weekly Commitment
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range"
                                                min="1"
                                                max="40"
                                                value={hoursPerWeek}
                                                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                                                className="flex-1 accent-blue-600"
                                            />
                                            <span className="text-2xl font-bold w-16 text-right">{hoursPerWeek}h</span>
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800">
                                        <label className="flex items-center gap-3 text-lg font-medium mb-4">
                                            <Calendar className="w-5 h-5 text-purple-400" />
                                            Target Deadline
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range"
                                                min="1"
                                                max="12"
                                                value={deadlineMonths}
                                                onChange={(e) => setDeadlineMonths(Number(e.target.value))}
                                                className="flex-1 accent-purple-600"
                                            />
                                            <span className="text-2xl font-bold w-16 text-right">{deadlineMonths}mo</span>
                                        </div>
                                        <p className="text-gray-500 text-sm mt-2 text-right">
                                            Target: {new Date(new Date().setMonth(new Date().getMonth() + deadlineMonths)).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => setStep('diagnostic')}
                                    className="px-8 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2"
                                >
                                    Continue <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'diagnostic' && (
                        <motion.div
                            key="diagnostic"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div>
                                <h2 className="text-2xl font-semibold mb-2">Diagnostic Check</h2>
                                <p className="text-gray-400 mb-6">Rate your confidence in these topics to help us customize your roadmap.</p>

                                {isLoadingQuestions ? (
                                    <div className="py-20 flex flex-col items-center justify-center text-gray-500">
                                        <Loader2 className="w-8 h-8 animate-spin mb-4" />
                                        <p>Generating questions...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {questions.map((q, idx) => (
                                            <div key={q.id || idx} className="p-6 rounded-2xl bg-gray-900 border border-gray-800">
                                                <div className="flex justify-between items-start mb-4">
                                                    <h3 className="font-medium text-lg text-gray-200">{q.prompt}</h3>
                                                    <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-500">{q.topicName}</span>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm text-gray-500">
                                                        <span>No idea</span>
                                                        <span>Expert</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="10"
                                                        value={answers[q.id] || 0}
                                                        onChange={(e) => setAnswers({ ...answers, [q.id]: Number(e.target.value) })}
                                                        className="w-full accent-green-500"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between">
                                <button
                                    onClick={() => setStep('goals')}
                                    className="text-gray-500 hover:text-white"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleEnroll}
                                    disabled={questions.length === 0 && isLoadingQuestions} // Wait for questions
                                    className="px-8 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    Generate Roadmap <CheckCircle2 className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 'generating' && (
                        <motion.div
                            key="generating"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center py-20 text-center"
                        >
                            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
                            <h2 className="text-2xl font-bold mb-2">Creating your personalized plan...</h2>
                            <p className="text-gray-500">Analyzing your goals and diagnostic results</p>
                        </motion.div>
                    )}

                    {step === 'done' && (
                        <motion.div
                            key="done"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-20 text-center"
                        >
                            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle2 className="w-10 h-10 text-black" />
                            </div>
                            <h2 className="text-3xl font-bold mb-2">You're all set!</h2>
                            <p className="text-gray-500">Redirecting to your dashboard...</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
