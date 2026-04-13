'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'goal' | 'preferences' | 'diagnostic' | 'review';

type DynQuestion = { id: string; prompt: string; topicName: string; maxScore: number };

export default function OnboardingClient() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('goal');
    const [track] = useState<'coding' | 'law' | 'other'>('coding');
    const [goal, setGoal] = useState('');
    const [hoursPerWeek, setHoursPerWeek] = useState<number | ''>('');
    const [deadlineDays, setDeadlineDays] = useState<number | ''>('');
    const [difficultyPreference, setDifficultyPreference] = useState('comfortable');
    const [learningStyle, setLearningStyle] = useState('hands-on');
    const [aiPersona, setAiPersona] = useState('');
    const [diagnostic, setDiagnostic] = useState<Record<string, number>>({});
    const [fetchedQuestions, setFetchedQuestions] = useState<DynQuestion[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    useEffect(() => {
        if (step !== 'diagnostic') return;

        const load = async () => {
            setLoadingQuestions(true);
            try {
                const res = await fetch(`/api/onboarding/questions?track=${track}&goal=${encodeURIComponent(goal || '')}`);

                // Check if response is ok before parsing JSON
                if (!res.ok) {
                    console.error('Failed to fetch questions:', res.status);
                    setFetchedQuestions([]);
                    return;
                }

                const text = await res.text();
                if (!text || text.trim() === '') {
                    setFetchedQuestions([]);
                    return;
                }

                const data = JSON.parse(text);
                setFetchedQuestions((data.questions || []).map((q: any) => ({
                    id: q.id ?? q.prompt,
                    prompt: q.prompt,
                    topicName: q.topicName,
                    maxScore: q.maxScore ?? 10,
                })));
            } catch (e) {
                console.error('Error loading questions:', e);
                setFetchedQuestions([]);
            } finally {
                setLoadingQuestions(false);
            }
        };
        load();
    }, [step, track, goal]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const nextStep = () => {
        if (step === 'goal') setStep('preferences');
        else if (step === 'preferences') setStep('diagnostic');
        else if (step === 'diagnostic') setStep('review');
    };

    const prevStep = () => {
        if (step === 'review') setStep('diagnostic');
        else if (step === 'diagnostic') setStep('preferences');
        else if (step === 'preferences') setStep('goal');
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            const diagnosticAnswers = fetchedQuestions.map(q => ({
                topicName: q.topicName,
                score: Number(diagnostic[q.id] ?? 0),
            }));
            const res = await fetch('/api/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    track,
                    goal,
                    hoursPerWeek: hoursPerWeek === '' ? null : Number(hoursPerWeek),
                    deadline: deadlineDays === '' ? null : new Date(Date.now() + Number(deadlineDays) * 24 * 60 * 60 * 1000).toISOString(),
                    difficultyPreference,
                    learningStyle,
                    aiPersona,
                    diagnosticAnswers,
                    status: 'complete',
                }),
            });

            // Safely parse response
            const text = await res.text();
            let data: any = {};
            if (text && text.trim()) {
                try {
                    data = JSON.parse(text);
                } catch {
                    // Ignore parse error
                }
            }

            if (!res.ok) {
                throw new Error(data.error || 'Failed to save onboarding');
            }
            router.refresh();
            router.push('/');
        } catch (e: any) {
            setError(e.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-8 relative">
            {loading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-500">
                    <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
                    <div className="text-center space-y-2 animate-pulse">
                        <h2 className="text-xl font-bold">Crafting your custom path...</h2>
                        <p className="text-zinc-400 text-sm max-w-xs mx-auto">
                            Our AI is analyzing your goals and generating a personalized curriculum just for you.
                        </p>
                    </div>
                </div>
            )}
            <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-2xl p-8 space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Onboarding</p>
                        <h1 className="text-2xl font-bold mt-1">Let’s personalize GrindUp</h1>
                    </div>
                    <div className="text-sm text-zinc-500">Step {['goal', 'preferences', 'diagnostic', 'review'].indexOf(step) + 1} / 4</div>
                </div>

                {step === 'goal' && (
                    <div className="space-y-6">
                        <div>
                            <label className="text-sm text-zinc-400">Your goal</label>
                            <input
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                placeholder="e.g., Ace FAANG interviews in 4 months"
                                className="mt-2 w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-zinc-400">Hours per week</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={hoursPerWeek}
                                    onChange={(e) => setHoursPerWeek(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="mt-2 w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-sm text-zinc-400">Target timeline (days, optional)</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={deadlineDays}
                                    onChange={(e) => setDeadlineDays(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="mt-2 w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {step === 'preferences' && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-zinc-400">Difficulty preference</label>
                            <select
                                value={difficultyPreference}
                                onChange={(e) => setDifficultyPreference(e.target.value)}
                                className="mt-2 w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none"
                            >
                                <option value="comfortable">Stay comfortable</option>
                                <option value="stretch">Stretch me</option>
                                <option value="balanced">Balanced</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-zinc-400">Learning style</label>
                            <select
                                value={learningStyle}
                                onChange={(e) => setLearningStyle(e.target.value)}
                                className="mt-2 w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none"
                            >
                                <option value="hands-on">Hands-on</option>
                                <option value="visual">Visual</option>
                                <option value="text">Text-first</option>
                                <option value="socratic">Guided questions</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-zinc-400">AI Persona / Lesson Style</label>
                            <textarea
                                value={aiPersona}
                                onChange={(e) => setAiPersona(e.target.value)}
                                placeholder="e.g. Strict but fair, informal tone. Include lots of diagrams."
                                className="mt-2 w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none h-24 resize-none"
                            />
                        </div>
                    </div>
                )}

                {step === 'diagnostic' && (
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-400">Quick diagnostic (0–10 confidence)</p>
                        {loadingQuestions && <div className="text-sm text-zinc-500">Loading questions…</div>}
                        {!loadingQuestions && fetchedQuestions.map(q => (
                            <div key={q.id} className="p-3 border border-zinc-800 rounded-lg bg-black">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="text-sm text-white flex-1">{q.prompt}</div>
                                    <input
                                        type="number"
                                        min={0}
                                        max={q.maxScore}
                                        value={diagnostic[q.id] ?? ''}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                                            setDiagnostic({
                                                ...diagnostic,
                                                [q.id]: val,
                                            });
                                        }}
                                        className="w-24 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="text-xs text-zinc-500 mt-1">Topic: {q.topicName}</div>
                            </div>
                        ))}
                        {!loadingQuestions && fetchedQuestions.length === 0 && (
                            <div className="text-sm text-zinc-500">No questions available.</div>
                        )}
                    </div>
                )}

                {step === 'review' && (
                    <div className="space-y-3 text-sm text-zinc-300">
                        <div className="p-3 border border-zinc-800 rounded-lg bg-black">
                            <div className="text-zinc-400">Goal</div>
                            <div className="text-white font-medium">{goal || 'Not set'}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 border border-zinc-800 rounded-lg bg-black">
                                <div className="text-zinc-400">Hours / week</div>
                                <div className="text-white font-medium">{hoursPerWeek || 'Not set'}</div>
                            </div>
                            <div className="p-3 border border-zinc-800 rounded-lg bg-black">
                                <div className="text-zinc-400">Timeline (days)</div>
                                <div className="text-white font-medium">{deadlineDays || 'Not set'}</div>
                            </div>
                        </div>
                        <div className="p-3 border border-zinc-800 rounded-lg bg-black">
                            <div className="text-zinc-400">Preferences</div>
                            <div className="text-white font-medium">
                                Difficulty: {difficultyPreference} · Style: {learningStyle}
                            </div>
                            {aiPersona && (
                                <div className="mt-2 text-zinc-400 text-xs italic">
                                    "{aiPersona}"
                                </div>
                            )}
                        </div>
                        <div className="p-3 border border-zinc-800 rounded-lg bg-black">
                            <div className="text-zinc-400">Diagnostic</div>
                            <div className="text-white font-medium space-y-1">
                                {fetchedQuestions.map(q => (
                                    <div key={q.id} className="flex justify-between text-sm">
                                        <span>{q.topicName}</span>
                                        <span>{diagnostic[q.id] ?? 0}/10</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
                        {error}
                    </div>
                )}

                <div className="flex justify-between">
                    <button
                        onClick={prevStep}
                        disabled={step === 'goal'}
                        className="px-4 py-2 rounded-lg border border-zinc-800 text-zinc-300 disabled:opacity-40 hover:border-zinc-700"
                    >
                        Back
                    </button>
                    {step !== 'review' ? (
                        <button
                            onClick={nextStep}
                            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-60"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-60"
                        >
                            {loading ? 'Saving…' : 'Start learning'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
