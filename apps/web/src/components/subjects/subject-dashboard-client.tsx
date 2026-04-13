'use client';


import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    BookOpen,
    Clock,
    Users,
    ChevronRight,
    ChevronDown,
    CheckCircle2,
    Play,
    Target,
    TrendingUp,
    Zap,
    Flame,
    ArrowLeft,
    LogOut,
    Loader2,
    Bot,
    ClipboardList,
    Award,
    Sparkles,
    BarChart3,
    Trash2
} from 'lucide-react';

interface Topic {
    id: string;
    slug: string;
    name: string;
    exerciseCount: number;
    children: Topic[];
    isUnlocked: boolean;
    progress: {
        status: string;
        masteryPercent: number;
    };
    homework: {
        isCompleted: boolean;
        dueDate?: Date;
    } | null;
}

interface SubjectDashboardClientProps {
    subject: {
        id: string;
        slug: string;
        name: string;
        description?: string | null;
        icon?: string | null;
        color?: string | null;
        estimatedHours?: number | null;
        topicCount: number;
        totalExercises: number;
        enrollmentCount: number;
        difficultyLevel?: string | null;
        exerciseTypes: string[];
    };
    enrollment: {
        enrolledAt?: string;
        lastAccessedAt?: string;
        status?: string;
        progressPercent: number;
        exercisesCompleted: number;
        xpEarned: number;
        streak: number;
        totalTimeSpent?: number;
        goalHoursPerWeek?: number | null;
        targetDeadline?: string | null;
    } | null;
    topics: Topic[];
    recentExercises: {
        id: string;
        exerciseTitle: string;
        exerciseType: string;
        isCorrect: boolean;
        createdAt: Date;
    }[];
    isLoggedIn: boolean;
    userId?: string | null;
    userStats?: {
        streak: number;
        xp: number;
        level: number;
    };
    displayName?: string;
    displayInitial?: string;
    learningContract?: unknown;
    flashcards?: { id: string; content: { front?: string; back?: string } | null; topic: { name: string } | null }[];
}

