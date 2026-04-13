import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { Calendar, Trophy, Users, Play, Clock } from 'lucide-react';
import Link from 'next/link';
import { ContestWorkspace } from '@/components/contest/contest-workspace';
import { joinContest, startContest } from '@/app/actions/contest';
import { Button } from '@/components/ui/button';
import { ContestChat } from '@/components/contest/contest-chat';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ContestDetailPage({ params }: PageProps) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        redirect(`/login?callbackUrl=/contests/${id}`);
    }

    const contestRaw = await (prisma as any).contests.findUnique({
        where: { id },
        include: {
            contestProblems: {
                orderBy: { order: 'asc' },
                include: {
                    problem: {
                        include: {
                            testCases: { orderBy: { order: 'asc' } },
                            topics: { include: { topic: true } },
                            hintLadders: { orderBy: { level: 'asc' } },
                        }
                    },
                },
            },
            contestExercises: {
                orderBy: { order: 'asc' },
                include: {
                    exercise: true,
                },
            },
            participants: {
                include: {
                    user: true
                }
            },
            createdBy: true,
        },
    });

    if (!contestRaw) {
        notFound();
    }

    // Map to friendly object
    const contest = {
        id: contestRaw.id,
        title: contestRaw.title,
        startsAt: contestRaw.starts_at || contestRaw.startsAt,
        endsAt: contestRaw.ends_at || contestRaw.endsAt,
        description: 'Compete against time and others to solve these problems.',
        createdById: contestRaw.createdById || contestRaw.created_by_id, // Safety check
        problems: (contestRaw.contestProblems || []).map((cp: any) => ({
            ...cp,
            problem: cp.problem,
        })),
        exercises: (contestRaw.contestExercises || []).map((ce: any) => ({
            ...ce,
            exercise: ce.exercise,
        })),
        participants: contestRaw.participants || [],
    };

    const now = new Date();
    const isUpcoming = now < contest.startsAt;
    const isActive = now >= contest.startsAt && now <= contest.endsAt;
    const isFinished = now > contest.endsAt;

    // Retrieve previous submissions
    let submissions: any = {};
    if (!isUpcoming) {
        // Fetch problem submissions
        const userSubmissions = await (prisma as any).contestSubmission.findMany({
            where: {
                contestId: id,
                userId: session.user.id,
            },
        });

        // Fetch exercise attempts? Usually separate table.
        // For now, let's assume we just check problem submissions or implement exercise tracking later.
        // To be complete, we should fetch exercise attempts too if we want to show 'solved' status for exercises.
        // Assuming ExerciseAttempt is global or linked to contest?
        // Schema shows ExerciseAttempt has exerciseId, but not contestId.
        // So we just check if user completed the exercise recently? 
        // For simplicity, we might just track them generally.
        // But for a contest, ideally we want specific contest attempts.
        // Currently schema doesn't support 'ContestExerciseAttempt'. 
        // We will just use 'ExerciseAttempt' for now.

        userSubmissions.forEach((sub: any) => {
            submissions[sub.problemId] = {
                status: sub.submissionId ? 'accepted' : 'pending',
                score: 0,
            };
        });
    }

    // 1. Upcoming / Lobby State
    if (isUpcoming) {
        const amHost = session.user.id === contest.createdById;
        const amParticipant = contest.participants.find((p: any) => p.userId === session?.user?.id);

        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 flex flex-col items-center justify-center text-center space-y-8">
                        <div className="w-24 h-24 bg-purple-900/20 rounded-full flex items-center justify-center mb-6">
                            <Calendar className="w-12 h-12 text-purple-400" />
                        </div>

                        <h1 className="text-4xl font-bold text-white mb-2">{contest.title}</h1>
                        <p className="text-xl text-gray-400 max-w-lg">{contest.description}</p>

                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mt-8 w-full max-w-xl">
                            <h2 className="text-gray-500 uppercase text-sm tracking-wider mb-4">Starts In</h2>
                            <div className="text-5xl font-mono font-bold text-white mb-2">
                                {contest.startsAt.toLocaleString()}
                            </div>
                            <div className="text-gray-400 mb-8 flex items-center justify-center gap-2">
                                <Clock className="w-4 h-4" />
                                Duration: {Math.max(0, Math.round((contest.endsAt.getTime() - contest.startsAt.getTime()) / (1000 * 60 * 60 * 10)) / 10).toFixed(1)} Hours
                            </div>

                            {/* Lobby / Participants */}
                            <div className="border-t border-gray-800 pt-6">
                                <div className="flex items-center justify-center gap-2 text-gray-400 mb-4">
                                    <Users className="w-5 h-5" />
                                    <span>{contest.participants.length} Participant{contest.participants.length !== 1 ? 's' : ''} Ready</span>
                                </div>

                                <div className="flex flex-wrap justify-center gap-2 max-h-40 overflow-y-auto">
                                    {contest.participants.map((p: any) => (
                                        <div key={p.id} className="flex items-center gap-2 bg-black px-3 py-1.5 rounded-full border border-gray-800">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                                                {p.user.name?.[0] || p.user.email?.[0] || '?'}
                                            </div>
                                            <span className="text-sm text-gray-300">{p.user.name || 'User'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-8 space-y-4">
                                {!amParticipant && (
                                    <form action={async () => {
                                        'use server';
                                        await joinContest(contest.id);
                                    }}>
                                        <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-500">
                                            Join Contest
                                        </Button>
                                    </form>
                                )}

                                {amHost ? (
                                    <form action={async () => {
                                        'use server';
                                        await startContest(contest.id);
                                    }}>
                                        <Button size="lg" className="w-full bg-green-600 hover:bg-green-500 font-bold text-lg h-14">
                                            <Play className="w-5 h-5 mr-2" />
                                            Start Contest Now
                                        </Button>
                                        <p className="text-sm text-gray-500 mt-2">
                                            Use this to start the contest immediately for everyone.
                                            End time will be set to 1 hour from now.
                                        </p>
                                    </form>
                                ) : (
                                    amParticipant && (
                                        <div className="text-green-400 font-medium py-2 rounded-lg bg-green-500/10">
                                            ✓ You have joined. Waiting for host to start.
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        <div className="flex justify-center gap-4">
                            <Link href="/contests" className="px-6 py-3 rounded-xl bg-gray-800 text-white hover:bg-gray-700 transition-colors">
                                Back to Contests
                            </Link>
                        </div>
                    </div>

                    {/* Chat Sidebar */}
                    <div className="lg:h-[600px]">
                        <ContestChat
                            apiEndpoint={`/api/contests/${contest.id}/messages`}
                            currentUserId={session!.user!.id!}
                            className="h-full shadow-2xl border-gray-800 bg-gray-900/50 backdrop-blur-sm"
                        />
                    </div>
                </div>
            </div>
        );
    }

    // 2. Active State - Workspace
    if (isActive) {
        const formattedProblems = contest.problems.map((p: any) => {
            const sub = submissions?.[p.problem.id];
            return {
                id: p.problem.id,
                title: p.problem.title,
                difficulty: p.problem.difficulty.toLowerCase(),
                points: p.points,
                solved: sub?.status === 'accepted',
                problemData: p.problem, // Full data for workspace
            };
        });

        const formattedExercises = contest.exercises.map((e: any) => ({
            id: e.exercise.id,
            title: e.exercise.title,
            points: e.points,
            exerciseData: e.exercise, // Full data for runner
            solved: false, // Need implementation
        }));

        return (
            <ContestWorkspace
                contestId={contest.id}
                contestTitle={contest.title}
                startTime={new Date(contest.startsAt)}
                endTime={new Date(contest.endsAt)}
                problems={formattedProblems}
                exercises={formattedExercises}
                userId={session.user.id}
            />
        );
    }

    // 3. Finished State - Results & Upsolve
    return (
        <div className="min-h-screen bg-black text-white">
            <div className="container mx-auto px-4 py-16 max-w-4xl">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/contests" className="text-gray-500 hover:text-white transition-colors">
                        &larr; Back
                    </Link>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-8">
                    <div className="flex items-center gap-4 mb-6">
                        <Trophy className="w-10 h-10 text-yellow-500" />
                        <div>
                            <h1 className="text-3xl font-bold text-white">{contest.title}</h1>
                            <p className="text-gray-400">Contest Ended</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="p-4 bg-black/50 rounded-xl border border-gray-800">
                            <div className="text-sm text-gray-500 mb-1">Your Score</div>
                            <div className="text-2xl font-bold text-white">
                                {Object.values(submissions).reduce((acc: number, s: any) => acc + (s.score || 0), 0)} pts
                            </div>
                        </div>
                        <div className="p-4 bg-black/50 rounded-xl border border-gray-800">
                            <div className="text-sm text-gray-500 mb-1">Items Solved</div>
                            <div className="text-2xl font-bold text-white">
                                {Object.values(submissions).filter((s: any) => s.status === 'accepted').length} / {contest.problems.length + contest.exercises.length}
                            </div>
                        </div>
                    </div>
                </div>

                <h2 className="text-2xl font-bold mb-6">Problems</h2>
                <div className="space-y-4 mb-8">
                    {contest.problems.map((p: any) => (
                        <div key={p.problem.id} className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl">
                            <div>
                                <h3 className="font-bold text-lg mb-1">{p.problem.title}</h3>
                                <span className="text-sm text-gray-500">{p.problem.difficulty}</span>
                            </div>
                            <Link href={`/problems/${p.problem.id}`} className="px-4 py-2 bg-blue-600 rounded text-sm font-medium">
                                Review
                            </Link>
                        </div>
                    ))}
                    {contest.problems.length === 0 && <div className="text-gray-500">No problems.</div>}
                </div>

                <h2 className="text-2xl font-bold mb-6">Exercises</h2>
                <div className="space-y-4">
                    {contest.exercises.map((e: any) => (
                        <div key={e.exercise.id} className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl">
                            <div>
                                <h3 className="font-bold text-lg mb-1">{e.exercise.title}</h3>
                                <span className="text-sm text-gray-500">{e.exercise.type}</span>
                            </div>
                            <Button disabled variant="outline">Review (Coming Soon)</Button>
                        </div>
                    ))}
                    {contest.exercises.length === 0 && <div className="text-gray-500">No exercises.</div>}
                </div>
            </div>
        </div>
    );
}
