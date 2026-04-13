'use client';

import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { Send, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message {
    id: string;
    message: string;
    createdAt: string;
    user: {
        id: string;
        name: string | null;
        image: string | null;
        email: string | null;
    };
}

interface ContestChatProps {
    apiEndpoint: string;
    className?: string;
    currentUserId: string;
}

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
};

export function ContestChat({ apiEndpoint, className, currentUserId }: ContestChatProps) {
    const { data: messages, mutate, error } = useSWR<Message[]>(
        apiEndpoint,
        fetcher,
        { refreshInterval: 2000 }
    );

    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || isSending) return;

        const msg = newMessage;
        setNewMessage('');
        setIsSending(true);

        try {
            await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg }),
            });
            mutate(); // Trigger re-fetch
        } catch (error) {
            console.error('Failed to send message', error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className={cn("flex flex-col bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shadow-xl", className)}>
            <div className="bg-gray-900 px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <span className="font-medium text-gray-200">Live Chat</span>
                <span className="text-xs text-gray-500 ml-auto">
                    {messages ? messages.length : 0} messages
                </span>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent"
            >
                {error ? (
                    <div className="flex justify-center py-4 text-red-500 text-sm">Error loading chat. Retrying...</div>
                ) : !messages ? (
                    <div className="flex justify-center py-4 text-gray-600 text-sm">Loading chat...</div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm opacity-50">
                        <MessageSquare className="w-8 h-8 mb-2" />
                        <p>No messages yet. Say hi!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.user.id === currentUserId;
                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex flex-col max-w-[85%]",
                                    isMe ? "ml-auto items-end" : "mr-auto items-start"
                                )}
                            >
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-xs text-gray-500 font-medium">
                                        {isMe ? 'You' : (msg.user.name || 'User')}
                                    </span>
                                    <span className="text-[10px] text-gray-600">
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div
                                    className={cn(
                                        "px-3 py-2 rounded-lg text-sm break-words",
                                        isMe
                                            ? "bg-purple-600 text-white rounded-br-none"
                                            : "bg-gray-800 text-gray-200 rounded-bl-none"
                                    )}
                                >
                                    {msg.message}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <form onSubmit={handleSend} className="p-3 bg-gray-900 border-t border-gray-800 flex gap-2">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-950 border-gray-800 text-gray-200 focus:ring-purple-500"
                />
                <Button
                    type="submit"
                    size="icon"
                    disabled={!newMessage.trim() || isSending}
                    className="bg-purple-600 hover:bg-purple-500 shrink-0"
                >
                    <Send className="w-4 h-4" />
                </Button>
            </form>
        </div>
    );
}