export function SubjectDashboardClient({
    subject,
    enrollment,
    topics,
    recentExercises,
    isLoggedIn,
    flashcards = [],
}: SubjectDashboardClientProps) {
    const router = useRouter();
    const [isEnrolling, setIsEnrolling] = useState(false);
    const [viewMode, setViewMode] = useState<'topics' | 'flashcards'>('topics');
    const [lockMessage, setLockMessage] = useState<string | null>(null);
    const color = subject.color || '#3b82f6';

    // ... handlers ... (keep existing)
    const handleEnroll = () => {
        if (!isLoggedIn) {
            router.push('/login');
            return;
        }
        setIsEnrolling(true);
        router.push(`/subjects/${subject.slug}/setup`);
    };

    const [isUnenrolling, setIsUnenrolling] = useState(false);
    const [showUnenrollModal, setShowUnenrollModal] = useState(false);
    
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const handleUnenrollClick = () => {
        setShowUnenrollModal(true);
    };

    const handleUnenrollConfirm = async () => {
        setIsUnenrolling(true);
        try {
            const res = await fetch(`/api/subjects/enroll?subjectId=${subject.id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                router.push('/subjects');
                router.refresh();
            }
        } catch (error) {
            console.error('Failed to unenroll:', error);
        } finally {
            setIsUnenrolling(false);
            setShowUnenrollModal(false);
        }
    };

    const handleDeleteConfirm = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch('/api/subjects/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subjectId: subject.id }),
            });

            if (res.ok) {
                router.push('/subjects');
                router.refresh();
            } else {
                alert('Failed to delete subject');
            }
        } catch (error) {
            console.error('Failed to delete:', error);
            alert('An error occurred while deleting the subject');
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    // Calculate stats
    // placeholder (no current usage)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const overallMastery = 0;

    // Unenroll Confirmation Modal
    const UnenrollModal = () => (
        <AnimatePresence>
            {showUnenrollModal && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setShowUnenrollModal(false)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl"
                    >
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                                <LogOut className="w-6 h-6 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-white">Leave Subject?</h3>
                                <p className="text-gray-500 text-sm">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-400 mb-8">
                            Are you sure you want to leave <span className="text-white font-medium">{subject.name}</span>?
                            All your progress, XP earned, and completed exercises will be permanently deleted.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowUnenrollModal(false)}
                                className="flex-1 px-6 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUnenrollConfirm}
                                disabled={isUnenrolling}
                                className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isUnenrolling ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Leaving...
                                    </>
                                ) : (
                                    'Leave Subject'
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    // Delete Confirmation Modal
    const DeleteModal = () => (
        <AnimatePresence>
            {showDeleteModal && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => setShowDeleteModal(false)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl"
                    >
                        <div className="flex flex-col items-center text-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                <Trash2 className="w-8 h-8 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white">Delete Forever?</h3>
                                <p className="text-gray-400 mt-2">
                                    Are you absolutely sure? This will delete <span className="text-white font-semibold">{subject.name}</span> and all its content permanently for everyone.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 px-6 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={isDeleting}
                                className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete Forever'
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            <UnenrollModal />
            <DeleteModal />
            <div className="space-y-8">
                {lockMessage && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-100 px-4 py-3 flex items-center justify-between">
                        <span className="text-sm">{lockMessage}</span>
                        <button
                            onClick={() => setLockMessage(null)}
                            className="text-xs underline hover:text-white transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                )}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col gap-10"
                >
                    {/* Back Link */}
                    <Link
                        href="/subjects"
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>All Subjects</span>
                    </Link>

                    {/* Subject Header */}
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                        <div className="flex items-start gap-6">
                            {/* Icon */}
                            <div
                                className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${color}20` }}
                            >
                                {subject.icon ? (
                                    <span className="text-4xl">{subject.icon}</span>
                                ) : (
                                    <BookOpen className="w-10 h-10" style={{ color }} />
                                )}
                            </div>

                            <div>
                                <h1 className="text-4xl font-bold text-foreground mb-3">
                                    {subject.name}
                                </h1>
                                {subject.description && (
                                    <p className="text-lg text-muted-foreground max-w-2xl mb-4">
                                        {subject.description}
                                    </p>
                                )}

                                {/* Meta Info */}
                                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                                    {subject.estimatedHours && (
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            <span>{subject.estimatedHours} hours</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-4 h-4" />
                                        <span>{subject.topicCount} topics</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Target className="w-4 h-4" />
                                        <span>{subject.totalExercises} exercises</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        <span>{subject.enrollmentCount.toLocaleString()} learners</span>
                                    </div>
                                    {subject.difficultyLevel && (
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${subject.difficultyLevel === 'beginner'
                                            ? 'bg-green-500/15 text-green-500'
                                            : subject.difficultyLevel === 'intermediate'
                                                ? 'bg-yellow-500/15 text-yellow-500'
                                                : 'bg-red-500/15 text-red-500'
                                            }`}>
                                            {subject.difficultyLevel.charAt(0).toUpperCase() + subject.difficultyLevel.slice(1)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Enroll/Continue Button */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            {enrollment ? (
                                <>
                                    <button
                                        className="flex items-center gap-3 px-8 py-4 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20"
                                        style={{ backgroundColor: color, color: '#000' }}
                                    >
                                        <Play className="w-5 h-5" />
                                        Continue Learning
                                    </button>
                                    {/* Action Buttons */}
                                    <Link
                                        href={`/subjects/${subject.slug}/tutor`}
                                        className="flex items-center gap-2 px-4 py-4 rounded-xl bg-card border border-border text-muted-foreground hover:text-blue-400 hover:border-blue-500/50 transition-all"
                                        title="Ask AI Tutor"
                                    >
                                        <Bot className="w-5 h-5" />
                                    </Link>
                                    <Link
                                        href={`/subjects/${subject.slug}/assessment`}
                                        className="flex items-center gap-2 px-4 py-4 rounded-xl bg-card border border-border text-muted-foreground hover:text-yellow-400 hover:border-yellow-500/50 transition-all"
                                        title="Take Assessment"
                                    >
                                        <ClipboardList className="w-5 h-5" />
                                    </Link>
                                    {enrollment.progressPercent >= 90 && (
                                        <Link
                                            href={`/subjects/${subject.slug}/certificate`}
                                            className="flex items-center gap-2 px-4 py-4 rounded-xl bg-yellow-900/20 border border-yellow-700 text-yellow-500 hover:bg-yellow-900/40 hover:text-yellow-400 hover:border-yellow-500 transition-all"
                                            title="Claim Certificate"
                                        >
                                            <Award className="w-5 h-5" />
                                        </Link>
                                    )}
                                    <button
                                        onClick={handleUnenrollClick}
                                        disabled={isUnenrolling}
                                        className="flex items-center gap-2 px-4 py-4 rounded-xl bg-card border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/50 transition-all disabled:opacity-50"
                                        title="Leave this subject"
                                    >
                                        {isUnenrolling ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <LogOut className="w-5 h-5" />
                                        )}
                                    </button>
                                </>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleEnroll}
                                        disabled={isEnrolling}
                                        className="flex items-center gap-3 px-8 py-4 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-all disabled:opacity-50"
                                    >
                                        {isEnrolling ? (
                                            <span>Enrolling...</span>
                                        ) : (
                                            <>
                                                <Sparkles className="w-5 h-5" />
                                                Start Learning
                                            </>
                                        )}
                                    </button>
                                    
                                    {isLoggedIn && (
                                        <button
                                            onClick={() => setShowDeleteModal(true)}
                                            className="flex items-center gap-2 px-4 py-4 rounded-xl bg-card border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/50 transition-all"
                                            title="Delete Subject Permanently"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Progress Stats (only if enrolled) */}
                    {enrollment && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard
                                icon={BarChart3}
                                label="Progress"
                                value={`${Math.round(enrollment.progressPercent)}%`}
                                color={color}
                            />
                            <StatCard
                                icon={Target}
                                label="Exercises Done"
                                value={enrollment.exercisesCompleted.toString()}
                                color={color}
                            />
                            <StatCard
                                icon={Zap}
                                label="XP Earned"
                                value={enrollment.xpEarned.toLocaleString()}
                                color="#eab308"
                            />
                            <StatCard
                                icon={Flame}
                                label="Streak"
                                value={`${enrollment.streak} days`}
                                color="#f97316"
                            />
                        </div>
                    )}

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Topics / Flashcards Section */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="p-8 rounded-2xl bg-card border border-border min-h-[500px]">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                                        {viewMode === 'topics' ? <BookOpen className="w-6 h-6 text-muted-foreground" /> : <ClipboardList className="w-6 h-6 text-muted-foreground" />}
                                        {viewMode === 'topics' ? 'Topics' : 'Flashcards'}
                                    </h2>

                                    {/* View Toggle */}
                                    <div className="flex bg-secondary/50 p-1 rounded-lg self-start sm:self-auto">
                                        <button
                                            onClick={() => setViewMode('topics')}
                                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'topics'
                                                ? 'bg-card text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                        >
                                            Topics
                                        </button>
                                        <button
                                            onClick={() => setViewMode('flashcards')}
                                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'flashcards'
                                                ? 'bg-card text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                        >
                                            Flashcards
                                        </button>
                                    </div>
                                </div>

                                {viewMode === 'topics' ? (
                                    topics.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-40" />
                                            <p>No topics available yet</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {topics.map((topic, index) => (
                                                <TopicCard
                                                    key={topic.id}
                                                    topic={topic}
                                                    index={index}
                                                    isEnrolled={!!enrollment}
                                                    subjectSlug={subject.slug}
                                                    color={color}
                                                    onLockedClick={() => setLockMessage('Complete the previous topic (and its quiz/homework) to unlock this one.')}
                                                />
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    // Flashcards View
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {flashcards && flashcards.length > 0 ? (
                                            flashcards.map((card) => {
                                                const front = typeof card.content?.front === 'string' ? card.content.front : '';
                                                const back = typeof card.content?.back === 'string' ? card.content.back : '';
                                                return (
                                                    <div key={card.id} className="p-5 rounded-xl border border-border bg-card hover:bg-secondary/20 transition-colors flex flex-col gap-3 group relative overflow-hidden">
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                                                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                            {card.topic?.name || 'General'}
                                                        </div>
                                                        <div className="space-y-4">
                                                            <div>
                                                                <p className="text-xs text-muted-foreground mb-1">Front</p>
                                                                <p className="font-medium text-foreground">{front || '—'}</p>
                                                            </div>
                                                            <div className="pt-3 border-t border-border/50">
                                                                <p className="text-xs text-muted-foreground mb-1">Back</p>
                                                                <p className="text-sm text-foreground/90">{back || '—'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="col-span-full text-center py-12 text-muted-foreground">
                                                <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-40" />
                                                <p>No flashcards available yet.</p>
                                                <p className="text-sm mt-2">Complete topic generation to see them here.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sidebar - 1 column */}
                        <div className="space-y-6">


                            {/* Recent Activity */}
                            <div className="p-6 rounded-2xl bg-card border border-border">
                                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-muted-foreground" />
                                    Recent Activity
                                </h3>

                                {recentExercises.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Target className="w-10 h-10 mx-auto mb-3 opacity-40" />
                                        <p className="text-sm">No activity yet</p>
                                        {enrollment && (
                                            <p className="text-xs mt-1">Start practicing to see your history</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {recentExercises.map(exercise => (
                                            <div
                                                key={exercise.id}
                                                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                                            >
                                                <div className={`w-2.5 h-2.5 rounded-full ${exercise.isCorrect ? 'bg-green-500' : 'bg-red-500'
                                                    }`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-foreground truncate">{exercise.exerciseTitle}</p>
                                                    <p className="text-xs text-muted-foreground">{exercise.exerciseType}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Exercise Types */}
                            <div className="p-6 rounded-2xl bg-card border border-border">
                                <h3 className="text-lg font-semibold text-foreground mb-4">Exercise Types</h3>
                                <div className="flex flex-wrap gap-2">
                                    {subject.exerciseTypes.map(type => (
                                        <span
                                            key={type}
                                            className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-sm capitalize"
                                        >
                                            {type.replace('_', ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </>
    );
}

function StatCard({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    color: string;
}) {
    return (
        <div className="p-6 rounded-2xl bg-card border border-border">
            <div className="flex items-center justify-between mb-4">
                <Icon className="w-6 h-6" style={{ color }} />
                <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-foreground mb-1">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
        </div>
    );
}

function TopicCard({
    topic,
    index,
    isEnrolled,
    subjectSlug,
    color,
    onLockedClick,
}: {
    topic: Topic;
    index: number;
    isEnrolled: boolean;
    subjectSlug: string;
    color: string;
    onLockedClick?: () => void;
}) {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    const hasChildren = topic.children.length > 0;
    const isLocked = !isEnrolled || !topic.isUnlocked;
    const masteryPercent = topic.progress.masteryPercent;
    const hasHomework = topic.homework !== null;
    const homeworkCompleted = topic.homework?.isCompleted ?? false;

    const handleTopicClick = () => {
        if (isLocked) {
            onLockedClick?.();
            return;
        }
        if (hasChildren) {
            setIsExpanded(!isExpanded);
        } else {
            router.push(`/subjects/${subjectSlug}/topics/${topic.slug}`);
        }
    };

    return (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
            <div
                className={`flex items-center gap-4 p-4 ${!isLocked ? 'cursor-pointer hover:bg-secondary/50' : ''
                    } transition-colors`}
                onClick={handleTopicClick}
            >
                {/* Order Number */}
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                        backgroundColor: isLocked ? 'hsl(var(--secondary))' : `${color}20`,
                        color: isLocked ? 'hsl(var(--muted-foreground))' : color,
                    }}
                >
                    {isLocked ? <div className="w-4 h-4"><Users className="w-4 h-4" /></div> : index + 1} {/* Fix Lock icon usage if I removed it from imports? No, I kept imports */}
                </div>

                {/* Topic Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className={`font-medium ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {topic.name}
                        </h3>
                        {topic.progress.status === 'mastered' && (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>{topic.exerciseCount} exercises</span>
                        {isEnrolled && masteryPercent > 0 && (
                            <span style={{ color }}>{masteryPercent}% mastery</span>
                        )}
                        {isEnrolled && hasHomework && (
                            <span className={`flex items-center gap-1 ${homeworkCompleted ? 'text-green-500' : 'text-amber-500'}`}>
                                <ClipboardList className="w-3 h-3" />
                                {homeworkCompleted ? 'Homework done' : 'Homework required'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                {isEnrolled && (
                    <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden flex-shrink-0">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${masteryPercent}%`,
                                backgroundColor: color,
                            }}
                        />
                    </div>
                )}

                {/* Expand/Action Button */}
                {hasChildren ? (
                    <ChevronDown
                        className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''
                            }`}
                    />
                ) : (
                    !isLocked && (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )
                )}
            </div>

            {/* Children */}
            <AnimatePresence>
                {isExpanded && hasChildren && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-border bg-secondary/20"
                    >
                        <div className="p-4 pl-16 space-y-2">
                            {topic.children.map((child, childIndex) => {
                                const isChildLocked = !child.isUnlocked;

                                return isChildLocked ? (
                                    <div
                                        key={child.id}
                                        className="flex items-center gap-3 py-2 px-3 rounded-lg opacity-50 cursor-not-allowed"
                                    >
                                        <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-medium bg-secondary text-muted-foreground">
                                            {index + 1}.{childIndex + 1}
                                        </div>
                                        <span className="text-muted-foreground">
                                            {child.name}
                                        </span>
                                        <div className="ml-auto w-3 h-3 text-muted-foreground"><Users className="w-3 h-3" /></div>
                                    </div>
                                ) : (
                                    <Link
                                        key={child.id}
                                        href={`/subjects/${subjectSlug}/topics/${child.slug}`}
                                        className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group"
                                    >
                                        <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-medium bg-secondary text-muted-foreground group-hover:text-foreground transition-colors">
                                            {index + 1}.{childIndex + 1}
                                        </div>
                                        <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                                            {child.name}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground ml-auto transition-colors opacity-0 group-hover:opacity-100" />
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
