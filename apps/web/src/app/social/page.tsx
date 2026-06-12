
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserSearch } from '@/components/social/user-search';
import { FriendList } from '@/components/social/friend-list';
import { ChallengeList } from '@/components/social/challenge-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Swords, Search } from 'lucide-react';

export default async function SocialPage() {
    const session = await auth();
    if (!session?.user?.id) redirect('/login');

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                            Social Hub
                        </h1>
                        <p className="text-muted-foreground">
                            Connect, compete, and grow with your alliance.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left Column: Challenges & Duels */}
                    <div className="md:col-span-2 space-y-8">
                        <ChallengeList currentUserId={session.user.id} />

                        {/* Feed Placeholder */}
                        <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
                            <h3 className="font-bold mb-4">Activity Feed</h3>
                            <p className="text-muted-foreground text-sm">
                                Recent wins and updates from your alliance will appear here.
                            </p>
                        </div>
                    </div>

                    {/* Right Column: Friends & Search */}
                    <div className="space-y-6">
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                            <Tabs defaultValue="friends" className="w-full">
                                <TabsList className="w-full grid grid-cols-2 mb-4">
                                    <TabsTrigger value="friends" className="flex items-center gap-2">
                                        <Users className="h-4 w-4" /> Friends
                                    </TabsTrigger>
                                    <TabsTrigger value="search" className="flex items-center gap-2">
                                        <Search className="h-4 w-4" /> Find
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="friends">
                                    <FriendList />
                                </TabsContent>
                                <TabsContent value="search">
                                    <UserSearch />
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
