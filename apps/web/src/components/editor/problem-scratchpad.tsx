'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    StickyNote,
    Save,
    FileText,
    Lightbulb,
    Check,
    Loader2,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

interface ProblemScratchpadProps {
    problemId: string;
    userId?: string;
    onSave?: (notes: string, approach: string) => void;
}

export function ProblemScratchpad({ problemId, userId, onSave }: ProblemScratchpadProps) {
    const [notes, setNotes] = useState('');
    const [approach, setApproach] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const [activeTab, setActiveTab] = useState<'approach' | 'notes'>('approach');

    // Load saved scratchpad
    useEffect(() => {
        const loadScratchpad = async () => {
            try {
                const res = await fetch(`/api/problems/${problemId}/scratchpad`);
                if (res.ok) {
                    const data = await res.json();
                    setNotes(data.notes || '');
                    setApproach(data.approach || '');
                }
            } catch (error) {
                console.error('Failed to load scratchpad:', error);
            }
        };

        if (userId) {
            loadScratchpad();
        }
    }, [problemId, userId]);

    // Auto-save with debounce
    const saveToServer = useCallback(async (notesValue: string, approachValue: string) => {
        if (!userId) return;

        setIsSaving(true);
        try {
            const res = await fetch(`/api/problems/${problemId}/scratchpad`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: notesValue, approach: approachValue }),
            });
            if (res.ok) {
                setLastSaved(new Date());
                onSave?.(notesValue, approachValue);
            }
        } catch (error) {
            console.error('Failed to save scratchpad:', error);
        } finally {
            setIsSaving(false);
        }
    }, [problemId, userId, onSave]);

    // Debounced save
    useEffect(() => {
        const timer = setTimeout(() => {
            if (notes || approach) {
                saveToServer(notes, approach);
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, [notes, approach, saveToServer]);

    return (
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-zinc-900/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                        <StickyNote className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-semibold text-white">Scratchpad & Planning</h3>
                        <p className="text-xs text-zinc-500">
                            Write your approach before coding
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isSaving && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                    {lastSaved && !isSaving && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <Check className="w-3 h-3 text-green-500" />
                            Saved
                        </span>
                    )}
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-zinc-500" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-zinc-500" />
                    )}
                </div>
            </button>

            {/* Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="border-t border-zinc-800">
                            {/* Tabs */}
                            <div className="flex border-b border-zinc-800">
                                <button
                                    onClick={() => setActiveTab('approach')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'approach'
                                            ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/5'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    <Lightbulb className="w-4 h-4" />
                                    Pre-Code Approach
                                </button>
                                <button
                                    onClick={() => setActiveTab('notes')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'notes'
                                            ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    <FileText className="w-4 h-4" />
                                    Notes
                                </button>
                            </div>

                            {/* Approach Tab */}
                            {activeTab === 'approach' && (
                                <div className="p-4">
                                    <div className="mb-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                                        <p className="text-xs text-amber-200">
                                            💡 <strong>Tip:</strong> Before writing code, outline your approach:
                                        </p>
                                        <ul className="text-xs text-zinc-400 mt-2 space-y-1 list-disc list-inside">
                                            <li>What pattern/algorithm will you use?</li>
                                            <li>What data structures do you need?</li>
                                            <li>What are the edge cases?</li>
                                            <li>What's the time/space complexity?</li>
                                        </ul>
                                    </div>
                                    <textarea
                                        value={approach}
                                        onChange={(e) => setApproach(e.target.value)}
                                        placeholder="Describe your approach before coding..."
                                        className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white placeholder:text-zinc-600 resize-none focus:border-amber-500 outline-none"
                                    />
                                </div>
                            )}

                            {/* Notes Tab */}
                            {activeTab === 'notes' && (
                                <div className="p-4">
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Free-form notes, observations, test cases to try..."
                                        className="w-full h-48 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white placeholder:text-zinc-600 resize-none focus:border-blue-500 outline-none font-mono"
                                    />
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
