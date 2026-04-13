
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LobbyList } from '@/components/contests/lobby-list';
import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';

export const metadata = {
    title: 'Browse Lobbies | GrindUp',
    description: 'Find and join community contests',
};

export default async function BrowseLobbiesPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    return (
        <div className="min-h-screen bg-black text-white pb-20">
            {/* Header */}
            <div className="bg-gradient-to-b from-gray-900 to-black border-b border-gray-800">
                <div className="container mx-auto px-4 py-12">
                    <div className="flex items-center gap-4 mb-4">
                        <Link href="/contests" className="p-2 rounded-full hover:bg-gray-800 text-gray-400 transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-3xl font-bold text-white">
                            Browse Lobbies
                        </h1>
                    </div>
                    <p className="text-gray-400 max-w-2xl text-lg pl-12">
                        Find an open room, join a challenge, and compete with the community.
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                <LobbyList currentUserId={session.user.id} />
            </div>
        </div>
    );
}
