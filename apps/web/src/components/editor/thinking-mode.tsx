'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain,
    Clock,
    Play,
    Pause,
    StickyNote,
    Lock,
    Unlock,
    CheckCircle2
} from 'lucide-react';

interface ThinkingModeProps {
    problemId: string;
    userId?: string;
    defaultDuration?: number; // seconds
    onComplete?: (notes: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
}

export function ThinkingMode({
    problemId,
    userId,
    defaultDuration = 300, // 5 minutes 
    onComplete,
    onStart,
    onEnd
}: ThinkingModeProps) {
    const [isActive, setIsActive] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(defaultDuration);
    const [timeRemaining, setTimeRemaining] = useState(defaultDuration);
    const [notes, setNotes] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Timer logic
    useEffect(() => {
        if (isActive && !isPaused && timeRemaining > 0) {
            intervalRef.current = setInterval(() => {
                setTimeRemaining(prev => {
                    if (prev <= 1) {
                        handleComplete();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isActive, isPaused, timeRemaining]);

    const startSession = async () => {
        setIsActive(true);
        setTimeRemaining(duration);
        setIsComplete(false);
        onStart?.();

        // Create session in DB
        try {
            const res = await fetch('/api/thinking-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ problemId, duration }),
            });
            if (res.ok) {
                const data = await res.json();
                setSessionId(data.id);
            }
        } catch (error) {
            console.error('Failed to create thinking session:', error);
        }
    };

    const handleComplete = useCallback(async () => {
        setIsActive(false);
        setIsComplete(true);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        onComplete?.(notes);
        onEnd?.();

        // Update session in DB
        if (sessionId) {
            try {
                await fetch(`/api/thinking-sessions/${sessionId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        completed: true,
                        notes,
                        endedAt: new Date().toISOString()
                    }),
                });
            } catch (error) {
                console.error('Failed to update thinking session:', error);
            }
        }
    }, [notes, sessionId, onComplete, onEnd]);

    const endEarly = () => {
        handleComplete();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progressPercent = ((duration - timeRemaining) / duration) * 100;

    // Duration selector
    const durationOptions = [
        { value: 300, label: '5 min' },
        { value: 420, label: '7 min' },
        { value: 600, label: '10 min' },
    ];

    if (!isActive && !isComplete) {
        return (
            <div className="bg-gradient-to-br from-indigo-950/50 to-purple-950/50 rounded-xl border border-indigo-500/30 p-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-indigo-500/20">
                        <Brain className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-white text-lg mb-1">Offline Thinking Mode</h3>
                        <p className="text-sm text-zinc-400 mb-4">
                            Lock the editor and think through the problem before coding.
                            Research shows this improves solution quality and reduces debugging time.
                        </p>

                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-sm text-zinc-500">Duration:</span>
                            <div className="flex gap-2">
                                {durationOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setDuration(opt.value)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${duration === opt.value
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={startSession}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors"
                        >
                            <Lock className="w-4 h-4" />
                            Start Thinking Session
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isComplete) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-green-950/50 to-emerald-950/50 rounded-xl border border-green-500/30 p-6"
            >
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-xl bg-green-500/20">
                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white text-lg">Thinking Complete!</h3>
                        <p className="text-sm text-zinc-400">
                            Editor is now unlocked. Start coding with your clear plan.
                        </p>
                    </div>
                </div>

                {notes && (
                    <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 mb-4">
                        <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                            <StickyNote className="w-4 h-4" />
                            Your Notes
                        </h4>
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap">{notes}</p>
                    </div>
                )}

                <button
                    onClick={() => {
                        setIsComplete(false);
                        setNotes('');
                    }}
                    className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                    Dismiss
                </button>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-gradient-to-br from-indigo-950/80 to-purple-950/80 rounded-xl border border-indigo-500/50 p-6"
        >
            {/* Timer */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/20">
                        <Lock className="w-5 h-5 text-indigo-400 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Editor Locked</h3>
                        <p className="text-xs text-indigo-300">Think before you code</p>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-3xl font-mono font-bold text-white">
                        {formatTime(timeRemaining)}
                    </div>
                    <p className="text-xs text-zinc-500">remaining</p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-zinc-900 rounded-full overflow-hidden mb-6">
                <motion.div
                    className="h-full bg-gradient-to-r from-indigo-600 to-purple-600"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5 }}
                />
            </div>

            {/* Notes area */}
            <div className="mb-4">
                <label className="text-sm text-zinc-400 mb-2 flex items-center gap-2">
                    <StickyNote className="w-4 h-4" />
                    Jot down your thoughts (scratchpad only)
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="• What pattern does this remind me of?
• What are the key constraints?
• What edge cases should I consider?
• Time/space complexity target?"
                    className="w-full h-32 bg-zinc-900/80 border border-indigo-500/30 rounded-lg p-3 text-sm text-white placeholder:text-zinc-600 resize-none focus:border-indigo-500 outline-none"
                />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-300 transition-colors"
                >
                    {isPaused ? (
                        <>
                            <Play className="w-4 h-4" />
                            Resume
                        </>
                    ) : (
                        <>
                            <Pause className="w-4 h-4" />
                            Pause
                        </>
                    )}
                </button>

                <button
                    onClick={endEarly}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors"
                >
                    <Unlock className="w-4 h-4" />
                    End & Unlock Editor
                </button>
            </div>
        </motion.div>
    );
}
