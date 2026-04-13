'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Code2, Trophy, Zap, Target } from 'lucide-react';

export function LandingPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-12">
            <div className="space-y-6 max-w-3xl">
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="rounded-xl bg-indigo-600/20 p-3">
                        <Code2 className="h-8 w-8 text-indigo-500" />
                    </div>
                </div>
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white">
                    Master Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Craft</span>
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    The complete platform for computer science students. <br/>
                    Practice algorithms, track your progress, and crush your interviews.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <Link href="/register">
                        <Button size="lg" className="h-12 px-8 text-lg bg-indigo-600 hover:bg-indigo-500 text-white rounded-full">
                            Start for Free
                        </Button>
                    </Link>
                    <Link href="/login">
                        <Button size="lg" variant="outline" className="h-12 px-8 text-lg rounded-full">
                            Sign In
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-5xl w-full pt-12 text-left">
                <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <Zap className="h-8 w-8 text-yellow-500 mb-4" />
                    <h3 className="text-xl font-semibold mb-2 text-white">Gamified Learning</h3>
                    <p className="text-muted-foreground">Earn XP, maintain streaks, and climb the leaderboard as you solve problems.</p>
                </div>
                <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <Target className="h-8 w-8 text-red-500 mb-4" />
                    <h3 className="text-xl font-semibold mb-2 text-white">Targeted Practice</h3>
                    <p className="text-muted-foreground">AI-driven recommendations focus on your weak spots to maximize improvement.</p>
                </div>
                <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
                    <Trophy className="h-8 w-8 text-purple-500 mb-4" />
                    <h3 className="text-xl font-semibold mb-2 text-white">Real-world Skills</h3>
                    <p className="text-muted-foreground">From Data Structures to System Design, master the skills that matter.</p>
                </div>
            </div>
        </div>
    );
}
