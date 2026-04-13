'use client';

import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { Search, Globe, Lock, Users, Clock, Play, Trash2, UserMinus2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type Lobby = {
    id: string;
    title: string;
    visibility: 'PUBLIC' | 'PRIVATE';
    mode: 'LEETCODE_RACE' | 'STUDY_TIME' | 'EXERCISE_COUNT' | 'XP_RACE' | 'CUSTOM';
    targetValue?: number | null;
    createdById: string;
    participantCount: number;
    status: 'WAITING' | 'STARTED' | 'FINISHED';
    durationMinutes?: number | null;
    startedAt?: string | null;
    endedAt?: string | null;
    participants: {
        userId: string;
        username: string;
        role: 'HOST' | 'MEMBER';
    }[];
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function LobbyList({ currentUserId }: { currentUserId: string }) {
    const { data, mutate, isLoading } = useSWR<{ lobbies: Lobby[] }>('/api/contests/lobbies', fetcher, {
        refreshInterval: 3000
    });

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<string>('ALL');

    const [joinPassword, setJoinPassword] = useState<Record<string, string>>({});
    const [pending, setPending] = useState(false);

    // Timer update effect
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const joinLobby = async (lobby: Lobby) => {
        setPending(true);
        try {
            await fetch('/api/contests/lobbies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'join',
                    lobbyId: lobby.id,
                    password: lobby.visibility === 'PRIVATE' ? joinPassword[lobby.id] : undefined
                })
            });
            // Ideally redirect or mutate.
            // If success, we should redirect to the lobby page.
            window.location.href = `/contests/lobby/${lobby.id}`;
        } catch (e) {
            console.error(e);
            alert('Failed to join');
        } finally {
            setPending(false);
            mutate();
        }
    };

    const lobbies = data?.lobbies || [];
    const filteredLobbies = lobbies.filter(lobby => {
        const matchesSearch = lobby.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesMode = filterMode === 'ALL' || lobby.mode === filterMode;
        return matchesSearch && matchesMode;
    });

    const formatTimeLeft = (endedAt: string) => {
        const end = new Date(endedAt).getTime();
        const diff = Math.max(0, Math.floor((end - now.getTime()) / 1000));
        if (diff === 0) return 'Ended';
        const hours = Math.floor(diff / 3600);
        const mins = Math.floor((diff % 3600) / 60);
        const secs = diff % 60;
        return hours > 0
            ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
            : `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search lobbies..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-gray-900 border-gray-800 focus:ring-purple-500"
                    />
                </div>
                <select
                    className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-gray-200 focus:ring-purple-500 max-w-xs"
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value)}
                >
                    <option value="ALL">All Modes</option>
                    <option value="LEETCODE_RACE">LeetCode Race</option>
                    <option value="STUDY_TIME">Study Time</option>
                    <option value="EXERCISE_COUNT">Exercise Count</option>
                    <option value="XP_RACE">XP Race</option>
                </select>
            </div>

            {/* Grid */}
            {isLoading && <p className="text-gray-500 text-center py-12">Loading lobbies...</p>}

            {!isLoading && filteredLobbies.length === 0 && (
                <div className="text-center py-12 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
                    <p className="text-gray-400 mb-2">No lobbies found matching your search.</p>
                    <p className="text-sm text-gray-500">Create one to get started!</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLobbies.map((lobby) => {
                    const me = lobby.participants.find(p => p.userId === currentUserId);
                    const amHost = me?.role === 'HOST';
                    const modeLabel = lobby.mode.replace('_', ' ');
                    const durationLabel = lobby.durationMinutes
                        ? `${Math.floor(lobby.durationMinutes / 60)}h ${lobby.durationMinutes % 60}m`
                        : null;

                    return (
                        <div key={lobby.id} className="group bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-900/10 flex flex-col justify-between">
                            <div>
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-white mb-1 group-hover:text-purple-400 transition-colors">{lobby.title}</h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>{modeLabel}</span>
                                            {lobby.visibility === 'PRIVATE' && (
                                                <span className="flex items-center gap-1 text-yellow-500/80">
                                                    <Lock className="w-3 h-3" /> Private
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className={cn("text-xs px-2 py-1 rounded font-bold tracking-wider",
                                        lobby.status === 'STARTED' ? 'bg-red-500/20 text-red-400 animate-pulse' :
                                            lobby.status === 'FINISHED' ? 'bg-gray-800 text-gray-400' :
                                                'bg-green-500/20 text-green-400'
                                    )}>
                                        {lobby.status === 'STARTED' ? 'LIVE' : lobby.status === 'FINISHED' ? 'ENDED' : 'WAITING'}
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <Users className="w-4 h-4" />
                                        <span>{lobby.participantCount} Players</span>
                                    </div>
                                    {durationLabel && (
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <Clock className="w-4 h-4" />
                                            <span>{durationLabel}</span>
                                        </div>
                                    )}
                                    {lobby.status === 'STARTED' && lobby.endedAt && (
                                        <div className="flex items-center gap-2 text-sm text-red-400 font-bold">
                                            <Clock className="w-4 h-4" />
                                            <span>{formatTimeLeft(lobby.endedAt)} Remaining</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-gray-800 pt-4 mt-auto">
                                {me ? (
                                    <Link href={`/contests/lobby/${lobby.id}`} className="block w-full">
                                        <Button className="w-full bg-purple-600 hover:bg-purple-500">
                                            Enter Lobby <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </Link>
                                ) : (
                                    <div className="space-y-2">
                                        {lobby.visibility === 'PRIVATE' && (
                                            <Input
                                                type="password"
                                                placeholder="Enter password..."
                                                value={joinPassword[lobby.id] || ''}
                                                onChange={(e) => setJoinPassword(prev => ({ ...prev, [lobby.id]: e.target.value }))}
                                                className="bg-black/50 border-gray-800 h-9"
                                            />
                                        )}
                                        <Button
                                            onClick={() => joinLobby(lobby)}
                                            disabled={pending || lobby.status !== 'WAITING'}
                                            className="w-full bg-gray-800 hover:bg-gray-700 data-[status=live]:bg-red-900/20 data-[status=live]:text-red-500 disabled:opacity-50"
                                            data-status={lobby.status === 'STARTED' ? 'live' : ''}
                                        >
                                            {lobby.status !== 'WAITING' ? 'Contest in Progress' : 'Join Game'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
