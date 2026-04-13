'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Check, Calendar, Target, AlertTriangle, Edit2, Save } from 'lucide-react';

interface LearningContractProps {
    subjectId: string;
    subjectName: string;
    existingContract?: {
        id: string;
        weeklyHoursCommitment: number;
        targetCompletionDate: string | null;
        goals: string[];
        signedAt: string;
    };
    onSave: (contract: {
        weeklyHours: number;
        targetDate: string | null;
        goals: string[];
    }) => Promise<void>;
}

export function LearningContract({
    subjectId,
    subjectName,
    existingContract,
    onSave,
}: LearningContractProps) {
    const [isEditing, setIsEditing] = useState(!existingContract);
    const [weeklyHours, setWeeklyHours] = useState(existingContract?.weeklyHoursCommitment || 5);
    const [targetDate, setTargetDate] = useState(existingContract?.targetCompletionDate || '');
    const [goals, setGoals] = useState<string[]>(existingContract?.goals || ['']);
    const [isSaving, setIsSaving] = useState(false);

    const handleAddGoal = () => {
        if (goals.length < 5) {
            setGoals([...goals, '']);
        }
    };

    const handleUpdateGoal = (index: number, value: string) => {
        const newGoals = [...goals];
        newGoals[index] = value;
        setGoals(newGoals);
    };

    const handleRemoveGoal = (index: number) => {
        if (goals.length > 1) {
            setGoals(goals.filter((_, i) => i !== index));
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({
                weeklyHours,
                targetDate: targetDate || null,
                goals: goals.filter(g => g.trim()),
            });
            setIsEditing(false);
        } finally {
            setIsSaving(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden"
        >
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Learning Contract</h3>
                        <p className="text-sm text-zinc-500">{subjectName}</p>
                    </div>
                </div>
                {existingContract && !isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                    >
                        <Edit2 className="w-4 h-4" />
                        <span className="text-sm">Edit</span>
                    </button>
                )}
            </div>

            <div className="p-6 space-y-6">
                <AnimatePresence mode="wait">
                    {isEditing ? (
                        <motion.div
                            key="editing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-6"
                        >
                            {/* Weekly Commitment */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Weekly Time Commitment
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1"
                                        max="40"
                                        value={weeklyHours}
                                        onChange={(e) => setWeeklyHours(Number(e.target.value))}
                                        className="flex-1 h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <span className="text-xl font-bold text-white min-w-[60px] text-right">
                                        {weeklyHours}h/wk
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-600 mt-1">
                                    {weeklyHours < 5 && "Light commitment - great for busy schedules"}
                                    {weeklyHours >= 5 && weeklyHours < 15 && "Moderate commitment - steady progress"}
                                    {weeklyHours >= 15 && weeklyHours < 30 && "Intensive commitment - rapid progress"}
                                    {weeklyHours >= 30 && "Full-time commitment - immersive learning"}
                                </p>
                            </div>

                            {/* Target Date */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Target Completion Date (Optional)
                                </label>
                                <input
                                    type="date"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    style={{ colorScheme: 'dark' }}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>

                            {/* Personal Goals */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Personal Learning Goals
                                </label>
                                <div className="space-y-2">
                                    {goals.map((goal, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={goal}
                                                onChange={(e) => handleUpdateGoal(idx, e.target.value)}
                                                placeholder={`Goal ${idx + 1}...`}
                                                className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                                            />
                                            {goals.length > 1 && (
                                                <button
                                                    onClick={() => handleRemoveGoal(idx)}
                                                    className="px-3 py-2 bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg transition-colors"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {goals.length < 5 && (
                                    <button
                                        onClick={handleAddGoal}
                                        className="mt-2 text-sm text-blue-400 hover:text-blue-300"
                                    >
                                        + Add another goal
                                    </button>
                                )}
                            </div>

                            {/* Commitment Statement */}
                            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                                <p className="text-sm text-zinc-300 leading-relaxed">
                                    By saving this contract, I commit to dedicating{' '}
                                    <strong className="text-white">{weeklyHours} hours per week</strong> to studying{' '}
                                    <strong className="text-white">{subjectName}</strong>
                                    {targetDate && (
                                        <>
                                            {' '}with a goal to complete by{' '}
                                            <strong className="text-white">{formatDate(targetDate)}</strong>
                                        </>
                                    )}
                                    . I understand that consistent effort is key to mastery.
                                </p>
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end gap-3">
                                {existingContract && (
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="px-6 py-3 rounded-xl text-zinc-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    {isSaving ? 'Saving...' : 'Sign Contract'}
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="viewing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-4"
                        >
                            {/* Contract Details */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-zinc-900/50 rounded-xl">
                                    <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
                                        <Calendar className="w-4 h-4" />
                                        Weekly Commitment
                                    </div>
                                    <div className="text-2xl font-bold text-white">
                                        {existingContract?.weeklyHoursCommitment}h/wk
                                    </div>
                                </div>
                                {existingContract?.targetCompletionDate && (
                                    <div className="p-4 bg-zinc-900/50 rounded-xl">
                                        <div className="flex items-center gap-2 text-zinc-500 text-sm mb-1">
                                            <Target className="w-4 h-4" />
                                            Target Date
                                        </div>
                                        <div className="text-lg font-semibold text-white">
                                            {formatDate(existingContract.targetCompletionDate)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Goals */}
                            {existingContract?.goals && existingContract.goals.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-sm text-zinc-500">My Goals</div>
                                    {existingContract.goals.map((goal, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg">
                                            <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                            <span className="text-zinc-300">{goal}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Signed Info */}
                            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-sm">
                                <span className="text-zinc-600">
                                    Signed on {formatDate(existingContract?.signedAt || '')}
                                </span>
                                <div className="flex items-center gap-2 text-green-400">
                                    <Check className="w-4 h-4" />
                                    Active Contract
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
