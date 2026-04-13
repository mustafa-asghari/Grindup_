'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, X, Volume2, VolumeX, Sparkles, Wand2, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface AiTutorProps {
    subjectId: string;
    subjectName: string;
    contextData?: string;
    highlightedText?: string;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function AiTutor({ subjectId, subjectName, contextData, highlightedText }: AiTutorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const recognitionRef = useRef<any>(null);
    const autoResumeMic = useRef(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        const container = messagesContainerRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);

    // Load history from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`ai-tutor-history-${subjectId}`);
            if (saved) {
                setMessages(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to parse chat history", e);
        }
    }, [subjectId]);

    // Save history to localStorage
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(`ai-tutor-history-${subjectId}`, JSON.stringify(messages));
        }
    }, [messages, subjectId]);

    // Listen for the custom event from "Ask Tutor" button
    useEffect(() => {
        const handleOpenTutor = (event: any) => {
            const { highlightedText } = event.detail || {};
            setIsOpen(true); // Open the chat
            if (highlightedText) {
                // Pre-populate the input with a question about the highlighted text
                setInput(`Can you explain "${highlightedText.slice(0, 50)}${highlightedText.length > 50 ? '...' : ''}"?`);
            }
        };

        window.addEventListener('openAiTutor', handleOpenTutor);
        return () => window.removeEventListener('openAiTutor', handleOpenTutor);
    }, []);

    const toggleOpen = () => {
        setIsOpen(!isOpen);
        if (isOpen) setIsFullscreen(false);
    };

    const handleSend = async (overrideInput?: string) => {
        // If we are listening, stop temporarily to process (and avoid echo)
        if (isListening) {
            // Check if we captured anything valid in the transcript loop
            // If overrideInput is provided (from voice final result), use it.
            stopListening();
            autoResumeMic.current = true; // Resume after answering
        } else {
            stopAudio();
        }

        const rawText = overrideInput || input;
        if (!rawText.trim()) return;

        // Capture highlighted text context
        // We use the prop passed from parent if available, or try window.getSelection as fallback
        const selection = highlightedText || window.getSelection()?.toString() || '';

        let displayMsg = rawText;
        let apiQuery = rawText;

        // Integrate selection into the query context for the AI
        if (selection.trim()) {
            apiQuery = `${rawText}\n\n[Context: User highlighted the following text in the lesson: "${selection.trim()}"]`;
            // We don't show the full ugly context in the chat bubble, just the user's question
            // But maybe we show a tiny indicator?
        }

        setInput('');
        const newUserMsg: Message = { role: 'user', content: displayMsg };
        setMessages(prev => [...prev, newUserMsg]);
        setIsThinking(true);

        try {
            // Prepare history. Note: 'messages' here is the state BEFORE update.
            // We must append the new message for the history if we want the backend to see it as history? 
            // NO, the backend takes 'query' as the latest. 'history' is previous.
            // So passing 'messages' (current state) is correct as 'history'.
            // HOWEVER, we need to pass a deep history to ensure "what did you say" works.
            const historyPayload = messages.slice(-10); // Increased context window

            const res = await fetch('/api/tutor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subjectId,
                    query: apiQuery,
                    history: historyPayload,
                    contextData
                })
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                console.error("Tutor API Error:", data.error);
                throw new Error(data.error || 'Failed to connect to Tutor API');
            }

            if (data.answer) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
                if (data.audio) {
                    await playAudio(data.audio);
                } else if (autoResumeMic.current) {
                    // If no audio, resume mic immediately (but still safe delay)
                    safeResumeListening();
                    autoResumeMic.current = false;
                }
            }
        } catch (e: any) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}. Network issue?` }]);
            if (autoResumeMic.current) {
                safeResumeListening();
                autoResumeMic.current = false;
            }
        } finally {
            setIsThinking(false);
        }
    };

    const playAudio = async (base64Audio: string) => {
        if (isMuted) return;
        if (audioRef.current) {
            try {
                audioRef.current.src = `data:audio/mp3;base64,${base64Audio}`;
                await audioRef.current.play();
            } catch (err) {
                console.error("Audio playback failed:", err);
            }
        }
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const startListening = () => {
        stopAudio();
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.continuous = true; // Continuous to keep listening for the sentence
            recognition.interimResults = true;

            recognition.onstart = () => setIsListening(true);

            // We handle onend to auto-restart if we didn't intend to stop
            // But if we stopped for 'processing', we don't restart here.
            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.onresult = (event: any) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (finalTranscript) {
                    // --- ECHO CANCELLATION ---
                    // If the input is too similar to what the AI just said (last 100 chars), ignore it.
                    // This happens if the mic hears the speakers.
                    const lastResponse = messages.length > 0 && messages[messages.length - 1].role === 'assistant'
                        ? messages[messages.length - 1].content
                        : '';

                    const normalizedInput = finalTranscript.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const normalizedLastResponse = lastResponse.toLowerCase().replace(/[^a-z0-9]/g, '');

                    // Check if input is a substring of the last response (prefix match mostly)
                    if (normalizedLastResponse.includes(normalizedInput) && normalizedInput.length > 10) {
                        console.log("Ignored potential echo:", finalTranscript);
                        // Don't send, but maybe restart listening?
                        // If we just gathered an echo, we should probably just stay listening for real input.
                        // But since we are in continuous mode? 
                        // Actually, if we handled it as 'final', the loop continues if continuous=true?
                        // No, our logic below calls handleSend which stops/restarts.
                        // If we ignore, we just let it continue?
                        // "Final" usually means one utterance. If we treat it as echo, we should probably just clear input.
                        setInput('');
                        return;
                    }

                    // Final result detected - Send it!
                    handleSend(finalTranscript);
                } else {
                    // Update input with interim
                    setInput(interimTranscript);
                }
            };

            recognitionRef.current = recognition;
            recognition.start();
        } else {
            alert("Speech recognition not supported in this browser.");
        }
    };

    // Helper to restart with delay
    const safeResumeListening = () => {
        // Wait 800ms to allow physical echo/reverb to die down
        setTimeout(() => {
            if (isOpen) { // Only resume if still open
                startListening();
            }
        }, 800);
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsListening(false);
    };

    const toggleListening = () => {
        if (isListening) {
            stopListening();
            autoResumeMic.current = false; // User manually stopped
        } else {
            startListening();
        }
    };

    const floatVariants = {
        animate: {
            y: [0, -10, 0],
            rotate: [0, 2, -2, 0],
            transition: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut" as any
            }
        }
    };

    const clearHistory = () => {
        setMessages([]);
        localStorage.removeItem(`ai-tutor-history-${subjectId}`);
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 50, x: 0 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: isFullscreen ? 0 : undefined,
                            x: isFullscreen ? 0 : undefined
                        }}
                        exit={{ opacity: 0, scale: 0.8, y: 50 }}
                        drag={!isFullscreen}
                        dragElastic={0}
                        dragMomentum={false}
                        className={`fixed bg-black border border-gray-800 shadow-2xl z-50 overflow-hidden flex flex-col min-h-0 ${isFullscreen
                            ? 'inset-0 w-full h-full rounded-none'
                            : 'bottom-24 right-6 w-80 md:w-96 rounded-2xl'
                            }`}
                        style={isFullscreen ? { maxHeight: 'none', height: '100vh', width: '100vw' } : { maxHeight: '600px', height: '500px' }}
                    >
                        {/* Header */}
                        <div className="p-4 bg-gray-900/50 border-b border-gray-800 flex justify-between items-center flex-shrink-0 cursor-move">
                            <div className="flex items-center gap-2">
                                <Wand2 className="w-4 h-4 text-white" />
                                <span className="font-bold text-white">AI Tutor: {subjectName}</span>
                            </div>
                            <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => setIsFullscreen(prev => !prev)}
                                    className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
                                    title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
                                >
                                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                </button>
                                <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800" title={isMuted ? "Unmute" : "Mute"}>
                                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                </button>
                                <button onClick={clearHistory} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800" title="Reset Chat">
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                                <button onClick={toggleOpen} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-black cursor-auto" onPointerDown={(e) => e.stopPropagation()}>
                            {messages.length === 0 && (
                                <div className="text-center text-gray-500 mt-10">
                                    <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border border-gray-700 bg-gray-900">
                                        <img src="/mascot/cat-pic.png" alt="Professor Shadow" className="w-full h-full object-cover" />
                                    </div>
                                    <p className="font-medium text-gray-300">Hi! I'm Professor Shadow.</p>
                                    <p className="text-sm mt-2 text-gray-500">I'm here to help you study with laser focus! Ask me anything.</p>
                                </div>
                            )}
                            {messages.map((m, i) => (
                                <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`${m.role === 'user'
                                        ? 'max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm bg-blue-600 text-white rounded-br-none font-medium'
                                        : 'flex-1 w-full max-w-none px-1 text-sm text-gray-100 break-words'
                                        }`}>
                                        <div className="w-full">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkMath]}
                                                rehypePlugins={[rehypeRaw, rehypeKatex]}
                                                components={{
                                                    h2: ({ children }) => <h2 className="text-sm font-semibold text-gray-100 mt-2 mb-1">{children}</h2>,
                                                    h3: ({ children }) => <h3 className="text-sm font-medium text-gray-200 mt-2 mb-1">{children}</h3>,
                                                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                                    li: ({ children }) => <li>{children}</li>,
                                                    code: ({ inline, className, children, ...props }: any) => (
                                                        inline
                                                            ? <code className="bg-black/20 px-1 rounded text-xs font-mono">{children}</code>
                                                            : <code className="block bg-black/40 p-2 rounded text-xs font-mono my-2 overflow-x-auto whitespace-pre-wrap">{children}</code>
                                                    ),
                                                }}
                                            >
                                                {m.content}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isThinking && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-none px-4 py-3 flex gap-1 items-center">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Highlight Context Indicator */}
                        {highlightedText && (
                            <div className="px-4 py-2 bg-gray-900 border-t border-gray-800 text-xs text-gray-400 flex items-center gap-2 truncate whitespace-nowrap flex-shrink-0">
                                <Sparkles className="w-3 h-3 text-yellow-500" />
                                <span>Target: "{highlightedText.substring(0, 40)}{highlightedText.length > 40 ? '...' : ''}"</span>
                            </div>
                        )}

                        {/* Input Area */}
                        <div className="p-4 bg-gray-900/50 border-t border-gray-800 flex gap-2 flex-shrink-0 cursor-auto" onPointerDown={(e) => e.stopPropagation()}>
                            <button
                                onClick={toggleListening}
                                className={`p-3 rounded-xl transition-all flex items-center justify-center ${isListening
                                    ? 'bg-red-500/20 text-red-500 ring-2 ring-red-500 animate-pulse'
                                    : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white'
                                    }`}
                                title={isListening ? "Stop Voice Mode" : "Start Voice Mode"}
                            >
                                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder={isListening ? "Listening..." : "Ask about this topic..."}
                                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-gray-500 transition-colors"
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!input.trim() || isThinking}
                                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl p-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Cat Button */}
            {!isOpen && (
                <motion.div
                    className="fixed bottom-6 right-6 z-50 cursor-pointer group"
                    variants={floatVariants}
                    animate="animate"
                    onClick={toggleOpen}
                    whileHover={{ scale: 1.1 }}
                    drag
                    dragMomentum={false}
                    whileDrag={{ scale: 1.2, cursor: 'grabbing' }}
                >
                    <div className="relative">
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />

                        {/* The Cat Image */}
                        <div className="w-20 h-20 relative">
                            <div className="w-full h-full bg-black rounded-full flex items-center justify-center overflow-hidden border-2 border-gray-700 group-hover:border-blue-500 transition-colors shadow-2xl">
                                <img src="/mascot/shadow.svg" alt="AI Tutor" className="w-full h-full object-cover p-2" />
                            </div>
                            {/* Status Indicator */}
                            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-black rounded-full z-10" />
                        </div>
                    </div>
                </motion.div>
            )}

            <audio
                ref={audioRef}
                className="hidden"
                onPlay={() => {
                    // Mic is already stopped in handleSend
                }}
                onEnded={() => {
                    // Resume listening if we were in "auto" mode
                    if (autoResumeMic.current) {
                        safeResumeListening();
                        autoResumeMic.current = false;
                    }
                }}
            />
        </>
    );
}
