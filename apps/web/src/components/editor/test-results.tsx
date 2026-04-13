'use client';

import { motion } from 'framer-motion';
import {
    CheckCircle2,
    XCircle,
    Clock,
    Zap,
    ChevronDown,
    ChevronUp,
    Terminal
} from 'lucide-react';
import { useState } from 'react';

interface TestResult {
    id: string;
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput?: string;
    runtime?: number;
    isHidden?: boolean;
}

interface TestResultsProps {
    results: TestResult[];
    totalRuntime?: number;
    memoryUsage?: number;
    status?: 'accepted' | 'wrong_answer' | 'tle' | 'mle' | 'error' | 'running';
}

export function TestResults({ results, totalRuntime, memoryUsage, status }: TestResultsProps) {
    const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    const allPassed = passedCount === totalCount;

    const toggleTest = (id: string) => {
        const newExpanded = new Set(expandedTests);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedTests(newExpanded);
    };

    const statusConfig = {
        accepted: { label: 'Accepted', color: 'text-green-500', bg: 'bg-green-500/10' },
        wrong_answer: { label: 'Wrong Answer', color: 'text-red-500', bg: 'bg-red-500/10' },
        tle: { label: 'Time Limit Exceeded', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        mle: { label: 'Memory Limit Exceeded', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        error: { label: 'Runtime Error', color: 'text-red-500', bg: 'bg-red-500/10' },
        running: { label: 'Running...', color: 'text-gray-400', bg: 'bg-gray-800' },
    };

    const currentStatus = status ? statusConfig[status] : null;

    return (
        <div className="bg-gray-900">
            {/* Header with status */}
            <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Terminal className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-white">Test Results</span>
                    </div>

                    {currentStatus && (
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-md ${currentStatus.bg}`}>
                            {status === 'accepted' ? (
                                <CheckCircle2 className={`w-4 h-4 ${currentStatus.color}`} />
                            ) : status === 'running' ? (
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                                    <Terminal className={`w-4 h-4 ${currentStatus.color}`} />
                                </motion.div>
                            ) : (
                                <XCircle className={`w-4 h-4 ${currentStatus.color}`} />
                            )}
                            <span className={`text-sm font-medium ${currentStatus.color}`}>
                                {currentStatus.label}
                            </span>
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 mt-3 text-sm">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${allPassed ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-gray-400">
                            <span className={allPassed ? 'text-green-500' : 'text-red-500'}>
                                {passedCount}/{totalCount}
                            </span>
                            {' test cases passed'}
                        </span>
                    </div>

                    {totalRuntime !== undefined && (
                        <div className="flex items-center gap-1.5 text-gray-500">
                            <Clock className="w-4 h-4" />
                            <span>{totalRuntime}ms</span>
                        </div>
                    )}

                    {memoryUsage !== undefined && (
                        <div className="flex items-center gap-1.5 text-gray-500">
                            <Zap className="w-4 h-4" />
                            <span>{(memoryUsage / 1024).toFixed(1)}MB</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Test cases */}
            <div className="max-h-[200px] overflow-y-auto">
                {results.map((result, idx) => (
                    <div key={result.id} className="border-b border-gray-800 last:border-0">
                        <button
                            onClick={() => !result.isHidden && toggleTest(result.id)}
                            className={`w-full p-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors ${result.isHidden ? 'cursor-default' : 'cursor-pointer'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                {result.passed ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                )}

                                <span className="text-sm text-gray-300">
                                    {result.isHidden ? 'Hidden Test' : `Test Case ${idx + 1}`}
                                </span>

                                {result.runtime !== undefined && (
                                    <span className="text-xs text-gray-600">
                                        {result.runtime}ms
                                    </span>
                                )}
                            </div>

                            {!result.isHidden && (
                                expandedTests.has(result.id) ? (
                                    <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                )
                            )}
                        </button>

                        {/* Expanded details */}
                        {expandedTests.has(result.id) && !result.isHidden && (
                            <div className="px-4 pb-4 space-y-3">
                                <div>
                                    <div className="text-xs text-gray-600 uppercase tracking-wider mb-1">
                                        Input
                                    </div>
                                    <pre className="p-3 bg-black rounded-lg text-sm text-gray-300 font-mono overflow-x-auto border border-gray-800">
                                        {result.input}
                                    </pre>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <div className="text-xs text-gray-600 uppercase tracking-wider mb-1">
                                            Expected
                                        </div>
                                        <pre className="p-3 bg-black rounded-lg text-sm text-green-400 font-mono border border-gray-800">
                                            {result.expectedOutput}
                                        </pre>
                                    </div>

                                    {result.actualOutput !== undefined && (
                                        <div>
                                            <div className="text-xs text-gray-600 uppercase tracking-wider mb-1">
                                                Your Output
                                            </div>
                                            <pre className={`p-3 bg-black rounded-lg text-sm font-mono border border-gray-800 ${result.passed ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                {result.actualOutput}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
