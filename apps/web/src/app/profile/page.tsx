
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import {
    User,
    Trophy,
    Flame,
    Zap,
    BookOpen,
    Calendar,
    Target
} from 'lucide-react';
import { ProfileStatsGrid } from '@/components/profile/profile-stats-grid';

export const metadata = {
    title: 'Profile | GrindUp',
    description: 'Your learning profile and statistics',
};

export default async function ProfilePage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            userSubjects: {
                include: {
                    subject: true
                }
            },
            _count: {
                select: {
                    submissions: true,
                    exerciseAttempts: true
                }
            }
        }
    });

    if (!user) {
        redirect('/login');
    }

    // Calculate completion stats or other derived metrics here if needed

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Profile Header */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 backdrop-blur-sm">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-xl ring-4 ring-black">
                        {user.image ? (
                            <img src={user.image} alt={user.name || 'User'} className="w-full h-full rounded-full object-cover" />
                        ) : (
                            (user.name?.[0] || 'U').toUpperCase()
                        )}
                    </div>

                    <div className="text-center md:text-left flex-1">
                        <h1 className="text-3xl font-bold mb-2">{user.name || 'Student'}</h1>
                        <p className="text-gray-400 mb-4">{user.email}</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-sm font-medium">
                                Level {user.level}
                            </span>
                            <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium">
                                {user.username || 'No username'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <ProfileStatsGrid
                    initialStats={{
                        xp: user.xp,
                        streak: user.currentStreak,
                        skillRating: user.skillRating,
                        exercisesDone: user._count.exerciseAttempts,
                        level: user.level
                    }}
                />

                {/* Active Subjects */}
                <div>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-gray-400" />
                        Active Subjects
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {user.userSubjects.length > 0 ? (
                            user.userSubjects.map((us: any) => (
                                <div key={us.id} className="bg-gray-900/30 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-lg mb-1">{us.subject.name}</h3>
                                            <p className="text-sm text-gray-500">Started {new Date(us.enrolledAt).toLocaleDateString()}</p>
                                        </div>
                                        {/* Progress bar placeholder could go here */}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 col-span-2 text-center py-8 bg-gray-900/30 rounded-xl border border-dashed border-gray-800">
                                You haven't started any subjects yet.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
