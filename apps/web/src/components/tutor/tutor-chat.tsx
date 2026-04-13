'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lightbulb,
    HelpCircle,
    MessageCircle,
    Lock,
    AlertTriangle,
    BookOpen,
    ChevronRight,
    Send,   
    Loader2,
    RefreshCw
} from 'lucide-react';

interface TutorChatProps {
    problemId?: string;
    exerciseId?: string;
    isContestMode?: boolean;
    staticHints?: string[];
    editorial?: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: {
        hintLevel?: number;
        isQuestion?: boolean;
        refusedBecause?: string;
    };
}

export function TutorChat({
    problemId,
    exerciseId,
    isContestMode = false,
    staticHints = [],
    editorial
}: TutorChatProps) {
    const [mode, setMode] = useState<'normal' | 'socratic'>('normal');
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [hintsGiven, setHintsGiven] = useState(0);
    const [solutionRevealed, setSolutionRevealed] = useState(false);
    const [showFallback, setShowFallback] = useState(false);
    const [fallbackReason, setFallbackReason] = useState<string | null>(null);
    const [revealedStaticHints, setRevealedStaticHints] = useState<number[]>([]);

    // Add welcome message on mount
    useEffect(() => {
        if (isContestMode) {
            setMessages([{
                id: '1',
                role: 'system',
                content: '🔒 AI Tutor is disabled during contests to maintain integrity. You can use the static hints below if available.',
            }]);
        } else {
            setMessages([{
                id: '1',
                role: 'assistant',
                content: mode === 'socratic'
                    ? "Hi! I'm here to guide you with questions rather than answers. What part of the problem are you stuck on?"
                    : "Hi! I'm your AI tutor. I can help explain concepts, give hints, or analyze your approach. What would you like help with?",
            }]);
        }
    }, [isContestMode, mode]);

    const sendMessage = useCallback(async () => {
        if (!input.trim() || isLoading || isContestMode) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/tutor/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    problemId,
                    exerciseId,
                    message: input,
                    mode,
                    hintsGiven,
                }),
            });

            if (!response.ok) {
                throw new Error('Tutor unavailable');
            }

            const data = await response.json();

            if (data.fallback) {
                setShowFallback(true);
                setFallbackReason(data.fallbackReason);
                // Log fallback
                await fetch('/api/tutor/fallback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId,
                        reason: data.fallbackReason,
                        fallbackTo: 'static_hint',
                    }),
                });
            } else {
                setSessionId(data.sessionId);
                setHintsGiven(data.hintsGiven || hintsGiven);
                if (data.solutionRevealed) setSolutionRevealed(true);

                const assistantMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.message,
                    metadata: data.metadata,
                };

                setMessages(prev => [...prev, assistantMessage]);
            }
        } catch (error) {
            // Fallback to static hints on error
            setShowFallback(true);
            setFallbackReason('ai_error');
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'system',
                content: '⚠️ AI Tutor is temporarily unavailable. Please use the static hints below or check the editorial.',
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, isContestMode, sessionId, problemId, exerciseId, mode, hintsGiven]);

    const revealStaticHint = (index: number) => {
        if (!revealedStaticHints.includes(index)) {
            setRevealedStaticHints(prev => [...prev, index]);
        }
    };

    const toggleMode = () => {
        setMode(prev => prev === 'normal' ? 'socratic' : 'normal');
        setMessages([{
            id: Date.now().toString(),
            role: 'assistant',
            content: mode === 'normal'
                ? "Switched to Socratic mode! I'll guide you with questions to help you discover the solution yourself."
                : "Switched to normal mode. I can now give you more direct explanations and hints.",
        }]);
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-indigo-500/10">
                        <MessageCircle className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">AI Tutor</h3>
                        <p className="text-xs text-zinc-500">
                            {isContestMode ? 'Disabled during contest' : `${mode === 'socratic' ? 'Socratic' : 'Normal'} mode`}
                        </p>
                    </div>
                </div>

                {!isContestMode && (
                    <button
                        onClick={toggleMode}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                        <HelpCircle className="w-4 h-4" />
                        {mode === 'normal' ? 'Try Socratic' : 'Normal mode'}
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AnimatePresence mode="popLayout">
                    {messages.map((message) => (
                        <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] p-3 rounded-xl text-sm ${message.role === 'user'
                                        ? 'bg-indigo-600 text-white'
                                        : message.role === 'system'
                                            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                                            : 'bg-zinc-900 border border-zinc-800 text-zinc-200'
                                    }`}
                            >
                                {message.metadata?.isQuestion && (
                                    <span className="text-xs text-indigo-400 font-medium block mb-1">
                                        💭 Think about this:
                                    </span>
                                )}
                                <p className="whitespace-pre-wrap">{message.content}</p>
                                {message.metadata?.hintLevel && (
                                    <span className="text-xs text-zinc-500 mt-2 block">
                                        Hint level {message.metadata.hintLevel}/3
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
                            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                        </div>
                    </div>
                )}
            </div>

            {/* Static Hints Fallback */}
            {(showFallback || isContestMode) && staticHints.length > 0 && (
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                    <div className="flex items-center gap-2 text-amber-400 mb-3">
                        <Lightbulb className="w-4 h-4" />
                        <span className="text-sm font-medium">Static Hints</span>
                    </div>
                    <div className="space-y-2">
                        {staticHints.map((hint, idx) => (
                            <div key={idx}>
                                {revealedStaticHints.includes(idx) ? (
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-zinc-300">
                                        <span className="text-xs text-amber-400 font-medium block mb-1">
                                            Hint {idx + 1}
                                        </span>
                                        {hint}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => revealStaticHint(idx)}
                                        className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-400 hover:border-amber-500/50 transition-colors flex items-center justify-between"
                                    >
                                        <span>Reveal Hint {idx + 1}</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    {editorial && (
                        <button
                            onClick={() => window.open(`/problems/${problemId}/editorial`, '_blank')}
                            className="mt-3 w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-400 hover:border-zinc-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <BookOpen className="w-4 h-4" />
                            View Editorial
                        </button>
                    )}
                </div>
            )}

            {/* Input */}
            {!isContestMode && (
                <div className="p-4 border-t border-zinc-800">
                    <div className="flex gap-2">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            placeholder={hintsGiven >= 3 ? "Max hints reached. Try the editorial!" : "Ask for help..."}
                            disabled={hintsGiven >= 3 && !solutionRevealed}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 outline-none disabled:opacity-50"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isLoading || !input.trim() || (hintsGiven >= 3 && !solutionRevealed)}
                            className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-5 h-5 text-white" />
                        </button>
                    </div>
                    {hintsGiven > 0 && hintsGiven < 3 && (
                        <p className="text-xs text-zinc-500 mt-2">
                            {3 - hintsGiven} hints remaining before progressive throttling
                        </p>
                    )}
                </div>
            )}

            {/* Contest Lock Warning */}
            {isContestMode && (
                <div className="p-4 border-t border-zinc-800 bg-red-500/5">
                    <div className="flex items-center gap-2 text-red-400">
                        <Lock className="w-4 h-4" />
                        <span className="text-sm">AI assistance disabled during contest</span>
                    </div>
                </div>
            )}
        </div>
    );
}
