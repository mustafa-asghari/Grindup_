
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ChatDialogProps {
    friend: {
        id: string; // Wait, friend.friendId is the user ID. friend.id is friendship ID.
        userId: string;
        name: string;
        image: string | null;
    };
    currentUserId?: string;
}

interface Message {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
    sender: { name: string | null; image: string | null };
}

export function ChatDialog({ friend, currentUserId }: ChatDialogProps) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const loadMessages = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/social/messages?targetId=${friend.userId}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (e) {
            console.error('Failed to load messages');
        } finally {
            setLoading(false);
        }
    }, [friend.userId]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const tempId = crypto.randomUUID();
        const tempMsg: Message = {
            id: tempId,
            senderId: 'me', // Optimistic update
            content: newMessage,
            createdAt: new Date().toISOString(),
            sender: { name: 'Me', image: null }
        };

        setMessages(prev => [...prev, tempMsg]);
        setNewMessage('');

        try {
            const res = await fetch('/api/social/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetId: friend.userId, content: tempMsg.content })
            });
            if (res.ok) {
                const realMsg = await res.json();
                setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m));
            } else {
                // Revert on failure
                setMessages(prev => prev.filter(m => m.id !== tempId));
            }
        } catch (e) {
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    useEffect(() => {
        if (open) {
            void loadMessages();
            // Poll for new messages every 5s
            const interval = setInterval(() => void loadMessages(), 5000);
            return () => clearInterval(interval);
        }
    }, [open, loadMessages]);

    useEffect(() => {
        // Scroll to bottom
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="icon" variant="ghost">
                    <MessageSquare className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md h-[500px] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={friend.image || ''} />
                            <AvatarFallback>{friend.name[0]}</AvatarFallback>
                        </Avatar>
                        <DialogTitle>Chat with {friend.name}</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 border rounded-md my-2 bg-zinc-950/50">
                    <div className="space-y-4">
                        {messages.length === 0 && !loading && (
                            <p className="text-center text-muted-foreground text-sm py-10">No messages yet. Say hi!</p>
                        )}
                        {messages.map(msg => {
                            // Logic:
                            // 1. If senderId is 'me', it's me (optimistic).
                            // 2. If currentUserId is provided and matches senderId, it's me.
                            // 3. Fallback: If senderId is NOT friend.userId, it's me.

                            const isMe = msg.senderId === 'me' ||
                                (currentUserId && msg.senderId === currentUserId) ||
                                (!currentUserId && msg.senderId !== friend.userId);

                            const isFriend = !isMe;

                            return (
                                <div key={msg.id} className={`flex ${isFriend ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${isFriend ? 'bg-zinc-800 text-zinc-100' : 'bg-indigo-600 text-white'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        })}

                        <div ref={scrollRef} />
                    </div>
                </div>

                <form onSubmit={sendMessage} className="flex gap-2">
                    <Input
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1"
                    />
                    <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
