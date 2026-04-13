
'use client';

import { useState } from 'react';
import { Search, UserPlus, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';

interface User {
    id: string;
    username: string;
    name: string;
    image: string | null;
    level: number;
    xp: number;
}

export function UserSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (query.length < 3) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/social/users?q=${query}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setResults(data);
            } else {
                setResults([]);
            }
        } catch (error) {
            console.error(error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set());

    const sendFriendRequest = async (userId: string) => {
        try {
            const res = await fetch('/api/social/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: userId, action: 'send_request' })
            });

            if (res.ok) {
                setSentRequestIds(prev => new Set(Array.from(prev)).add(userId));
                toast({ title: "Request Sent", description: "Friend request sent successfully!" });
                // Don't remove immediately to show the "Sent" state
            } else {
                const msg = await res.text();
                toast({ title: "Error", description: msg, variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to send request", variant: "destructive" });
        }
    };

    return (
        <div className="w-full max-w-md space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search users by name or email..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button type="submit" disabled={loading || query.length < 3}>
                    {loading ? '...' : 'Search'}
                </Button>
            </form>

            <div className="space-y-2">
                {results.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                        <div className="flex items-center gap-3">
                            <Avatar>
                                <AvatarImage src={user.image || ''} />
                                <AvatarFallback>{user.name?.[0] || 'U'}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium text-sm">{user.name || user.username}</p>
                                <p className="text-xs text-muted-foreground">Lvl {user.level} • {user.xp} XP</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <Button
                                size="sm"
                                variant={sentRequestIds.has(user.id) ? "secondary" : "ghost"}
                                disabled={sentRequestIds.has(user.id)}
                                onClick={() => sendFriendRequest(user.id)}
                                className="transition-all duration-300 ease-in-out transform active:scale-95"
                            >
                                {sentRequestIds.has(user.id) ? (
                                    <>
                                        <Check className="h-4 w-4 mr-2 text-green-500 animate-in zoom-in spin-in-90 duration-300" />
                                        <span className="text-green-500 font-medium">Sent</span>
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="h-4 w-4 mr-2 group-hover:text-indigo-400 transition-colors" />
                                        Add
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
