'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, PlusCircle, Globe, Lock } from 'lucide-react';

export function LobbyCreator() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
    const [mode, setMode] = useState<'LEETCODE_RACE' | 'STUDY_TIME' | 'EXERCISE_COUNT' | 'XP_RACE' | 'CUSTOM'>('LEETCODE_RACE');
    const [targetValue, setTargetValue] = useState<number | ''>('');
    const [duration, setDuration] = useState<number | ''>('');
    const [password, setPassword] = useState('');
    const [pending, setPending] = useState(false);

    const createLobby = async () => {
        if (!title.trim()) return;
        setPending(true);
        try {
            const res = await fetch('/api/contests/lobbies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    title,
                    visibility,
                    mode,
                    targetValue: targetValue === '' ? undefined : Number(targetValue),
                    durationMinutes: duration === '' ? undefined : Math.round(Number(duration) * 60),
                    password: visibility === 'PRIVATE' ? password : undefined
                })
            });

            if (!res.ok) {
                const text = await res.text();
                alert(text || 'Failed to create lobby');
                setPending(false);
                return;
            }

            const data = await res.json();
            // Redirect to the new lobby waiting room
            router.push(`/contests/lobby/${data.lobby.id}`);
        } catch (e) {
            console.error(e);
            alert('Network error');
            setPending(false);
        }
    };

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-300">
                    <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-xl font-bold">Create a Contest Lobby</h3>
                    <p className="text-sm text-gray-400">Host your own match. Choose the rules.</p>
                </div>
            </div>

            <div className="space-y-4 max-w-xl">
                <Input
                    placeholder="Lobby name (e.g. Friday Night Blitz)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-black/50 border-gray-800"
                />
                <div className="flex gap-3">
                    <Button
                        type="button"
                        variant={visibility === 'PUBLIC' ? 'default' : 'outline'}
                        className={`flex-1 ${visibility === 'PUBLIC' ? 'bg-purple-600 hover:bg-purple-500' : 'border-gray-700'}`}
                        onClick={() => setVisibility('PUBLIC')}
                    >
                        <Globe className="w-4 h-4 mr-2" /> Public
                    </Button>
                    <Button
                        type="button"
                        variant={visibility === 'PRIVATE' ? 'default' : 'outline'}
                        className={`flex-1 ${visibility === 'PRIVATE' ? 'bg-purple-600 hover:bg-purple-500' : 'border-gray-700'}`}
                        onClick={() => setVisibility('PRIVATE')}
                    >
                        <Lock className="w-4 h-4 mr-2" /> Private
                    </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <div className="text-xs text-gray-400">Challenge type</div>
                        <select
                            className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-purple-500"
                            value={mode}
                            onChange={(e) => setMode(e.target.value as any)}
                        >
                            <option value="LEETCODE_RACE">LeetCode Race</option>
                            <option value="STUDY_TIME">Study Time (minutes)</option>
                            <option value="EXERCISE_COUNT">Exercise Count</option>
                            <option value="XP_RACE">XP Race</option>
                            <option value="CUSTOM">Custom</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <div className="text-xs text-gray-400">Target (optional)</div>
                        <Input
                            type="number"
                            placeholder="e.g. 45"
                            value={targetValue}
                            onChange={(e) => setTargetValue(e.target.value === '' ? '' : Number(e.target.value))}
                            className="bg-black/50 border-gray-800"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="text-xs text-gray-400">Duration (hours, optional)</div>
                    <Input
                        type="number"
                        placeholder="e.g. 1"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value === '' ? '' : Number(e.target.value))}
                        className="bg-black/50 border-gray-800"
                    />
                </div>
                {visibility === 'PRIVATE' && (
                    <Input
                        type="password"
                        placeholder="Password to join"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-black/50 border-gray-800"
                    />
                )}
                <Button
                    type="button"
                    onClick={createLobby}
                    disabled={pending}
                    className="w-full bg-purple-600 hover:bg-purple-500 font-bold"
                >
                    {pending ? 'Creating...' : 'Create Lobby'}
                </Button>
            </div>
        </div>
    );
}
