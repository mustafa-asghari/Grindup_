'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, AlertTriangle, Shield, Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';

interface ContestProblem {
    id: string;
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    points: number;
    solved: boolean;
}

interface ContestModeProps {
    contestId: string;
    contestTitle: string;
    startTime: Date;
    endTime: Date;
    problems: ContestProblem[];
    currentProblemId?: string;
    onSelectProblem?: (id: string) => void;
    onSubmit: (problemId: string, code: string) => Promise<boolean>;
    onIntegrityViolation: (type: string) => void;
}

export function ContestMode({
    contestId,
    contestTitle,
    startTime,
    endTime,
    problems,
    currentProblemId,
    onSelectProblem,
    onSubmit,
    onIntegrityViolation,
}: ContestModeProps) {
    const [timeLeft, setTimeLeft] = useState(0);
    const [isProctoring, setIsProctoring] = useState(true);
    const [tabSwitches, setTabSwitches] = useState(0);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const [fullscreenExited, setFullscreenExited] = useState(0);
    const warningAudioRef = useRef<HTMLAudioElement | null>(null);

    // Timer
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const remaining = Math.max(0, endTime.getTime() - now.getTime());
            setTimeLeft(remaining);

            if (remaining === 0) {
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [endTime]);

    // Tab switch detection
    useEffect(() => {
        if (!isProctoring) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setTabSwitches(prev => prev + 1);
                const msg = `Tab switch detected at ${new Date().toLocaleTimeString()}`;
                setWarnings(prev => [...prev, msg]);
                onIntegrityViolation('tab_switch');
                playWarningSound();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isProctoring, onIntegrityViolation]);

    // Fullscreen exit detection
    useEffect(() => {
        if (!isProctoring) return;

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setFullscreenExited(prev => prev + 1);
                const msg = `Fullscreen exit detected at ${new Date().toLocaleTimeString()}`;
                setWarnings(prev => [...prev, msg]);
                onIntegrityViolation('fullscreen_exit');
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [isProctoring, onIntegrityViolation]);

    // Copy/paste prevention
    useEffect(() => {
        if (!isProctoring) return;

        const handleCopy = (e: ClipboardEvent) => {
            e.preventDefault();
            const msg = `Copy attempt blocked at ${new Date().toLocaleTimeString()}`;
            setWarnings(prev => [...prev, msg]);
            onIntegrityViolation('copy_attempt');
        };

        const handlePaste = (e: ClipboardEvent) => {
            // Allow paste in code editor (controlled by parent)
            const target = e.target as HTMLElement;
            if (!target.closest('.contest-code-editor')) {
                e.preventDefault();
                const msg = `Paste attempt blocked at ${new Date().toLocaleTimeString()}`;
                setWarnings(prev => [...prev, msg]);
                onIntegrityViolation('paste_attempt');
            }
        };

        document.addEventListener('copy', handleCopy);
        document.addEventListener('paste', handlePaste);
        return () => {
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('paste', handlePaste);
        };
    }, [isProctoring, onIntegrityViolation]);

    const playWarningSound = () => {
        if (!isMuted && warningAudioRef.current) {
            warningAudioRef.current.play().catch(() => { });
        }
    };

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    };

    const totalPoints = problems.reduce((sum, p) => sum + p.points, 0);
    const earnedPoints = problems.filter(p => p.solved).reduce((sum, p) => sum + p.points, 0);
    const solvedCount = problems.filter(p => p.solved).length;

    const timePercent = ((endTime.getTime() - startTime.getTime() - timeLeft) / (endTime.getTime() - startTime.getTime())) * 100;
    const isLowTime = timeLeft < 600000; // Less than 10 minutes
    const isCriticalTime = timeLeft < 300000; // Less than 5 minutes

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800">
            {/* Warning sound */}
            <audio ref={warningAudioRef} src="/sounds/warning.mp3" preload="auto" />

            <div className="max-w-7xl mx-auto px-6 py-3">
                <div className="flex items-center justify-between">
                    {/* Contest Info */}
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-white">{contestTitle}</h1>
                            <div className="flex items-center gap-2 text-sm text-zinc-500">
                                <span>{solvedCount}/{problems.length} solved</span>
                                <span>•</span>
                                <span>{earnedPoints}/{totalPoints} pts</span>
                            </div>
                        </div>
                    </div>

                    {/* Timer */}
                    <div className="flex flex-col items-end">
                        <div className={`flex items-center gap-3 px-6 py-2 rounded-xl mb-1 ${isCriticalTime
                            ? 'bg-red-500/20 border border-red-500/30'
                            : isLowTime
                                ? 'bg-amber-500/20 border border-amber-500/30'
                                : 'bg-zinc-900 border border-zinc-800'
                            }`}>
                            <Clock className={`w-5 h-5 ${isCriticalTime ? 'text-red-400 animate-pulse' : isLowTime ? 'text-amber-400' : 'text-zinc-400'
                                }`} />
                            <div className="flex flex-col text-right">
                                <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Time Remaining</span>
                                <span className={`text-2xl font-mono font-bold leading-none ${isCriticalTime ? 'text-red-400' : isLowTime ? 'text-amber-400' : 'text-white'
                                    }`}>
                                    {formatTime(timeLeft)}
                                </span>
                            </div>
                        </div>
                        <div className="text-xs text-zinc-500 font-mono">
                            Duration: {Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 10)) / 10).toFixed(1)}h
                        </div>
                    </div>

                    {/* Proctoring Controls */}
                    <div className="flex items-center gap-3">
                        {/* Integrity Status */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${tabSwitches > 0 || fullscreenExited > 0
                            ? 'bg-red-500/10 border border-red-500/20'
                            : 'bg-green-500/10 border border-green-500/20'
                            }`}>
                            <Shield className={`w-4 h-4 ${tabSwitches > 0 || fullscreenExited > 0 ? 'text-red-400' : 'text-green-400'
                                }`} />
                            <span className={`text-sm ${tabSwitches > 0 || fullscreenExited > 0 ? 'text-red-400' : 'text-green-400'
                                }`}>
                                {tabSwitches > 0 || fullscreenExited > 0
                                    ? `${tabSwitches + fullscreenExited} violations`
                                    : 'Clean'
                                }
                            </span>
                        </div>

                        {/* Proctoring Toggle */}
                        <button
                            onClick={() => setIsProctoring(!isProctoring)}
                            className={`p-2 rounded-lg transition-colors ${isProctoring
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-zinc-800 text-zinc-500'
                                }`}
                            title={isProctoring ? 'Proctoring enabled' : 'Proctoring disabled'}
                        >
                            {isProctoring ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                        </button>

                        {/* Sound Toggle */}
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        >
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Time Progress Bar */}
                <div className="mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${timePercent}%` }}
                        className={`h-full ${isCriticalTime
                            ? 'bg-red-500'
                            : isLowTime
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                            }`}
                    />
                </div>

                {/* Problem Pills */}
                <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                    {problems.map((problem, idx) => (
                        <button
                            key={problem.id}
                            onClick={() => onSelectProblem?.(problem.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${problem.solved
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : currentProblemId === problem.id
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
                                }`}
                        >
                            {idx + 1}. {problem.title}
                            <span className="ml-2 text-xs opacity-60">{problem.points}pts</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Warning Toast */}
            <AnimatePresence>
                {warnings.length > 0 && warnings.length <= 3 && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-[140px] right-6 w-80 p-4 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-xl"
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-300">Integrity Warning</p>
                                <p className="text-sm text-red-400/70 mt-1">{warnings[warnings.length - 1]}</p>
                                {tabSwitches >= 3 && (
                                    <p className="text-xs text-red-400 mt-2">
                                        ⚠️ Multiple violations may result in contest disqualification
                                    </p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
