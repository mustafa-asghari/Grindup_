
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, RotateCcw, CheckCircle2 } from 'lucide-react';

export const metadata = {
    title: 'Mistakes | GrindUp',
    description: 'Review and correct your past mistakes',
};

export default async function MistakesPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    // Fetch incorrect attempts
    const allMistakes = await prisma.exerciseAttempt.findMany({
        where: {
            userId: session.user.id,
            isCorrect: false
        },
        orderBy: { createdAt: 'desc' },
        take: 100, // Fetch more to allow deduplication
        include: {
            exercise: {
                include: { subject: true, topic: true }
            }
        }
    });

    // Deduplicate: keep only the most recent failure per exercise
    const seenExercises = new Set<string>();
    const mistakes = allMistakes.filter((m: any) => {
        if (seenExercises.has(m.exerciseId)) {
            return false;
        }
        seenExercises.add(m.exerciseId);
        return true;
    }).slice(0, 50); // Limit to 50 unique exercises

    // Check if subsequent success exists for these exercises
    const exerciseIds = mistakes.map((m: any) => m.exerciseId);
    const successes = await prisma.exerciseAttempt.findMany({
        where: {
            userId: session.user.id,
            exerciseId: { in: exerciseIds },
            isCorrect: true,
        },
        select: { exerciseId: true, createdAt: true }
    });

    // Build a map of exerciseId -> latest failure timestamp
    const mistakeTimestamps = new Map(mistakes.map((m: any) => [m.exerciseId, m.createdAt]));

    // A mistake is corrected if there's a success AFTER the failure
    const correctedExercises = new Set(
        successes
            .filter((s: any) => {
                const failureTime = mistakeTimestamps.get(s.exerciseId);
                return failureTime && s.createdAt > failureTime;
            })
            .map((s: any) => s.exerciseId)
    );

    const activeMistakes = mistakes.filter((m: any) => !correctedExercises.has(m.exerciseId));
    const correctedMistakes = mistakes.filter((m: any) => correctedExercises.has(m.exerciseId));

    return (
        <div className="min-h-screen bg-black text-white pb-20">
            <div className="bg-gray-900 border-b border-gray-800">
                <div className="container mx-auto px-4 py-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                        Mistake Review
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Focus on what you got wrong. Correcting mistakes is the fastest way to learn.
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 space-y-12">

                {/* Active Mistakes */}
                <section>
                    <h2 className="text-xl font-bold mb-4 text-gray-200">Needs Attention ({activeMistakes.length})</h2>
                    {activeMistakes.length === 0 ? (
                        <div className="p-8 bg-gray-900/50 rounded-2xl border border-gray-800 text-center">
                            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                            <h3 className="text-lg font-bold">Clean Sheet!</h3>
                            <p className="text-gray-400">You have no pending mistakes to review.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {activeMistakes.map((m: any) => (
                                <div key={m.id} className="bg-gray-900 border border-red-900/30 rounded-xl p-5 hover:border-red-500/50 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="text-sm font-medium text-red-400 px-2 py-1 bg-red-900/20 rounded">
                                            {m.exercise.type}
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {m.createdAt.toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h3 className="font-bold mb-2 line-clamp-2">{m.exercise.title}</h3>
                                    <p className="text-sm text-gray-400 mb-4">
                                        {m.exercise.subject?.name} • {m.exercise.topic?.name || 'General'}
                                    </p>

                                    <Link
                                        href={`/exercises/test?id=${m.exerciseId}`}
                                        className="inline-flex items-center gap-2 text-white bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full justify-center"
                                    >
                                        <RotateCcw className="w-4 h-4" /> Retry
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Recently Corrected */}
                {correctedMistakes.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold mb-4 text-gray-400">Recently Corrected</h2>
                        <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
                            {correctedMistakes.slice(0, 5).map((m: any) => (
                                <div key={m.id} className="p-4 flex items-center justify-between opacity-60">
                                    <div>
                                        <h4 className="font-medium text-gray-300">{m.exercise.title}</h4>
                                        <p className="text-xs text-gray-500">Corrected after failure on {m.createdAt.toLocaleDateString()}</p>
                                    </div>
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

            </div>
        </div>
    );
}
