'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    Flame,
    Zap,
    Code2
} from 'lucide-react';
import { CodeEditor } from '@/components/editor/code-editor';
import { ProblemPanel } from '@/components/editor/problem-panel';
import { TestResults } from '@/components/editor/test-results';

import { useRouter } from 'next/navigation';

interface ProblemWorkspaceProps {
    problem: ProblemWithRelations;
    userStats?: { streak: number; xp: number };
}

type TestCase = {
    id: string;
    input: string;
    expectedOutput: string;
    isHidden: boolean;
};

type ProblemWithRelations = {
    id: string;
    title: string;
    description: string | null;
    difficulty: 'easy' | 'medium' | 'hard';
    timeLimitMs: number;
    memoryLimitKb: number;
    trustLabel?: string | null;
    status?: string | null;
    testCases: TestCase[];
    topics: { topic: { name: string } }[];
    hintLadders: { content: string }[];
    constraints?: unknown;
};

type RunnerResult = {
    status: string;
    test_results: {
        test_case_id: string;
        passed: boolean;
        actual_output?: string;
        error?: string;
        runtime_ms: number;
        is_hidden: boolean;
    }[];
    error?: string;
};

type DisplayResult = {
    id: string;
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    runtime: number;
    isHidden: boolean;
};

export function ProblemWorkspace({ problem, userStats = { streak: 0, xp: 0 } }: ProblemWorkspaceProps) {
    const router = useRouter();
    const [showHints, setShowHints] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [testResults, setTestResults] = useState<DisplayResult[] | null>(null);
    const [status, setStatus] = useState<'accepted' | 'wrong_answer' | 'tle' | 'mle' | 'error' | 'running' | null>(null);

    const handleRunCode = async (code: string, language: string) => {
        setIsRunning(true);
        setStatus('running');
        setTestResults(null);

        // Convert Prisma TestCases to runner format
        // Backend expects: { id, input, expected_output, is_hidden }
        const testCases = problem.testCases.map((tc: TestCase) => ({
            id: tc.id,
            input: tc.input,
            expected_output: tc.expectedOutput,
            is_hidden: tc.isHidden
        }));

        try {
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code,
                    language,
                    problem_id: problem.id,
                    test_cases: testCases,
                    time_limit_ms: problem.timeLimitMs,
                    memory_limit_kb: problem.memoryLimitKb,
                }),
            });

            const result = await response.json() as RunnerResult;

            if (result.error) {
                const rawError = String(result.error ?? '');
                const missingRunner = rawError.toLowerCase().includes('grindup-executor') || rawError.toLowerCase().includes('pull access denied');
                const friendlyMessage = missingRunner
                    ? 'Code runner is unavailable. Please start the executor Docker image (grindup-executor) and try again.'
                    : rawError;

                setStatus('error');
                console.error("Execution error:", rawError);
                setTestResults([{
                    id: 'error',
                    passed: false,
                    input: missingRunner ? 'Runner not available' : 'System Error',
                    expectedOutput: '-',
                    actualOutput: friendlyMessage,
                    runtime: 0,
                    isHidden: false
                }]);
            } else {
                setStatus(result.status as typeof status);
                setTestResults(result.test_results.map((r) => {
                    const tc = testCases.find((t) => t.id === r.test_case_id);
                    return {
                        id: r.test_case_id,
                        passed: r.passed,
                        input: tc?.input || 'Unknown',
                        expectedOutput: tc?.expected_output || 'Unknown',
                        actualOutput: r.error || r.actual_output || '',
                        runtime: r.runtime_ms,
                        isHidden: r.is_hidden
                    };
                }));

                if (result.status === 'accepted') {
                    router.refresh();
                }
            }

        } catch (error) {
            console.error('Failed to run code:', error);
            setStatus('error');
            setTestResults([{
                id: 'conn-error',
                passed: false,
                input: 'Connection Error',
                expectedOutput: '-',
                actualOutput: 'Failed to connect to runner service. Is it running?',
                runtime: 0,
                isHidden: false
            }]);
        } finally {
            setIsRunning(false);
        }
    };

    // Transform Prisma problem to match ProblemPanel expected format
    // ProblemPanel expects: examples (input, output, explanation), topics (string[]), hints (string[]), etc.
    const mappedProblem = {
        ...problem,
        title: problem.title,
        description: problem.description ?? '',
        difficulty: problem.difficulty,
        timeLimit: problem.timeLimitMs,
        memoryLimit: problem.memoryLimitKb / 1024,
        trustLabel: problem.trustLabel ?? undefined,
        status: problem.status ?? undefined,
        // Map Prisma relations to flat arrays
        examples: problem.testCases.filter((tc) => !tc.isHidden).map((tc) => ({
            input: tc.input,
            output: tc.expectedOutput,
            explanation: 'See details' // Explanation not currently in schema, fallback
        })),
        topics: problem.topics.map((t) => t.topic.name),
        hints: problem.hintLadders.map((h) => h.content),
        constraints: Array.isArray(problem.constraints) ? problem.constraints.map(String) : [],
    };

    return (
        <div className="h-screen flex flex-col bg-black">
            {/* Top Navigation Bar */}
            <header className="h-14 border-b border-gray-800 bg-black flex items-center justify-between px-8 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <Link href="/subjects" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <span className="text-sm">Subjects</span>
                    </Link>

                    <div className="h-4 w-px bg-gray-800" />

                    <Link href="/problems" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                        <span className="text-sm">Problems</span>
                    </Link>

                    <div className="h-4 w-px bg-gray-800" />

                    <span className="text-gray-500 text-sm">1 / 150</span>
                </div>

                <div className="flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-white" />
                    <span className="text-white font-semibold">GrindUp</span>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1.5">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span>{userStats.streak}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-yellow-500" />
                            <span>{userStats.xp.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded bg-gray-900 text-gray-400 hover:text-white transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded bg-gray-900 text-gray-400 hover:text-white transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content - Split Panel */}
            <main className="flex-1 flex min-h-0">
                {/* Left Panel - Problem Description */}
                <div className="w-1/2 border-r border-gray-800 overflow-hidden">
                    <ProblemPanel
                        problem={mappedProblem}
                        showHints={showHints}
                        onShowHint={() => setShowHints(!showHints)}
                    />
                </div>

                {/* Right Panel - Editor & Results */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Code Editor */}
                    <div className="flex-1 min-h-0">
                        <CodeEditor
                            onRun={handleRunCode}
                            isRunning={isRunning}
                            disableCopyPaste={true}
                        />
                    </div>

                    {/* Test Results */}
                    {testResults && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="border-t border-gray-800 max-h-[300px] overflow-y-auto"
                        >
                            <TestResults
                                results={testResults}
                                totalRuntime={180}
                                memoryUsage={45000}
                                status={status || undefined}
                            />
                        </motion.div>
                    )}
                </div>
            </main>
        </div>
    );
}
