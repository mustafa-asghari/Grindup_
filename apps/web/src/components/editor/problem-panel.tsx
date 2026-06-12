'use client';

import { motion } from 'framer-motion';
import {
    Clock,
    MemoryStick,
    Tag,
    Lightbulb,
    BookOpen,
    ChevronRight,
    Star,
    Flag
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { sanitizeProblemHtml } from '@/lib/html-sanitizer';

interface Problem {
    id: string;
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    description: string;
    examples: Example[];
    constraints: string[];
    topics: string[];
    hints?: string[];
    timeLimit: number;
    memoryLimit: number;
    acceptanceRate?: number;
    trustLabel?: string;
    status?: string;
}

interface Example {
    input: string;
    output: string;
    explanation?: string;
}

interface ProblemPanelProps {
    problem: Problem;
    showHints?: boolean;
    onShowHint?: () => void;
}

export function ProblemPanel({ problem, showHints = false, onShowHint }: ProblemPanelProps) {
    const [reporting, setReporting] = useState(false);
    const [reason, setReason] = useState('');
    const [details, setDetails] = useState('');
    const [reportStatus, setReportStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
    const sanitizedDescription = useMemo(
        () => sanitizeProblemHtml(problem.description),
        [problem.description]
    );

    const submitReport = async () => {
        setReportStatus('submitting');
        try {
            const res = await fetch('/api/problems/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ problemId: problem.id, reason, details }),
            });
            if (!res.ok) throw new Error('Failed to submit');
            setReportStatus('done');
            setReporting(false);
            setReason('');
            setDetails('');
        } catch {
            setReportStatus('error');
        }
    };

    return (
        <div className="h-full flex flex-col bg-black">
            {/* Header */}
            <div className="p-8 border-b border-gray-800">
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`difficulty-badge difficulty-${problem.difficulty}`}>
                                {problem.difficulty}
                            </span>
                            {problem.acceptanceRate && (
                                <span className="text-xs text-gray-500">
                                    {problem.acceptanceRate}% acceptance
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">
                            {problem.title}
                        </h1>
                    </div>

                    <button className="p-2 rounded-lg bg-gray-900 text-gray-500 hover:text-white transition-colors">
                        <Star className="w-4 h-4" />
                    </button>
                </div>

                {/* Meta info */}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span>{problem.timeLimit}ms</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <MemoryStick className="w-4 h-4" />
                        <span>{problem.memoryLimit}MB</span>
                    </div>
                    {problem.trustLabel && (
                        <span className="px-2 py-1 rounded border border-zinc-800 text-xs text-gray-400">
                            Trust: {problem.trustLabel}
                        </span>
                    )}
                    {problem.status && (
                        <span className="px-2 py-1 rounded border border-zinc-800 text-xs text-gray-400">
                            Status: {problem.status}
                        </span>
                    )}
                </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Description */}
                <section className="prose prose-invert max-w-none prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800">
                    <div dangerouslySetInnerHTML={{ __html: sanitizedDescription }} />
                </section>

                {/* Runner expectations */}
                <section className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/60">
                    <p className="text-sm font-semibold text-white mb-2">How to structure your code</p>
                    <ul className="text-sm text-zinc-400 space-y-1 list-disc list-inside">
                        <li>Name your entry function <code className="font-mono text-xs text-zinc-200">solution</code>.</li>
                        <li>Inputs arrive as plain values from the sample strings (e.g. <code className="font-mono text-xs text-zinc-200">l1 = [2,4,3]; l2 = [5,6,4]</code>), not prebuilt linked-list nodes.</li>
                        <li>Return plain values in the same shape (for linked-list problems, return an array of digits in reverse order).</li>
                        <li>Assignments are semicolon-separated; keep your function signature parameters aligned with the variable names in the input strings.</li>
                    </ul>
                </section>

                {/* Examples */}
                {problem.examples?.length > 0 && (
                    <section>
                        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-gray-500" />
                            Examples
                        </h3>

                        <div className="space-y-8">
                            {problem.examples.map((example, idx) => (
                                <div
                                    key={idx}
                                    className="p-6 rounded-xl bg-gray-900/50 border border-gray-800 space-y-4"
                                >
                                    <div className="text-sm font-semibold text-white">
                                        Example {idx + 1}
                                    </div>

                                    <div className="space-y-4 pl-4 border-l-2 border-gray-800">
                                        <div className="grid grid-cols-[100px_1fr] gap-4">
                                            <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Input:</span>
                                            <code className="text-base text-gray-300 font-mono bg-black/50 px-2 py-1 rounded">
                                                {example.input}
                                            </code>
                                        </div>

                                        <div className="grid grid-cols-[100px_1fr] gap-4">
                                            <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Output:</span>
                                            <code className="text-base text-green-400 font-mono bg-black/50 px-2 py-1 rounded">
                                                {example.output}
                                            </code>
                                        </div>

                                        {example.explanation && (
                                            <div className="grid grid-cols-[100px_1fr] gap-4">
                                                <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Explanation:</span>
                                                <div className="text-base text-gray-400">
                                                    {example.explanation}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Constraints */}
                {problem.constraints?.length > 0 && Array.isArray(problem.constraints) && (
                    <section>
                        <h3 className="text-lg font-semibold text-white mb-4">
                            Constraints
                        </h3>
                        <ul className="space-y-2">
                            {problem.constraints.map((constraint, idx) => (
                                <li
                                    key={idx}
                                    className="flex items-start gap-2 text-sm text-gray-400"
                                >
                                    <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                                    <code className="font-mono text-gray-300 text-base">{constraint}</code>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* Topics */}
                <section>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Tag className="w-5 h-5 text-gray-500" />
                        Topics
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {problem.topics.map((topic) => (
                            <span
                                key={topic}
                                className="px-3 py-1.5 bg-gray-900 text-gray-400 rounded-md text-sm border border-gray-800 hover:bg-gray-800 transition-colors cursor-pointer"
                            >
                                {topic}
                            </span>
                        ))}
                    </div>
                </section>

                {/* Hints */}
                {problem.hints && problem.hints.length > 0 && (
                    <section>
                        <button
                            onClick={onShowHint}
                            className="w-full flex items-center justify-between p-4 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
                                    <Lightbulb className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-medium text-white">Need a hint?</div>
                                    <div className="text-xs text-gray-500">
                                        {showHints ? 'Hints revealed' : `${problem.hints.length} hints available`}
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                        </button>

                        {showHints && (
                            <div className="mt-3 space-y-2">
                                {problem.hints.map((hint, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg"
                                    >
                                        <div className="text-xs text-yellow-500 font-medium mb-1">
                                            Hint {idx + 1}
                                        </div>
                                        <p className="text-sm text-gray-300">{hint}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Report */}
                <section className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/60">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                        <Flag className="w-4 h-4 text-red-400" />
                        Report an issue
                    </div>
                    {!reporting && (
                        <button
                            onClick={() => { setReporting(true); setReportStatus('idle'); }}
                            className="text-sm text-red-400 hover:text-red-300"
                        >
                            Flag this problem
                        </button>
                    )}
                    {reporting && (
                        <div className="space-y-3">
                            <input
                                placeholder="Reason (e.g., incorrect test, unclear statement)"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-red-500 outline-none"
                            />
                            <textarea
                                placeholder="Details (optional)"
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                rows={3}
                                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-red-500 outline-none"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={submitReport}
                                    disabled={!reason || reportStatus === 'submitting'}
                                    className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-60"
                                >
                                    {reportStatus === 'submitting' ? 'Submitting…' : 'Submit'}
                                </button>
                                <button
                                    onClick={() => { setReporting(false); setReason(''); setDetails(''); }}
                                    className="px-3 py-1.5 rounded border border-zinc-800 text-sm text-gray-300 hover:border-zinc-700"
                                >
                                    Cancel
                                </button>
                            </div>
                            {reportStatus === 'done' && (
                                <div className="text-xs text-green-400">Thanks, we recorded your report.</div>
                            )}
                            {reportStatus === 'error' && (
                                <div className="text-xs text-red-400">Failed to submit. Try again.</div>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
