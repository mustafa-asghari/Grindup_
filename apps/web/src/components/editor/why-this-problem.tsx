'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HelpCircle,
    Target,
    AlertTriangle,
    Clock,
    FileText,
    BookOpen,
    TrendingUp,
    ChevronDown,
    ChevronUp,
    Zap
} from 'lucide-react';

interface SelectionReason {
    reason: string;
    weight: number;
    description: string;
    icon?: string;
}

interface WhyThisProblemProps {
    reasons: SelectionReason[];
    problemTitle: string;
}

const reasonIcons: Record<string, any> = {
    weak_topic: AlertTriangle,
    prerequisite_gap: Target,
    review_due: Clock,
    time_fit: Zap,
    contract_alignment: FileText,
    skill_building: TrendingUp,
    pattern_practice: BookOpen,
};

const reasonColors: Record<string, string> = {
    weak_topic: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    prerequisite_gap: 'text-red-400 bg-red-500/10 border-red-500/30',
    review_due: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    time_fit: 'text-green-400 bg-green-500/10 border-green-500/30',
    contract_alignment: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    skill_building: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    pattern_practice: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
};

const reasonLabels: Record<string, string> = {
    weak_topic: 'Weak Topic',
    prerequisite_gap: 'Prerequisite Gap',
    review_due: 'Review Due',
    time_fit: 'Time Constraint Fit',
    contract_alignment: 'Contract Alignment',
    skill_building: 'Skill Building',
    pattern_practice: 'Pattern Practice',
};

export function WhyThisProblem({ reasons, problemTitle }: WhyThisProblemProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!reasons || reasons.length === 0) {
        return null;
    }

    // Sort by weight
    const sortedReasons = [...reasons].sort((a, b) => b.weight - a.weight);
    const topReason = sortedReasons[0];
    const TopIcon = reasonIcons[topReason.reason] || HelpCircle;

    return (
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
            {/* Header - Always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-zinc-900/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border ${reasonColors[topReason.reason] || 'text-zinc-400 bg-zinc-900 border-zinc-700'}`}>
                        <HelpCircle className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-semibold text-white text-sm">Why this problem?</h3>
                        <p className="text-xs text-zinc-500">
                            {reasonLabels[topReason.reason] || topReason.reason} • {sortedReasons.length - 1} more factors
                        </p>
                    </div>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-zinc-500" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-zinc-500" />
                )}
            </button>

            {/* Expanded details */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-zinc-800"
                    >
                        <div className="p-4 space-y-3">
                            <div className="text-xs text-zinc-500 mb-4">
                                This problem was selected for <span className="text-white font-medium">{problemTitle}</span> based on:
                            </div>

                            {sortedReasons.map((reason, idx) => {
                                const Icon = reasonIcons[reason.reason] || HelpCircle;
                                const colorClass = reasonColors[reason.reason] || 'text-zinc-400 bg-zinc-900 border-zinc-700';
                                const weightPercent = Math.round(reason.weight * 100);

                                return (
                                    <motion.div
                                        key={reason.reason}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="flex items-start gap-3"
                                    >
                                        <div className={`p-1.5 rounded-lg border ${colorClass}`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium text-white">
                                                    {reasonLabels[reason.reason] || reason.reason}
                                                </span>
                                                <span className="text-xs text-zinc-500">
                                                    {weightPercent}% factor
                                                </span>
                                            </div>
                                            <p className="text-xs text-zinc-400">
                                                {reason.description}
                                            </p>
                                            {/* Weight bar */}
                                            <div className="h-1 bg-zinc-900 rounded-full mt-2 overflow-hidden">
                                                <motion.div
                                                    className={`h-full ${colorClass.split(' ')[0].replace('text-', 'bg-').replace('-400', '-500')}`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${weightPercent}%` }}
                                                    transition={{ delay: idx * 0.1 + 0.2, duration: 0.3 }}
                                                    style={{ backgroundColor: 'currentColor', opacity: 0.5 }}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}

                            <div className="pt-3 mt-3 border-t border-zinc-800">
                                <p className="text-xs text-zinc-600 italic">
                                    Your roadmap and learning contract influence these selections.
                                    Problems are chosen to maximize your learning efficiency.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Hook to fetch why this problem data
export function useWhyThisProblem(problemId: string, userId?: string) {
    const [reasons, setReasons] = useState<SelectionReason[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch reasons on mount - using useEffect for side effects
    useEffect(() => {
        if (!userId || !problemId) {
            setLoading(false);
            return;
        }

        fetch(`/api/problems/${problemId}/selection-reasons`)
            .then(res => res.json())
            .then(data => {
                setReasons(data.reasons || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [problemId, userId]);

    return { reasons, loading };
}
