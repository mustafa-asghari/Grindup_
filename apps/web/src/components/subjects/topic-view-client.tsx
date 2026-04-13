'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, CheckCircle2, XCircle,
    Lock, Menu, X, Wand2, Loader2, RefreshCw, Sparkles,
    ClipboardList, Upload, Clock, AlertTriangle, Trophy
} from 'lucide-react';
import { HomeworkSubmit } from '@/components/learning/homework-submit';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { AiTutor } from '@/components/learning/ai-tutor';
import { Mermaid } from '@/components/ui/mermaid';
import { useStudyTimeTracker } from '@/hooks/use-study-time-tracker';

interface McqContent {
    question: string;
    options: string[];
    correctAnswers: number[];
    explanation?: string;
}

interface FlashcardContent {
    front: string;
    back: string;
    hints?: string[];
}

type ExerciseBase = {
    id: string;
    type: string;
    content: unknown;
    points?: number;
};

type McqExercise = ExerciseBase & {
    type: 'mcq';
    content: McqContent;
};

type FlashcardExercise = ExerciseBase & {
    type: 'flashcard';
    content: FlashcardContent;
};

type Exercise = McqExercise | FlashcardExercise;

interface Topic {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    content: string | null;
    exercise: Exercise[];
    children: Topic[];
    estimatedMins?: number;
    userProgress?: {
        status: string;
        masteryPercent: number;
    }[];
}

interface HomeworkAssignment {
    id: string;
    title: string;
    description?: string | null;
    type: 'exercise' | 'problem' | 'reading' | 'general';
    subjectName: string;
    subjectSlug: string;
    dueDate: string;
    estimatedMins: number;
    isLate: boolean;
    latePenalty?: number;
    isCompleted: boolean;
    xpReward?: number | null;
}

interface TopicViewClientProps {
    subject: {
        id: string;
        name: string;
        slug: string;
    };
    topic: Topic;
    initialTopicId?: string;
    homework?: HomeworkAssignment[];
}

type MarkdownBlock = { type: 'markdown' | 'question'; content: string };

const normalizeContentSpacing = (input?: string | null) => {
    if (!input) return '';

    // 1. Unify newlines
    let text = input.replace(/\r\n/g, '\n');

    // 2. Ensure blank lines around headings
    text = text.replace(/^#+\s/gm, (match) => `\n\n${match}`);

    // 3. Ensure blank lines around code fences and math blocks
    text = text.replace(/(\n```)/g, '\n$1');
    text = text.replace(/(```\n)/g, '$1\n');
    text = text.replace(/(\$\$)/g, '\n$1\n');

    // 4. Fix potential "jumbled" lists (ensure newline before bullet)
    text = text.replace(/([^\n])\n(-|\*|\d+\.) /g, '$1\n\n$2 ');

    // 5. Clean up excessive newlines
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
};

const splitQuestionBlocks = (input?: string | null): MarkdownBlock[] => {
    if (!input) return [];
    const blocks: MarkdownBlock[] = [];
    const pattern = /:::question\s*([\s\S]*?)\s*:::/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(input)) !== null) {
        if (match.index > lastIndex) {
            const before = input.slice(lastIndex, match.index);
            if (before.trim()) blocks.push({ type: 'markdown', content: before });
        }
        const questionContent = match[1]?.trim();
        if (questionContent) blocks.push({ type: 'question', content: questionContent });
        lastIndex = match.index + match[0].length;
    }

    const rest = input.slice(lastIndex);
    if (rest.trim()) blocks.push({ type: 'markdown', content: rest });

    if (blocks.length === 0) {
        return [{ type: 'markdown', content: input }];
    }

    return blocks;
};

const lessonParagraphClass = 'leading-7 my-2 text-gray-200 text-[17px]';
const questionParagraphClass = 'mb-3 last:mb-0 leading-relaxed';

const createLessonMarkdownComponents = (fallbackLabel?: string): Components => ({
    h1: (props: ComponentPropsWithoutRef<'h1'>) => <h1 className="text-2xl md:text-3xl font-bold mt-5 mb-2 text-white" {...props} />,
    h2: (props: ComponentPropsWithoutRef<'h2'>) => <h2 className="text-xl md:text-2xl font-semibold mt-4 mb-2 text-white flex items-center gap-2" {...props} />,
    p: (props: ComponentPropsWithoutRef<'p'>) => <p className={lessonParagraphClass} {...props} />,
    pre: ({ children, ...props }: ComponentPropsWithoutRef<'pre'>) => {
        const child = children as React.ReactElement<{ className?: string; children?: string }>;
        if (child?.props?.className?.includes('language-mermaid')) {
            const code = child?.props?.children || '';
            return <Mermaid chart={String(code).trim()} className="my-4" fallbackLabel={fallbackLabel} />;
        }
        return <pre className="bg-gray-800/80 rounded-lg p-4 my-4 overflow-x-auto" {...props}>{children}</pre>;
    },
    code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string } & ComponentPropsWithoutRef<'code'>) => {
        if (className?.includes('language-mermaid')) {
            return <code className={className} {...props}>{children}</code>;
        }
        return inline
            ? <code className="px-1.5 py-0.5 rounded bg-gray-800 text-blue-300 text-sm font-mono" {...props}>{children}</code>
            : <code className="block whitespace-pre-wrap bg-gray-800/80 rounded-lg p-4 my-4 text-sm leading-7 font-mono text-gray-100" {...props}>{children}</code>;
    },
    img: ({ src, alt, ...props }: ComponentPropsWithoutRef<'img'>) => (
        <span className="my-6 block rounded-xl overflow-hidden border border-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt || 'Illustration'} className="w-full h-auto" {...props} />
            {alt && <span className="block text-sm text-gray-500 text-center p-2 bg-gray-900/50">{alt}</span>}
        </span>
    ),
    ul: (props: ComponentPropsWithoutRef<'ul'>) => <ul className="list-disc pl-6 my-4 space-y-2 text-gray-300 marker:text-gray-500" {...props} />,
    ol: (props: ComponentPropsWithoutRef<'ol'>) => <ol className="list-decimal pl-6 my-4 space-y-2 text-gray-300 marker:text-gray-500" {...props} />,
    li: (props: ComponentPropsWithoutRef<'li'>) => <li className="pl-1" {...props} />,
});

