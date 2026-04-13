
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Swords, Trophy, Clock, XCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Challenge {
    id: string;
    challenger: { id: string; name: string; image: string | null };
    challenged: { id: string; name: string; image: string | null };
    challengeType: string;
    xpStake: number;
    targetValue: number;
    duration: number;
    status: 'pending' | 'active' | 'completed' | 'cancelled';
    endsAt: string | null;
    challengerId: string;
}

export function ChallengeList({ currentUserId }: { currentUserId: string }) {
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const { toast } = useToast();

    const fetchChallenges = useCallback(async () => {
        try {
            const res = await fetch('/api/social/challenges');
            if (!res.ok) return; // Silent fail or toast error
            const data = await res.json();
            if (Array.isArray(data)) {
                setChallenges(data);
            } else {
                setChallenges([]);
            }
        } catch (e) {
            console.error(e);
            setChallenges([]);
        }
    }, []);

    useEffect(() => {
        void fetchChallenges();
    }, [fetchChallenges]);

    const handleAction = async (challengeId: string, action: 'accept' | 'decline') => {
        const res = await fetch('/api/social/challenges', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challengeId, action })
        });
        if (res.ok) {
            toast({ title: `Challenge ${action}ed` });
            fetchChallenges();
        } else {
            const msg = await res.text();
            toast({ title: "Error", description: msg, variant: 'destructive' });
        }
    };

    if (challenges.length === 0) return null;

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <Swords className="h-5 w-5 text-red-500" />
                Active Duels
            </h3>
            <div className="grid grid-cols-1 gap-4">
                {challenges.map(c => {
                    const isIncoming = c.challenged.id === currentUserId;
                    const opponent = isIncoming ? c.challenger : c.challenged;

                    return (
                        <div key={c.id} className={cn(
                            "relative overflow-hidden rounded-xl border p-5 transition-all",
                            c.status === 'pending' ? "bg-zinc-900/50 border-yellow-500/20" :
                                c.status === 'active' ? "bg-gradient-to-r from-red-900/20 to-orange-900/10 border-red-500/30" : "opacity-70 bg-zinc-900"
                        )}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <Avatar className="h-12 w-12 border-2 border-red-500">
                                            <AvatarImage src={opponent.image || ''} />
                                            <AvatarFallback>{opponent.name[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-2 -right-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">VS</div>
                                    </div>
                                    <div>
                                        <p className="font-bold text-lg">{opponent.name}</p>
                                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                                            {c.challengeType.replace('_', ' ').toUpperCase()} • {c.targetValue} {c.challengeType.includes('time') ? 'min' : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="flex items-center justify-end gap-1 text-yellow-500 font-bold">
                                        <Trophy className="h-4 w-4" />
                                        {c.xpStake} XP
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center justify-end gap-1 mt-1">
                                        <Clock className="h-3 w-3" />
                                        {c.duration}h limit
                                    </div>
                                </div>
                            </div>

                            {c.status === 'pending' && isIncoming && (
                                <div className="mt-4 flex gap-2">
                                    <Button size="sm" className="w-full bg-red-600 hover:bg-red-700" onClick={() => handleAction(c.id, 'accept')}>
                                        Accept Duel
                                    </Button>
                                    <Button size="sm" variant="ghost" className="w-full" onClick={() => handleAction(c.id, 'decline')}>
                                        Decline
                                    </Button>
                                </div>
                            )}

                            {c.status === 'active' && (
                                <div className="mt-4 pt-4 border-t border-red-500/20">
                                    <p className="text-center text-sm font-medium text-red-200 animate-pulse">
                                        ⚔️ BATTLE IN PROGRESS ⚔️
                                    </p>
                                    {/* Could show live progress bars here later */}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
