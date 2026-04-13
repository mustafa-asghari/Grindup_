import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Trophy, Medal, User, Crown, Flame, Clock } from 'lucide-react';
import Image from 'next/image';

export const metadata = {
    title: 'Leaderboard | GrindUp',
    description: 'Top learners on the platform',
};

export default async function LeaderboardPage() {
    const session = await auth();

    // Fetch top 50 users by XP
    const users = await prisma.user.findMany({
        orderBy: { xp: 'desc' },
        take: 50,
        select: {
            id: true,
            name: true,
            username: true,
            image: true,
            xp: true,
            currentStreak: true,
            exerciseAttempts: {
                where: {
                    createdAt: {
                        gte: new Date(new Date().setDate(new Date().getDate() - 7))
                    }
                },
                select: {
                    timeSpentSecs: true
                }
            },
            _count: {
                select: {
                    userBadges: true,
                    exerciseAttempts: true
                }
            }
        }
    });

    // Process users to add calculated fields
    const leaderboardUsers = users.map(user => {
        const weeklySeconds = user.exerciseAttempts.reduce((acc, curr) => acc + (curr.timeSpentSecs || 0), 0);
        const weeklyHours = (weeklySeconds / 3600).toFixed(1);
        return {
            ...user,
            weeklyHours
        };
    });

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500 mb-4 inline-flex items-center gap-3">
                        <Crown className="w-10 h-10 text-yellow-500" />
                        Global Leaderboard
                    </h1>
                    <p className="text-gray-400">Competing against the best learners worldwide.</p>
                </div>

                {/* Top 3 Podium */}
                {leaderboardUsers.length >= 3 && (
                    <div className="flex justify-center items-end gap-4 mb-12">
                        {/* 2nd Place */}
                        <div className="flex flex-col items-center">
                            <div className="relative mb-2">
                                <div className="w-20 h-20 rounded-full border-4 border-gray-400 overflow-hidden bg-gray-800">
                                    {leaderboardUsers[1].image ? (
                                        <Image src={leaderboardUsers[1].image} alt={leaderboardUsers[1].name || ''} fill className="object-cover" />
                                    ) : (
                                        <User className="w-full h-full p-4 text-gray-500" />
                                    )}
                                </div>
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-400 text-black text-xs font-bold px-2 py-0.5 rounded-full">2</div>
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-gray-200">{leaderboardUsers[1].name || 'User'}</div>
                                <div className="text-yellow-500 font-mono font-bold">{leaderboardUsers[1].xp.toLocaleString()} XP</div>
                            </div>
                            <div className="h-24 w-24 bg-gray-800/50 mt-4 rounded-t-xl border-t border-gray-700 mx-auto" />
                        </div>

                        {/* 1st Place */}
                        <div className="flex flex-col items-center -mt-8">
                            <Crown className="w-8 h-8 text-yellow-500 mb-2 animate-bounce" />
                            <div className="relative mb-2">
                                <div className="w-24 h-24 rounded-full border-4 border-yellow-500 overflow-hidden bg-gray-800 shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                                    {leaderboardUsers[0].image ? (
                                        <Image src={leaderboardUsers[0].image} alt={leaderboardUsers[0].name || ''} fill className="object-cover" />
                                    ) : (
                                        <User className="w-full h-full p-4 text-gray-500" />
                                    )}
                                </div>
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">1</div>
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-lg">{leaderboardUsers[0].name || 'User'}</div>
                                <div className="text-yellow-400 font-mono font-bold text-xl">{leaderboardUsers[0].xp.toLocaleString()} XP</div>
                            </div>
                            <div className="h-32 w-28 bg-gray-800/80 mt-4 rounded-t-xl border-t border-yellow-500/30 mx-auto" />
                        </div>

                        {/* 3rd Place */}
                        <div className="flex flex-col items-center">
                            <div className="relative mb-2">
                                <div className="w-20 h-20 rounded-full border-4 border-orange-700 overflow-hidden bg-gray-800">
                                    {leaderboardUsers[2].image ? (
                                        <Image src={leaderboardUsers[2].image} alt={leaderboardUsers[2].name || ''} fill className="object-cover" />
                                    ) : (
                                        <User className="w-full h-full p-4 text-gray-500" />
                                    )}
                                </div>
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">3</div>
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-gray-200">{leaderboardUsers[2].name || 'User'}</div>
                                <div className="text-yellow-500 font-mono font-bold">{leaderboardUsers[2].xp.toLocaleString()} XP</div>
                            </div>
                            <div className="h-20 w-24 bg-gray-800/50 mt-4 rounded-t-xl border-t border-gray-700 mx-auto" />
                        </div>
                    </div>
                )}

                {/* List View */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-800/50 text-gray-400 text-sm">
                            <tr>
                                <th className="px-6 py-4 text-left font-medium">Rank</th>
                                <th className="px-6 py-4 text-left font-medium">User</th>
                                <th className="px-6 py-4 text-right font-medium">Badges</th>
                                <th className="px-6 py-4 text-right font-medium">Streak</th>
                                <th className="px-6 py-4 text-right font-medium">Week Hours</th>
                                <th className="px-6 py-4 text-right font-medium">XP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {leaderboardUsers.map((user: any, index: number) => (
                                <tr key={user.id} className={`hover:bg-gray-800/30 transition-colors ${user.id === session?.user?.id ? 'bg-blue-500/10' : ''}`}>
                                    <td className="px-6 py-4">
                                        <span className={`font-mono font-bold ${index === 0 ? 'text-yellow-500' :
                                            index === 1 ? 'text-gray-400' :
                                                index === 2 ? 'text-orange-700' : 'text-gray-500'
                                            }`}>
                                            #{index + 1}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden relative">
                                                {user.image ? (
                                                    <Image src={user.image} alt="" fill className="object-cover" />
                                                ) : (
                                                    <User className="w-4 h-4 m-2 text-gray-500" />
                                                )}
                                            </div>
                                            <span className="font-medium">{user.name || user.username || 'Anonymous'}</span>
                                            {user.id === session?.user?.id && (
                                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">You</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-400">
                                        <div className="flex items-center justify-end gap-1">
                                            <span>{user._count.userBadges}</span>
                                            <Medal className="w-4 h-4 text-gray-600" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-400">
                                        <div className="flex items-center justify-end gap-1">
                                            <span>{user.currentStreak}</span>
                                            <Flame className={`w-4 h-4 ${user.currentStreak > 0 ? 'text-orange-500' : 'text-gray-600'}`} />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-400">
                                        <div className="flex items-center justify-end gap-1">
                                            <span>{user.weeklyHours}h</span>
                                            <Clock className="w-4 h-4 text-blue-500" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-yellow-500">
                                        {user.xp.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