const questionMarkdownComponents: Components = {
    p: ({ children }) => <p className={questionParagraphClass}>{children}</p>,
};

const optionMarkdownComponents: Components = {
    p: ({ children }) => <p className="m-0 leading-relaxed">{children}</p>,
};

const inlineMarkdownComponents: Components = {
    p: ({ children }) => <span>{children}</span>,
};

export function TopicViewClient({ subject, topic: rootTopic, initialTopicId, homework = [] }: TopicViewClientProps) {
    const router = useRouter();
    const [currentTopicId, setCurrentTopicId] = useState<string>(initialTopicId || rootTopic.id);
    const [currentTopic, setCurrentTopic] = useState<Topic | null>(
        rootTopic.id === initialTopicId ? rootTopic :
            rootTopic.children.find(c => c.id === initialTopicId) || rootTopic
    );

    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [activeTab, setActiveTab] = useState<'lesson' | 'flashcards' | 'quiz' | 'homework'>('lesson');
    const [homeworkAssignments, setHomeworkAssignments] = useState<HomeworkAssignment[]>(homework);
    const [selectedHomework, setSelectedHomework] = useState<HomeworkAssignment | null>(null);
    const [masteredTopicIds, setMasteredTopicIds] = useState<Set<string>>(() => {
        const mastered = new Set<string>();
        const addIfMastered = (t: Topic) => {
            if (t.userProgress?.[0]?.status === 'mastered') mastered.add(t.id);
            t.children?.forEach(addIfMastered);
        };
        addIfMastered(rootTopic);
        return mastered;
    });

    // Generation states
    const [isGeneratingSubtopics, setIsGeneratingSubtopics] = useState(false);
    const [isGeneratingContent, setIsGeneratingContent] = useState(false);
    const [isGeneratingHomework, setIsGeneratingHomework] = useState(false);
    const [checkedActivityTopicId, setCheckedActivityTopicId] = useState<string | null>(null);
    const [highlightedText, setHighlightedText] = useState('');
    const [progressMarkedTopicId, setProgressMarkedTopicId] = useState<string | null>(null);

    // Curriculum generation preferences
    const [contentStyle, setContentStyle] = useState<'easy' | 'standard' | 'advanced'>('standard');
    const [contentTone, setContentTone] = useState<'casual' | 'formal' | 'friendly'>('friendly');
    const [customInstructions, setCustomInstructions] = useState('');

    useEffect(() => {
        if (currentTopicId !== 'final-exam') {
            setActiveTab('lesson');
        }
    }, [currentTopicId]);

    useStudyTimeTracker({
        subjectId: subject.id,
        topicId: currentTopicId === 'final-exam' ? rootTopic.id : currentTopicId,
        enabled: true
    });

    const [selectionBounds, setSelectionBounds] = useState<DOMRect | null>(null);

    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            const text = selection?.toString().trim();

            if (text && text.length > 0) {
                setHighlightedText(text);
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    setSelectionBounds(range.getBoundingClientRect());
                }
            } else {
                setHighlightedText('');
                setSelectionBounds(null);
            }
        };
        document.addEventListener('mouseup', handleSelection);
        document.addEventListener('keyup', handleSelection);
        // Also listen to selectionchange for better responsiveness? 
        // document.addEventListener('selectionchange', handleSelection); 
        // selectionchange fires too often, mouseup/keyup is safer for UI stability
        return () => {
            document.removeEventListener('mouseup', handleSelection);
            document.removeEventListener('keyup', handleSelection);
        };
    }, []);

    const handleAskAi = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('openAiTutor', {
            detail: { highlightedText }
        }));
        // Clear selection UI but keep text for AI? 
        // No, keep it so user sees what they selected.
    };

    const refreshRoot = () => {
        router.refresh();
    };

    const getContentPreferences = useCallback(() => ({
        style: contentStyle,
        tone: contentTone,
        customInstructions: customInstructions.trim() || undefined
    }), [contentStyle, contentTone, customInstructions]);

    const parseErrorMessage = async (res: Response) => {
        try {
            const body = await res.json();
            return body?.error || body?.message || null;
        } catch {
            return null;
        }
    };

    const fetchTopicData = async (topicId: string) => {
        setIsLoadingContent(true);
        try {
            const res = await fetch(`/api/topics/${topicId}`);
            if (res.ok) {
                const data = await res.json();
                setCurrentTopic(data);
                if (data.userTopicProgress?.[0]?.status === 'mastered') {
                    setMasteredTopicIds(prev => {
                        if (prev.has(topicId)) return prev;
                        const next = new Set(prev);
                        next.add(topicId);
                        return next;
                    });
                }
            }
        } catch (e) {
            console.error("Failed to load topic", e);
        } finally {
            setIsLoadingContent(false);
            if (window.innerWidth < 768) setSidebarOpen(false);
        }
    };

    const handleTopicChange = async (topicId: string) => {
        if (topicId === currentTopicId) return;
        setCurrentTopicId(topicId);

        if (topicId === 'final-exam') {
            setCurrentTopic({
                id: 'final-exam',
                name: 'Final Capstone Project',
                slug: 'final-exam',
                description: 'The ultimate test of your knowledge. This final assignment covers all subtopics in this module. You must complete it to master the subject.',
                content: 'Final Exam Mode',
                exercise: [],
                children: []
            });
            setActiveTab('homework');
            if (window.innerWidth < 768) setSidebarOpen(false);
            return;
        }

        await fetchTopicData(topicId);
    };

    const handleGenerateSubtopics = async () => {
        setIsGeneratingSubtopics(true);
        try {
            const res = await fetch('/api/topics/generate-subtopics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topicId: rootTopic.id,
                    subjectName: subject.name,
                    topicName: rootTopic.name,
                    contentPreferences: getContentPreferences()
                }),
            });
            if (res.ok) {
                refreshRoot();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGeneratingSubtopics(false);
        }
    };

    const isTopicLocked = (tId: string, index: number) => {
        if (index === 0) return false;
        const prevTopic = rootTopic.children[index - 1];
        return !masteredTopicIds.has(prevTopic.id);
    };

    const handleGenerateContent = async () => {
        if (!currentTopic) return;
        setIsGeneratingContent(true);
        try {
            const res = await fetch('/api/topics/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topicId: currentTopic.id,
                    subjectName: subject.name,
                    topicName: currentTopic.name,
                    force: true,
                    contentPreferences: getContentPreferences()
                }),
            });

            if (!res.ok) {
                const message = await parseErrorMessage(res);
                throw new Error(message || 'Failed to generate content');
            }
            const data = await res.json();
            const generatedContent = data.content;

            setCurrentTopic(prev => prev ? { ...prev, content: generatedContent } : null);

            const resActivities = await fetch('/api/topics/generate-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topicId: currentTopic.id,
                    topicName: currentTopic.name,
                    content: generatedContent,
                    force: true,
                    contentPreferences: getContentPreferences()
                }),
            });

            if (!resActivities.ok) {
                const message = await parseErrorMessage(resActivities);
                // If rate limited, still refresh the topic data (content was generated successfully)
                if (resActivities.status === 429) {
                    console.warn('Rate limited on quiz generation, content was still saved');
                    await fetchTopicData(currentTopicId);
                    return; // Don't throw, content is saved
                }
                throw new Error(message || 'Failed to generate activities');
            }

            await fetchTopicData(currentTopicId);
        } catch (e) {
            console.error(e);
            const message = e instanceof Error ? e.message : "Failed to generate content. Please try again.";
            // Don't show alert for rate limit errors if we handled them above
            if (!message.includes('Too many requests')) {
                alert(message);
            }
        } finally {
            setIsGeneratingContent(false);
        }
    };

    const handleGenerateHomework = async (isFinal = false) => {
        if (!currentTopic) return;
        setIsGeneratingHomework(true);
        const isFinalExam = currentTopicId === 'final-exam' || isFinal;
        const effectiveTopicId = currentTopicId === 'final-exam' ? rootTopic.id : currentTopic.id;

        try {
            const res = await fetch('/api/homework/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topicId: effectiveTopicId,
                    subjectId: subject.id,
                    topicName: isFinalExam ? `${subject.name} - Final Capstone` : currentTopic.name,
                    content: currentTopic.content,
                    isFinal: isFinalExam,
                    contentPreferences: getContentPreferences()
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate homework');
            }

            // Add the new homework to the list
            const newHomework: HomeworkAssignment = {
                id: data.assignment.id,
                title: data.assignment.title,
                description: data.assignment.description,
                type: data.assignment.type as 'exercise' | 'problem' | 'reading' | 'general',
                subjectName: subject.name,
                subjectSlug: subject.slug,
                dueDate: data.assignment.dueDate,
                estimatedMins: data.assignment.estimatedMins,
                isLate: false,
                latePenalty: 0,
                isCompleted: false,
                xpReward: data.assignment.xpReward,
            };

            setHomeworkAssignments(prev => [...prev, newHomework]);
            setActiveTab('homework');
        } catch (e) {
            console.error(e);
            const message = e instanceof Error ? e.message : "Failed to generate homework. Please try again.";
            alert(message);
        } finally {
            setIsGeneratingHomework(false);
        }
    };

    useEffect(() => {
        const maybeGenerateActivities = async () => {
            if (!currentTopic || !currentTopic.content) return;
            if (checkedActivityTopicId === currentTopicId) return;

            const hasActivities = currentTopic.exercise && currentTopic.exercise.length > 0;
            if (hasActivities) {
                setCheckedActivityTopicId(currentTopicId);
                return;
            }

            setCheckedActivityTopicId(currentTopicId);
            try {
                const res = await fetch('/api/topics/generate-quiz', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topicId: currentTopic.id,
                        topicName: currentTopic.name,
                        content: currentTopic.content,
                        contentPreferences: getContentPreferences()
                    }),
                });
                if (res.ok) {
                    await fetchTopicData(currentTopicId);
                }
            } catch (e) {
                console.error("Auto activities generation failed", e);
            }
        };
        maybeGenerateActivities();
    }, [currentTopic, currentTopicId, checkedActivityTopicId, getContentPreferences]);

    // Mark topic as in-progress when opened so locking/progress charts have data
    useEffect(() => {
        if (!currentTopic) return;
        if (progressMarkedTopicId === currentTopic.id) return;
        const alreadyMastered = currentTopic.userProgress?.[0]?.status === 'mastered';
        if (alreadyMastered) {
            setProgressMarkedTopicId(currentTopic.id);
            return;
        }

        const markProgress = async () => {
            try {
                await fetch('/api/topics/progress', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topicId: currentTopic.id,
                        status: 'in_progress',
                        masteryPercent: currentTopic.userProgress?.[0]?.masteryPercent ?? 10,
                    }),
                });
                setProgressMarkedTopicId(currentTopic.id);
            } catch (e) {
                console.error('Failed to mark topic progress', e);
            }
        };
        markProgress();
    }, [currentTopic, progressMarkedTopicId]);

    const hasSubtopics = rootTopic.children && rootTopic.children.length > 0;
    const isRoot = currentTopicId === rootTopic.id;

    const isMcqExercise = (exercise: Exercise): exercise is McqExercise => {
        if (exercise.type !== 'mcq') return false;
        const content = exercise.content as McqContent;
        return Array.isArray(content?.options) && Array.isArray(content?.correctAnswers);
    };

    const isFlashcardExercise = (exercise: Exercise): exercise is FlashcardExercise => {
        if (exercise.type !== 'flashcard') return false;
        const content = exercise.content as FlashcardContent;
        return typeof content?.front === 'string' && typeof content?.back === 'string';
    };

    const handleQuizPassed = async () => {
        setMasteredTopicIds(prev => {
            if (prev.has(currentTopicId)) return prev;
            const next = new Set(prev);
            next.add(currentTopicId);
            return next;
        });
        await fetchTopicData(currentTopicId);
        refreshRoot();
    };

    const mcqs = (currentTopic?.exercise ?? []).filter(isMcqExercise);
    const flashcards = (currentTopic?.exercise ?? []).filter(isFlashcardExercise);
    const quizKey = mcqs.map(mcq => mcq.id || mcq.content.question).join('|') || currentTopicId;
    const normalizedLessonContent = normalizeContentSpacing(currentTopic?.content);
    const lessonBlocks = splitQuestionBlocks(normalizedLessonContent);
    const lessonMarkdownComponents = createLessonMarkdownComponents(currentTopic?.name);

    return (
        <>
            <div className="fixed inset-0 flex bg-black text-white">
                <div className="md:hidden fixed top-4 right-4 z-50">
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 bg-gray-800 rounded-lg text-white">
                        {sidebarOpen ? <X /> : <Menu />}
                    </button>
                </div>

                <AnimatePresence mode='wait'>
                    {(sidebarOpen || window.innerWidth >= 768) && (
                        <motion.aside
                            initial={{ x: -250 }}
                            animate={{ x: 0 }}
                            exit={{ x: -250 }}
                            className={`fixed md:relative w-full md:w-80 h-full bg-gray-900 border-r border-gray-800 z-40 flex flex-col ${!sidebarOpen && 'hidden md:flex'}`}
                        >
                            <div className="p-6 border-b border-gray-800">
                                <Link href={`/subjects/${subject.slug}`} className="flex items-center gap-2 text-gray-500 hover:text-white mb-4 text-sm transition-colors">
                                    <ArrowLeft className="w-4 h-4" />
                                    {subject.name}
                                </Link>
                                <h2 className="text-xl font-bold line-clamp-2">{rootTopic.name}</h2>
                                <div className="mt-2 text-xs text-gray-500 uppercase tracking-wider font-semibold">Course Content</div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                <button onClick={() => handleTopicChange(rootTopic.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${currentTopicId === rootTopic.id ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'hover:bg-gray-800 text-gray-400'}`}>
                                    <div className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">0</div>
                                    <span className="font-medium text-sm">Introduction</span>
                                </button>

                                {rootTopic.children.map((child, idx) => {
                                    const locked = isTopicLocked(child.id, idx);
                                    const active = currentTopicId === child.id;
                                    const completed = masteredTopicIds.has(child.id);

                                    return (
                                        <button
                                            key={child.id}
                                            onClick={() => !locked && handleTopicChange(child.id)}
                                            disabled={locked}
                                            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : locked ? 'opacity-50 cursor-not-allowed bg-gray-900/50' : completed ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'text-gray-300 hover:bg-gray-800'}`}
                                        >
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${completed ? 'bg-green-500 text-black' : 'border border-current'}`}>
                                                {completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : locked ? <Lock className="w-3 h-3" /> : idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">{child.name}</div>
                                                {child.estimatedMins && <div className="text-[10px] opacity-70">{child.estimatedMins} mins</div>}
                                            </div>
                                        </button>
                                    );
                                })}

                                <div className="pt-2 border-t border-gray-800 mt-2">
                                    <button
                                        onClick={() => handleTopicChange('final-exam')}
                                        disabled={!rootTopic.children.every(c => masteredTopicIds.has(c.id))}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${currentTopicId === 'final-exam' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/40 shadow-lg' : !rootTopic.children.every(c => masteredTopicIds.has(c.id)) ? 'opacity-40 cursor-not-allowed' : 'text-yellow-500 hover:bg-yellow-500/10'}`}
                                    >
                                        <div className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs flex-shrink-0">
                                            {rootTopic.children.every(c => masteredTopicIds.has(c.id)) ? <Trophy className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}
                                        </div>
                                        <span className="font-bold text-sm">Final Exam</span>
                                    </button>
                                </div>
                            </div>
                        </motion.aside>
                    )}
                </AnimatePresence>

                <main className="flex-1 h-full overflow-y-auto bg-black p-4 md:p-8 lg:p-12">
                    <div className="max-w-4xl mx-auto">
                        {isLoadingContent ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                                <p className="text-gray-400">Loading lesson...</p>
                            </div>
                        ) : currentTopic ? (
                            <div className="space-y-8">
                                <header className="mb-8">
                                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">{currentTopic.name}</h1>
                                    {currentTopic.description && <p className="text-xl text-gray-400 leading-relaxed">{currentTopic.description}</p>}
                                    {!isRoot && (
                                        <div className="mt-4 flex flex-wrap items-center gap-3">
                                            <button onClick={handleGenerateContent} disabled={isGeneratingContent} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50">
                                                {isGeneratingContent ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                                {currentTopic.content ? 'Regenerate Everything' : 'Generate Lesson & Activities'}
                                            </button>

                                        </div>
                                    )}
                                </header>

                                {!currentTopic.content && !hasSubtopics && isRoot && (
                                    <div className="p-8 rounded-2xl bg-gray-900 border border-gray-800 text-center space-y-6">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
                                            <Wand2 className="w-8 h-8 text-white" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white">Let&apos;s build your curriculum</h3>
                                        <div className="grid gap-3 text-left">
                                            <div>
                                                <label className="text-sm text-gray-300 font-medium" htmlFor="content-style">Difficulty</label>
                                                <select
                                                    id="content-style"
                                                    value={contentStyle}
                                                    onChange={(e) => setContentStyle(e.target.value as typeof contentStyle)}
                                                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                >
                                                    <option value="easy">Easy / foundational</option>
                                                    <option value="standard">Standard</option>
                                                    <option value="advanced">Advanced / fast-paced</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-300 font-medium" htmlFor="content-tone">Tone</label>
                                                <select
                                                    id="content-tone"
                                                    value={contentTone}
                                                    onChange={(e) => setContentTone(e.target.value as typeof contentTone)}
                                                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                >
                                                    <option value="friendly">Friendly & encouraging</option>
                                                    <option value="casual">Casual & concise</option>
                                                    <option value="formal">Formal & structured</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-300 font-medium" htmlFor="custom-instructions">Extra guidance (optional)</label>
                                                <textarea
                                                    id="custom-instructions"
                                                    value={customInstructions}
                                                    onChange={(e) => setCustomInstructions(e.target.value)}
                                                    placeholder="e.g. Use real-life analogies, focus on visual learners, keep wording informal."
                                                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                    rows={3}
                                                />
                                                <p className="text-xs text-gray-500 mt-1">We will pass this to the AI before it drafts the subtopics.</p>
                                            </div>
                                        </div>
                                        <button onClick={handleGenerateSubtopics} disabled={isGeneratingSubtopics} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-colors disabled:opacity-50">
                                            {isGeneratingSubtopics ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                                            Generate Curriculum
                                        </button>
                                    </div>
                                )}

                                {currentTopic.content && (
                                    <div className="flex border-b border-gray-800 mb-6">
                                        <button onClick={() => setActiveTab('lesson')} className={`px-6 py-3 font-medium transition-all relative ${activeTab === 'lesson' ? 'text-blue-500' : 'text-gray-500 hover:text-white'}`}>
                                            Lesson
                                            {activeTab === 'lesson' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                                        </button>
                                        <button onClick={() => setActiveTab('flashcards')} className={`px-6 py-3 font-medium transition-all relative ${activeTab === 'flashcards' ? 'text-blue-500' : 'text-gray-500 hover:text-white'}`}>
                                            Flashcards ({flashcards.length})
                                            {activeTab === 'flashcards' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                                        </button>
                                        <button onClick={() => setActiveTab('quiz')} className={`px-6 py-3 font-medium transition-all relative ${activeTab === 'quiz' ? 'text-blue-500' : 'text-gray-500 hover:text-white'}`}>
                                            Quiz ({mcqs.length})
                                            {activeTab === 'quiz' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                                        </button>
                                        <button onClick={() => setActiveTab('homework')} className={`px-6 py-3 font-medium transition-all relative ${activeTab === 'homework' ? 'text-blue-500' : 'text-gray-500 hover:text-white'}`}>
                                            Homework ({homeworkAssignments.filter(h => !h.isCompleted).length})
                                            {homeworkAssignments.some(h => h.isLate && !h.isCompleted) && (
                                                <span className="ml-1 w-2 h-2 bg-red-500 rounded-full inline-block" />
                                            )}
                                            {activeTab === 'homework' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                                        </button>
                                    </div>
                                )}

                                <AnimatePresence mode="wait">
                                    {activeTab === 'lesson' && currentTopic.content && (
                                        <motion.div key="lesson" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-3xl w-full mx-auto bg-gray-900/30 p-6 rounded-2xl border border-gray-800 space-y-2 lesson-content">
                                            {lessonBlocks.length > 0 ? (
                                                lessonBlocks.map((block, idx) => (
                                                    block.type === 'question' ? (
                                                        <div key={`lesson-question-${idx}`} className="my-6">
                                                            <div className="mx-auto max-w-2xl text-center">
                                                                <ReactMarkdown
                                                                    remarkPlugins={[remarkMath]}
                                                                    rehypePlugins={[rehypeRaw, [rehypeKatex, { output: 'html' }]]}
                                                                    components={lessonMarkdownComponents}
                                                                >
                                                                    {block.content}
                                                                </ReactMarkdown>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <ReactMarkdown
                                                            key={`lesson-markdown-${idx}`}
                                                            remarkPlugins={[remarkMath]}
                                                            rehypePlugins={[rehypeRaw, rehypeKatex]}
                                                            components={lessonMarkdownComponents}
                                                        >
                                                            {block.content}
                                                        </ReactMarkdown>
                                                    )
                                                ))
                                            ) : (
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkMath]}
                                                    rehypePlugins={[rehypeRaw, rehypeKatex]}
                                                    components={lessonMarkdownComponents}
                                                >
                                                    {currentTopic.content}
                                                </ReactMarkdown>
                                            )}
                                        </motion.div>
                                    )}

                                    {activeTab === 'flashcards' && (
                                        <motion.div key="flashcards" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="py-4">
                                            {flashcards.length > 0 ? <FlashcardRunner flashcards={flashcards} /> : <div className="text-center py-20 bg-gray-900/20 rounded-2xl border border-gray-800">
                                                <Sparkles className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                                <p className="text-gray-500">No flashcards available. <button onClick={handleGenerateContent} className="text-blue-500 hover:underline">Generate activities</button></p>
                                            </div>}
                                        </motion.div>
                                    )}

                                    {activeTab === 'quiz' && (
                                        <motion.div key="quiz" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="py-4">
                                            {mcqs.length > 0 ? <QuizRunner key={quizKey} exercises={mcqs} topicId={currentTopic.id} onPass={handleQuizPassed} /> : <div className="text-center py-20 bg-gray-900/20 rounded-2xl border border-gray-800">
                                                <CheckCircle2 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                                <p className="text-gray-500">No quiz available. <button onClick={handleGenerateContent} className="text-blue-500 hover:underline">Generate activities</button></p>
                                            </div>}
                                        </motion.div>
                                    )}

                                    {activeTab === 'homework' && (
                                        <motion.div key="homework" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="py-4">
                                            <HomeworkSection
                                                assignments={homeworkAssignments}
                                                onSelectHomework={setSelectedHomework}
                                                onGenerateHomework={handleGenerateHomework}
                                                isGenerating={isGeneratingHomework}
                                                hasContent={!!currentTopic?.content}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <div className="text-center py-20 text-gray-500">Topic not found.</div>
                        )}
                    </div>
                </main>
            </div>

            {/* Floating Selection Action */}
            <AnimatePresence>
                {highlightedText && selectionBounds && (
                    <motion.button
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        onClick={handleAskAi}
                        className="fixed z-[100] flex items-center gap-2 px-3 py-1.5 bg-black border border-blue-500/50 rounded-full shadow-xl text-blue-400 font-medium text-sm hover:bg-blue-900/20 transition-colors backdrop-blur-md"
                        style={{
                            top: Math.max(10, selectionBounds.top - 50),
                            left: Math.max(10, selectionBounds.left)
                        }}
                    >
                        <Sparkles className="w-4 h-4" />
                        Ask AI
                    </motion.button>
                )}
            </AnimatePresence>

            <AiTutor
                subjectId={subject.id}
                subjectName={currentTopic?.name || subject.name}
                contextData={currentTopic ? `Current Subtopic: ${currentTopic.name}\n\nLesson Content:\n${currentTopic.content || '(No content yet)'}` : undefined}
                highlightedText={highlightedText}
            />

            {/* Homework Submit Modal */}
            <AnimatePresence>
                {selectedHomework && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setSelectedHomework(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full max-w-lg"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="relative">
                                <button
                                    onClick={() => setSelectedHomework(null)}
                                    className="absolute -top-12 right-0 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <HomeworkSubmit
                                    homeworkId={selectedHomework.id}
                                    homeworkTitle={selectedHomework.title}
                                    onSubmitted={(result) => {
                                        setSelectedHomework(null);
                                        if (result.score >= 50) {
                                            setHomeworkAssignments(prev =>
                                                prev.map(h => h.id === selectedHomework.id ? { ...h, isCompleted: true } : h)
                                            );
                                            refreshRoot();
                                        }
                                    }}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function QuizRunner({ exercises, topicId, onPass }: { exercises: McqExercise[], topicId: string, onPass: () => void }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isRevealed, setIsRevealed] = useState(false);

    const currentQuestion = exercises[currentIndex];
    const isLast = currentIndex === exercises.length - 1;

    const handleCheck = () => {
        if (selectedOption === null || !currentQuestion?.content) return;
        setIsRevealed(true);
        if (currentQuestion.content.correctAnswers?.includes(selectedOption)) setScore(s => s + 1);
    };

    const handleNext = () => {
        if (isLast) finishQuiz();
        else { setCurrentIndex(i => i + 1); setSelectedOption(null); setIsRevealed(false); }
    };

    const finishQuiz = async () => {
        const totalQuestions = exercises.length;
        const additionalPoint = selectedOption !== null && currentQuestion?.content?.correctAnswers?.includes(selectedOption) ? 1 : 0;
        const finalScore = score + additionalPoint;
        const allowedMisses = 2;
        const passed = finalScore >= totalQuestions - allowedMisses;
        setShowResults(true);
        if (passed) {
            try {
                const xp = Math.max(10, Math.round(finalScore / totalQuestions * 100));
                await fetch('/api/topics/progress', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topicId,
                        status: 'mastered',
                        masteryPercent: 100,
                        xpRewarded: xp
                    })
                });
                onPass();
            } catch (e) { console.error(e); }
        }
    };

    if (!currentQuestion) return null;
    const normalizedQuestion = normalizeContentSpacing(currentQuestion.content?.question);
    const questionBlocks = splitQuestionBlocks(normalizedQuestion);
    const hasQuestionBlocks = questionBlocks.some(block => block.type === 'question');

    if (showResults) {
        const passed = score >= exercises.length - 2;
        return (
            <div className="p-8 rounded-2xl bg-gray-900 border border-gray-800 text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${passed ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                    {passed ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{passed ? 'Quiz Passed!' : 'Try Again'}</h3>
                <p className="text-gray-400 mb-6">You scored {score} out of {exercises.length}</p>
                {passed ? <p className="text-green-400 font-medium animate-pulse">Next topic unlocked!</p> : <button onClick={() => { setCurrentIndex(0); setScore(0); setShowResults(false); setSelectedOption(null); setIsRevealed(false); }} className="px-6 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors">Retry Quiz</button>}
            </div>
        );
    }

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-3xl w-full mx-auto">
            <div className="flex justify-between items-center mb-6">
                <span className="text-sm font-medium text-gray-500">Question {currentIndex + 1} / {exercises.length}</span>
                <span className="text-sm font-medium text-blue-400">{currentQuestion.points || 10} XP</span>
            </div>
            {hasQuestionBlocks ? (
                <div className="mb-6 quiz-question">
                    {questionBlocks.map((block, idx) => (
                        block.type === 'question' ? (
                            <div key={`quiz-question-${idx}`} className="mx-auto max-w-2xl text-center text-xl font-bold text-white">
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                    components={questionMarkdownComponents}
                                >
                                    {block.content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <div key={`quiz-context-${idx}`} className="text-gray-200 text-base text-left mb-4">
                                <ReactMarkdown
                                    remarkPlugins={[remarkMath]}
                                    rehypePlugins={[rehypeKatex]}
                                    components={questionMarkdownComponents}
                                >
                                    {block.content}
                                </ReactMarkdown>
                            </div>
                        )
                    ))}
                </div>
            ) : (
                <div className="text-xl font-bold text-white mb-6 text-center quiz-question">
                    <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={questionMarkdownComponents}
                    >
                        {normalizedQuestion || 'Question content missing'}
                    </ReactMarkdown>
                </div>
            )}
            <div className="space-y-3 mb-8 max-w-2xl mx-auto">
                {currentQuestion.content?.options?.map((opt: string, i: number) => (
                    <button
                        key={i}
                        disabled={isRevealed}
                        onClick={() => setSelectedOption(i)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isRevealed ? (currentQuestion.content.correctAnswers?.includes(i) ? "bg-green-500/10 border-green-500 text-green-100" : (selectedOption === i ? "bg-red-500/10 border-red-500 text-red-100" : "border-gray-800 opacity-50")) : (selectedOption === i ? "bg-blue-600 border-blue-600 text-white" : "border-gray-800 hover:bg-gray-800")}`}
                    >
                        <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={optionMarkdownComponents}
                        >
                            {normalizeContentSpacing(opt)}
                        </ReactMarkdown>
                    </button>
                ))}
            </div>
            <div className="flex justify-between items-center">
                {!isRevealed ? (
                    <button onClick={handleCheck} disabled={selectedOption === null} className="px-8 py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 disabled:opacity-50 transition-colors">Check Answer</button>
                ) : (
                    <div className="flex items-center justify-between w-full gap-4">
                        <div className="text-sm text-gray-400 flex-1">
                            {selectedOption !== null && currentQuestion.content?.correctAnswers?.includes(selectedOption) ? (
                                <span className="text-green-400">Correct!</span>
                            ) : (
                                <div>
                                    <span className="text-red-400">Incorrect.</span>{' '}
                                    {currentQuestion.content?.explanation && (
                                        <span className="inline">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkMath]}
                                                rehypePlugins={[rehypeKatex]}
                                                components={inlineMarkdownComponents}
                                            >
                                                {currentQuestion.content.explanation}
                                            </ReactMarkdown>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <button onClick={handleNext} className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors flex-shrink-0">{isLast ? 'Finish' : 'Next Question'}</button>
                    </div>
                )}
            </div>
        </div>
    );
}

function FlashcardRunner({ flashcards }: { flashcards: FlashcardExercise[] }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const currentCard = flashcards[currentIndex];
    const isLast = currentIndex === flashcards.length - 1;
    const handleNext = () => { setIsFlipped(false); if (!isLast) setCurrentIndex(i => i + 1); else setCurrentIndex(0); };
    const handleFlip = () => setIsFlipped(!isFlipped);

    if (!currentCard) return null;

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-2xl w-full mx-auto relative perspective-1000">
            <div className="flex justify-between items-center mb-6">
                <span className="text-sm font-medium text-gray-500">Card {currentIndex + 1} / {flashcards.length}</span>
                <span className="text-xs text-gray-600">Click to flip</span>
            </div>
            <div onClick={handleFlip} className="cursor-pointer min-h-[200px] flex items-center justify-center p-6 bg-black/50 rounded-xl border border-gray-700 hover:border-gray-500 transition-all">
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-4 uppercase tracking-wider font-semibold">{isFlipped ? 'Answer' : 'Question'}</p>
                    <div className="text-xl md:text-2xl font-medium text-white flashcard-content">
                        <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={inlineMarkdownComponents}
                        >
                            {isFlipped ? (currentCard.content?.back || 'Answer missing') : (currentCard.content?.front || 'Card content missing')}
                        </ReactMarkdown>
                    </div>
                </div>
            </div>
            <div className="flex justify-center mt-6 gap-4">
                <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white disabled:opacity-50 transition-colors">Prev</button>
                <button onClick={handleNext} className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">{isLast ? 'Restart' : 'Next'}</button>
            </div>
        </div>
    );
}

function HomeworkSection({
    assignments,
    onSelectHomework,
    onGenerateHomework,
    isGenerating,
    hasContent
}: {
    assignments: HomeworkAssignment[];
    onSelectHomework: (hw: HomeworkAssignment) => void;
    onGenerateHomework?: () => void;
    isGenerating?: boolean;
    hasContent?: boolean;
}) {
    const now = new Date();
    const pendingAssignments = assignments.filter(a => !a.isCompleted);
    const completedAssignments = assignments.filter(a => a.isCompleted);
    const lateAssignments = pendingAssignments.filter(a => a.isLate);

    const formatDueDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const isToday = date.toDateString() === now.toDateString();
        const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();

        if (isToday) return 'Today';
        if (isTomorrow) return 'Tomorrow';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'exercise': return '📝';
            case 'problem': return '💻';
            case 'reading': return '📖';
            default: return '📚';
        }
    };

    if (assignments.length === 0) {
        return (
            <div className="text-center py-20 bg-gray-900/20 rounded-2xl border border-gray-800">
                <ClipboardList className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium mb-2">No homework assigned yet</p>
                <p className="text-gray-600 text-sm mb-6">
                    {hasContent
                        ? "Get homework to test your understanding of this topic"
                        : "Generate lesson content first, then you can get homework"}
                </p>
                {hasContent && onGenerateHomework && (
                    <button
                        onClick={() => onGenerateHomework()}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-500 transition-colors disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ClipboardList className="w-5 h-5" />}
                        Get Homework Assignment
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Late Assignments Warning */}
            {lateAssignments.length > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-red-300">
                                You have {lateAssignments.length} late assignment{lateAssignments.length > 1 ? 's' : ''}
                            </p>
                            <p className="text-sm text-red-400/70 mt-1">
                                Submit them soon to minimize XP penalties (5% per day late, max 50%)
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Pending Assignments */}
            {pendingAssignments.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-400" />
                        Pending Assignments
                    </h3>
                    {pendingAssignments.map((assignment) => (
                        <motion.div
                            key={assignment.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-5 rounded-xl border transition-all ${assignment.isLate
                                ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/50'
                                : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4 flex-1">
                                    <span className="text-2xl mt-1">{getTypeIcon(assignment.type)}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-semibold text-white">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkMath]}
                                                    rehypePlugins={[rehypeKatex]}
                                                    components={{
                                                        p: ({ children }) => <span>{children}</span>,
                                                    }}
                                                >
                                                    {assignment.title}
                                                </ReactMarkdown>
                                            </h4>
                                            {assignment.isLate && assignment.latePenalty && (
                                                <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                                                    -{assignment.latePenalty}% penalty
                                                </span>
                                            )}
                                        </div>
                                        {assignment.description && (
                                            <div className="text-sm text-gray-400 mt-2 homework-description prose prose-invert prose-sm max-w-none">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkMath]}
                                                    rehypePlugins={[rehypeRaw, rehypeKatex]}
                                                    components={{
                                                        p: ({ children }) => <p className="leading-relaxed mb-2">{children}</p>,
                                                        ul: ({ children }) => <ul className="list-disc list-inside space-y-1">{children}</ul>,
                                                        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1">{children}</ol>,
                                                        li: ({ children }) => <li>{children}</li>,
                                                    }}
                                                >
                                                    {assignment.description}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" />
                                                {assignment.estimatedMins} min
                                            </span>
                                            <span className={`flex items-center gap-1 ${assignment.isLate ? 'text-red-400' : ''}`}>
                                                {assignment.isLate ? 'Overdue' : `Due ${formatDueDate(assignment.dueDate)}`}
                                            </span>
                                            {assignment.xpReward && (
                                                <span className="text-blue-400">
                                                    {assignment.isLate && assignment.latePenalty
                                                        ? Math.floor(assignment.xpReward * (1 - (assignment.latePenalty || 0) / 100))
                                                        : assignment.xpReward
                                                    } XP
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onSelectHomework(assignment)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex-shrink-0"
                                >
                                    <Upload className="w-4 h-4" />
                                    Submit
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Completed Assignments */}
            {completedAssignments.length > 0 && (
                <div className="space-y-3 mt-8">
                    <h3 className="text-lg font-semibold text-gray-400 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        Completed ({completedAssignments.length})
                    </h3>
                    {completedAssignments.map((assignment) => (
                        <div
                            key={assignment.id}
                            className="p-4 rounded-xl bg-gray-900/30 border border-gray-800/50"
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-xl opacity-50">{getTypeIcon(assignment.type)}</span>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-400 line-through">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkMath]}
                                            rehypePlugins={[rehypeKatex]}
                                            components={{
                                                p: ({ children }) => <span>{children}</span>,
                                            }}
                                        >
                                            {assignment.title}
                                        </ReactMarkdown>
                                    </h4>
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
