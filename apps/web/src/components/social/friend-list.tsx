
'use client';

import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CreateChallengeModal } from './create-challenge-modal';
import { ChatDialog } from './chat-dialog';
import { UserMinus, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useSession } from 'next-auth/react';

interface Friend {
    id: string; // Friendship ID
    friendId: string;
    name: string;
    image: string | null;
    level: number;
    xp: number;
    status: 'pending' | 'accepted';
    isIncoming: boolean;
}

export function FriendList() {
    const { data: session } = useSession();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchFriends = async () => {
        try {
            const res = await fetch('/api/social/friends');
            const data = await res.json();
            if (Array.isArray(data)) {
                setFriends(data);
            } else {
                setFriends([]);
            }
        } catch (error) {
            console.error(error);
            setFriends([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFriends();
    }, []);

    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleAction = async (friendshipId: string, action: 'accept' | 'decline' | 'remove') => {
        setProcessingId(friendshipId);
        try {
            const res = await fetch('/api/social/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ friendshipId, action })
            });
            if (res.ok) {
                toast({ title: "Success", description: `Friend ${action}d successfully` });
                // Small delay to show animation
                setTimeout(() => {
                    fetchFriends();
                    setProcessingId(null);
                }, 500);
            } else {
                setProcessingId(null);
            }
        } catch (error) {
            toast({ title: "Error", description: "Action failed", variant: "destructive" });
            setProcessingId(null);
        }
    };

    if (loading) return <div>Loading alliance...</div>;

    const acceptedFriends = friends.filter(f => f.status === 'accepted');
    const pendingRequests = friends.filter(f => f.status === 'pending' && f.isIncoming);

    return (
        <div className="space-y-6">
            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                    <h3 className="font-semibold text-orange-400 mb-3 flex items-center gap-2">
                        Incoming Requests ({pendingRequests.length})
                    </h3>
                    <div className="space-y-2">
                        {pendingRequests.map(req => (
                            <div key={req.id} className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={req.image || ''} />
                                        <AvatarFallback>{req.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{req.name}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className={`transition-all duration-300 ${processingId === req.id ? 'bg-green-500 scale-95' : 'bg-green-600 hover:bg-green-700'}`}
                                        disabled={processingId === req.id}
                                        onClick={() => handleAction(req.id, 'accept')}
                                    >
                                        {processingId === req.id ? (
                                            <Check className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Check className="h-4 w-4" />
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={processingId === req.id}
                                        onClick={() => handleAction(req.id, 'decline')}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Friends List */}
            <div className="space-y-4">
                <h3 className="text-xl font-bold">Your Alliance</h3>
                {acceptedFriends.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No friends yet. Search for users to build your squad!</p>
                ) : (
                    acceptedFriends.map(friend => (
                        <div key={friend.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-zinc-900/50 transition-all">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-10 w-10 border-2 border-indigo-500/30">
                                    <AvatarImage src={friend.image || ''} />
                                    <AvatarFallback>{friend.name[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-bold">{friend.name}</p>
                                    <p className="text-xs text-muted-foreground">Level {friend.level} • {friend.xp} XP</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <CreateChallengeModal targetUser={{ id: friend.friendId, name: friend.name }} />
                                <ChatDialog
                                    friend={{ id: friend.id, userId: friend.friendId, name: friend.name, image: friend.image }}
                                    currentUserId={session?.user?.id}
                                />
                                <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-500 hover:bg-red-900/10" onClick={() => handleAction(friend.id, 'remove')}>
                                    <UserMinus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
