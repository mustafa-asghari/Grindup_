'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ContestChat } from '@/components/contest/contest-chat';
import { Users, Play, Trash2, Clock, Trophy, ArrowLeft, LogOut } from 'lucide-react';
import Link from 'next/link';

type Lobby = {
    id: string;
    title: string;
    visibility: 'PUBLIC' | 'PRIVATE';
    mode: 'LEETCODE_RACE' | 'STUDY_TIME' | 'EXERCISE_COUNT' | 'XP_RACE' | 'CUSTOM';
    targetValue?: number | null;
    createdById: string;
    status: 'WAITING' | 'STARTED' | 'FINISHED';
    durationMinutes?: number | null;
    startedAt?: string | null;
    endedAt?: string | null;
    participants: {
        userId: string;
        username: string;
        role: 'HOST' | 'MEMBER';
        joinedAt?: string;
    }[];
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface LobbyViewProps {
    initialLobby: Lobby;
    currentUserId: string;
    currentUser: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
}

export function LobbyView({ initialLobby, currentUserId, currentUser }: LobbyViewProps) {
    const router = useRouter();
    const { data, mutate } = useSWR<{ lobby: Lobby }>(`/api/contests/lobbies?id=${initialLobby.id}`, fetcher, {
        fallbackData: { lobby: initialLobby },
        refreshInterval: 3000
    });

    const lobby = data?.lobby || initialLobby;
    const [pending, setPending] = useState(false);

    const me = lobby.participants.find(p => p.userId === currentUserId);
    const amHost = me?.role === 'HOST';

    // Actions
    const handleLeave = async () => {
        if (!confirm('Are you sure you want to leave this lobby?')) return;
        setPending(true);
        try {
            await fetch('/api/contests/lobbies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'leave', lobbyId: lobby.id })
            });
            router.push('/contests');
        } catch (e) {
            console.error(e);
        } finally {
            setPending(false);
        }
    };

    const handleStart = async () => {
        setPending(true);
        try {
            await fetch('/api/contests/lobbies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', lobbyId: lobby.id })
            });
            mutate();
        } catch (e) {
            console.error(e);
        } finally {
            setPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this lobby completely?')) return;
        setPending(true);
        try {
            await fetch('/api/contests/lobbies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', lobbyId: lobby.id })
            });
            router.push('/contests');
        } catch (e) {
            console.error(e);
        } finally {
            setPending(false);
        }
    };

    const handleKick = async (targetId: string) => {
        if (!confirm('Kick this user?')) return;
        try {
            await fetch('/api/contests/lobbies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'kick', lobbyId: lobby.id, targetUserId: targetId })
            });
            mutate();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-6">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">

                {/* Main Info Area */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="flex items-center gap-4">
                        <Link href="/contests" className="p-2 rounded-full hover:bg-gray-800 transition-colors">
                            <ArrowLeft className="w-6 h-6 text-gray-400" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold">{lobby.title}</h1>
                            <div className="flex items-center gap-3 text-gray-400 mt-1">
                                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-sm border border-blue-500/20">
                                    {lobby.mode.replace('_', ' ')}
                                </span>
                                {lobby.visibility === 'PRIVATE' && (
                                    <span className="text-xs border border-gray-700 px-2 py-0.5 rounded">Private</span>
                                )}
                                <span className="text-sm">•</span>
                                <span className="text-sm">ID: {lobby.id.slice(0, 8)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center min-h-[400px]">

                        {lobby.status === 'WAITING' ? (
                            <>
                                <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                    <Clock className="w-10 h-10 text-green-400" />
                                </div>
                                <h2 className="text-2xl font-bold mb-2">Waiting for Host to Start</h2>
                                <p className="text-gray-400 max-w-md mb-8">
                                    Get ready! The host will start the {lobby.mode.toLowerCase().replace('_', ' ')} soon.
                                    Chat with other participants while you wait.
                                </p>
                            </>
                        ) : lobby.status === 'STARTED' ? (
                            <>
                                <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6 animate-bounce">
                                    <Trophy className="w-10 h-10 text-red-500" />
                                </div>
                                <h2 className="text-3xl font-bold mb-2 text-red-500">CONTEST IS LIVE!</h2>
                                <p className="text-gray-400 max-w-md mb-8">
                                    Good luck!
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-2xl font-bold mb-2">Contest Finished</h2>
                            </>
                        )}

                        {/* Participants Grid */}
                        <div className="w-full max-w-2xl bg-black/40 rounded-xl p-6 border border-gray-800/50">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    {lobby.participants.length} Participant{lobby.participants.length !== 1 && 's'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-2">
                                {lobby.participants.map(p => (
                                    <div key={p.userId} className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/50 border border-gray-700/50">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold">
                                            {p.username[0]?.toUpperCase()}
                                        </div>
                                        <div className="flex flex-col text-left overflow-hidden">
                                            <span className="text-sm font-medium truncate">{p.username}</span>
                                            {p.role === 'HOST' && <span className="text-[10px] text-blue-400">Host</span>}
                                        </div>
                                        {amHost && p.userId !== currentUserId && (
                                            <button
                                                onClick={() => handleKick(p.userId)}
                                                className="ml-auto text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="mt-8 flex gap-4">
                            {amHost && lobby.status === 'WAITING' && (
                                <Button
                                    size="lg"
                                    className="bg-green-600 hover:bg-green-500 text-lg px-8 h-12"
                                    onClick={handleStart}
                                    disabled={pending}
                                >
                                    <Play className="w-5 h-5 mr-2" /> Start Contest
                                </Button>
                            )}

                            {amHost ? (
                                <Button
                                    variant="destructive"
                                    size="lg"
                                    className="h-12"
                                    onClick={handleDelete}
                                    disabled={pending}
                                >
                                    <Trash2 className="w-5 h-5 mr-2" /> Delete Lobby
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="h-12 border-red-900/50 text-red-500 hover:bg-red-950 hover:text-red-400"
                                    onClick={handleLeave}
                                    disabled={pending}
                                >
                                    <LogOut className="w-5 h-5 mr-2" /> Leave Lobby
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Chat Column */}
                <div className="lg:h-[calc(100vh-3rem)] sticky top-6">
                    <ContestChat
                        apiEndpoint={`/api/contests/lobbies/${lobby.id}/messages`}
                        currentUserId={currentUserId}
                        className="h-full border-gray-800 shadow-2xl bg-gray-900/30"
                    />
                </div>
            </div>
        </div>
    );
}
