import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Badge, Calendar, Clock, Trophy } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LobbyHub } from '@/components/contests/lobby-hub';

export const metadata = {
    title: 'Contests | GrindUp',
    description: 'Compete in coding contests and climb the leaderboard',
};

export default async function ContestsPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    const now = new Date();

    const activeContests = await prisma.contest.findMany({
        where: {
            startsAt: { lte: now },
            endsAt: { gte: now },
        },
        orderBy: { endsAt: 'asc' },
    });

    const upcomingContests = await prisma.contest.findMany({
        where: { startsAt: { gt: now } },
        orderBy: { startsAt: 'asc' },
        take: 5
    });

    const pastContests = await prisma.contest.findMany({
        where: { endsAt: { lt: now } },
        orderBy: { endsAt: 'desc' },
        take: 10
    });

    return (
        <div className="min-h-screen bg-black text-white pb-20">
            {/* Header */}
            <div className="bg-gradient-to-b from-purple-900/20 to-black border-b border-gray-800">
                <div className="container mx-auto px-4 py-16">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-purple-500/20 rounded-xl">
                            <Trophy className="w-8 h-8 text-purple-400" />
                        </div>
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                            Contests
                        </h1>
                    </div>
                    <p className="text-gray-400 max-w-2xl text-lg">
                        Compete with others, solve challenging problems, and boost your rating.
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 space-y-12">
                <LobbyHub currentUserId={session.user.id} />

                {/* Active Contests */}
                <section>
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Live Now
                    </h2>

                    {activeContests.length === 0 ? (
                        <div className="text-gray-500 italic">No active contests at the moment.</div>
                    ) : (
                        <div className="grid gap-4">
                            {activeContests.map(c => (
                                <div key={c.id} className="bg-gray-900/50 border border-green-500/30 rounded-2xl p-6 flex items-center justify-between hover:bg-gray-900 transition-colors">
                                    <div>
                                        <h3 className="text-xl font-bold mb-2">{c.title}</h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                Ends {c.endsAt.toLocaleString()}
                                            </span>
                                            {c.isRated && (
                                                <span className="flex items-center gap-1 text-yellow-500">
                                                    <Badge className="w-4 h-4" /> Rated
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Link
                                        href={`/contests/${c.id}`}
                                        className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-green-900/20"
                                    >
                                        Enter
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Upcoming */}
                <section>
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-blue-400" />
                        Upcoming
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {upcomingContests.map(c => (
                            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors">
                                <h3 className="text-lg font-bold mb-3">{c.title}</h3>
                                <div className="space-y-2 text-sm text-gray-400 mb-6">
                                    <div className="flex justify-between">
                                        <span>Starts</span>
                                        <span className="text-white">{c.startsAt.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Duration</span>
                                        <span className="text-white">
                                            {Math.round((c.endsAt.getTime() - c.startsAt.getTime()) / (1000 * 60 * 60))} Hours
                                        </span>
                                    </div>
                                </div>
                                <Link
                                    href={`/contests/${c.id}`}
                                    className="block w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-center text-white font-medium transition-colors"
                                >
                                    Enter Lobby
                                </Link>
                            </div>
                        ))}
                    </div>
                    {upcomingContests.length === 0 && (
                        <div className="text-gray-500 italic">No upcoming contests scheduled.</div>
                    )}
                </section>

                {/* Past */}
                <section>
                    <h2 className="text-2xl font-bold mb-6 text-gray-400">Past Contests</h2>
                    <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-800 text-gray-400">
                                <tr>
                                    <th className="p-4 font-medium">Contest</th>
                                    <th className="p-4 font-medium">Date</th>
                                    <th className="p-4 font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {pastContests.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-800/50">
                                        <td className="p-4 font-medium">{c.title}</td>
                                        <td className="p-4 text-gray-400">{c.endsAt.toLocaleDateString()}</td>
                                        <td className="p-4">
                                            <Link href={`/contests/${c.id}`} className="text-blue-400 hover:underline text-sm">
                                                View Results
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {pastContests.length === 0 && (
                            <div className="p-6 text-gray-500 italic text-center">No past contests found.</div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
