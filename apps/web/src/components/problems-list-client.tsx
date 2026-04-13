'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Problem {
    id: string;
    title: string;
    difficulty: string;
    topicNames: string[];
}

interface ProblemsListClientProps {
    initialProblems: Problem[];
    isSyncing?: boolean;
}

export function ProblemsListClient({ initialProblems, isSyncing }: ProblemsListClientProps) {
    const router = useRouter();
    const [problems, setProblems] = useState(initialProblems);
    const [problemCount, setProblemCount] = useState(initialProblems.length);

    // Auto-refresh every 10 seconds while syncing
    useEffect(() => {
        // Check problem count periodically
        const checkCount = async () => {
            try {
                const res = await fetch('/api/problems/count');
                if (res.ok) {
                    const data = await res.json();
                    if (data.count !== problemCount) {
                        setProblemCount(data.count);
                        // New problems detected, refresh the page
                        router.refresh();
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        };

        // Always check for new problems every 10 seconds
        const interval = setInterval(checkCount, 10000);

        return () => clearInterval(interval);
    }, [problemCount, router]);

    // Update problems when initialProblems changes
    useEffect(() => {
        setProblems(initialProblems);
        setProblemCount(initialProblems.length);
    }, [initialProblems]);

    return (
        <div className="space-y-4">
            {/* Problem count indicator */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{problems.length} problems available</span>
                <span className="text-xs opacity-60">Auto-refreshing every 10s</span>
            </div>

            {problems.length === 0 ? (
                <div className="p-12 rounded-lg border border-border bg-card text-center">
                    <p className="text-muted-foreground">No problems found. Click "Sync LeetCode" to import problems.</p>
                </div>
            ) : (
                problems.map((problem) => (
                    <Link
                        key={problem.id}
                        href={`/problems/${problem.id}`}
                        className="block group"
                    >
                        <div className="p-4 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {/* Status indicator (Placeholder for now) */}
                                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30 flex-shrink-0" />

                                    <div>
                                        <h3 className="font-semibold text-foreground group-hover:text-indigo-400 transition-colors mb-1">
                                            {problem.title}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2 text-sm">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase
                                                ${problem.difficulty === 'easy' ? 'text-green-500 bg-green-500/10' :
                                                    problem.difficulty === 'medium' ? 'text-yellow-500 bg-yellow-500/10' :
                                                        'text-red-500 bg-red-500/10'}`}>
                                                {problem.difficulty}
                                            </span>
                                            {problem.topicNames.slice(0, 3).map((name) => (
                                                <span
                                                    key={name}
                                                    className="px-2 py-0.5 rounded text-xs bg-secondary text-muted-foreground"
                                                >
                                                    {name}
                                                </span>
                                            ))}
                                            {problem.topicNames.length > 3 && (
                                                <span className="text-xs text-muted-foreground">
                                                    +{problem.topicNames.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))
            )}
        </div>
    );
}
