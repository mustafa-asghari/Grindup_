'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Code2,
    Flame,
    Zap,
    Search,
    Filter,
    BookOpen,
    GraduationCap,
    Clock,
    Users,
    ChevronRight,
    CheckCircle2,
    Sparkles,
    LogIn,
    Beaker,
    Scale,
    Palette,
    Languages,
    Cpu,
    Heart,
    X,
    Plus,
    Wand2,
    Loader2,
    Trash2,
    AlertTriangle,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';

interface Subject {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    category: string;
    estimatedHours: number | null;
    difficultyLevel: string | null;
    enrollmentCount: number;
    exerciseCount: number;
    topicCount: number;
    isEnrolled: boolean;
}

interface Category {
    value: string;
    label: string;
    description: string;
}

interface SubjectsLibraryClientProps {
    subjects: Subject[];
    categories: Category[];
    isLoggedIn: boolean;
    userStats?: {
        streak: number;
        xp: number;
        level: number;
    };
    displayName?: string;
    displayInitial?: string;
}

const categoryIcons: Record<string, React.ElementType> = {
    stem: Beaker,
    technology: Cpu,
    professional: Scale,
    humanities: BookOpen,
    languages: Languages,
    creative: Palette,
    lifestyle: Heart,
};

const categoryColors: Record<string, string> = {
    stem: '#22c55e',
    technology: '#3b82f6',
    professional: '#8b5cf6',
    humanities: '#f59e0b',
    languages: '#ec4899',
    creative: '#f43f5e',
    lifestyle: '#14b8a6',
};

export function SubjectsLibraryClient({
    subjects,
    categories,
    isLoggedIn,
    userStats,
    displayName,
    displayInitial,
}: SubjectsLibraryClientProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [showEnrolledOnly, setShowEnrolledOnly] = useState(false);

    // Create subject modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai');
    const [newSubjectName, setNewSubjectName] = useState('');
    const [newSubjectDescription, setNewSubjectDescription] = useState('');
    const [manualTopics, setManualTopics] = useState<Array<{ name: string; description: string; estimatedMins: number }>>([]);
    const [newTopicName, setNewTopicName] = useState('');
    const [newTopicDescription, setNewTopicDescription] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Delete subject state
    const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const addManualTopic = () => {
        if (!newTopicName.trim()) return;
        setManualTopics([
            ...manualTopics,
            {
                name: newTopicName.trim(),
                description: newTopicDescription.trim(),
                estimatedMins: 60
            }
        ]);
        setNewTopicName('');
        setNewTopicDescription('');
    };

    const removeManualTopic = (index: number) => {
        setManualTopics(manualTopics.filter((_, i) => i !== index));
    };

    // Create subject handler
    const handleCreateSubject = async () => {
        if (!newSubjectName.trim()) {
            setCreateError('Please enter a subject name');
            return;
        }

        if (creationMode === 'manual' && manualTopics.length === 0) {
            setCreateError('Please add at least one topic for manual mode');
            return;
        }

        setIsCreating(true);
        setCreateError(null);

        try {
            const res = await fetch('/api/subjects/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newSubjectName.trim(),
                    description: newSubjectDescription.trim() || undefined,
                    topics: creationMode === 'manual' ? manualTopics : undefined,
                }),
            });

            const text = await res.text();
            let data: any = {};
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch { }
            }

            if (!res.ok) {
                if (data.existingSlug) {
                    // Subject exists, redirect to it
                    setShowCreateModal(false);
                    router.push(`/subjects/${data.existingSlug}`);
                    router.refresh();
                    return;
                }
                throw new Error(data.error || 'Failed to create subject');
            }

            // Success - close modal, refresh data, then redirect to new subject
            setShowCreateModal(false);
            setNewSubjectName('');
            setNewSubjectDescription('');
            setManualTopics([]);
            router.refresh();
            router.push(`/subjects/${data.subject.slug}`);
        } catch (e: any) {
            setCreateError(e.message || 'Something went wrong');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteSubject = async () => {
        if (!subjectToDelete) return;

        setIsDeleting(true);
        try {
            const res = await fetch('/api/subjects/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subjectId: subjectToDelete.id }),
            });

            if (!res.ok) {
                throw new Error('Failed to delete subject');
            }

            setSubjectToDelete(null);
            router.refresh();
        } catch (error) {
            console.error('Delete failed', error);
            alert('Failed to delete subject. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Derived data for filters and stats
    const enrolledCount = subjects.filter(subject => subject.isEnrolled).length;
    const filteredSubjects = subjects.filter(subject => {
        if (selectedCategory && subject.category !== selectedCategory) return false;
        if (showEnrolledOnly && !subject.isEnrolled) return false;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const haystack = `${subject.name} ${subject.description || ''}`.toLowerCase();
            return haystack.includes(query);
        }

        return true;
    });
    const groupedSubjects = filteredSubjects.reduce<Record<string, Subject[]>>((acc, subject) => {
        if (!acc[subject.category]) {
            acc[subject.category] = [];
        }
        acc[subject.category].push(subject);
        return acc;
    }, {});

    return (
        <div className="flex flex-col gap-10">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <BookOpen className="w-8 h-8 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Subject Library
                        </span>
                    </div>
                    <h1 className="text-4xl font-bold text-foreground mb-3">
                        Explore All Subjects
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl">
                        Choose from a wide range of subjects. Each subject has its own learning path,
                        exercises, and progress tracking.
                    </p>
                </div>

                {isLoggedIn && enrolledCount > 0 && (
                    <div className="flex items-center gap-4 px-5 py-3 rounded-xl bg-card border border-border">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-muted-foreground">
                            <span className="font-bold text-foreground">{enrolledCount}</span> subject{enrolledCount !== 1 ? 's' : ''} enrolled
                        </span>
                    </div>
                )}
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search subjects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedCategory === null
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                            }`}
                    >
                        All
                    </button>
                    {categories.map(category => {
                        const Icon = categoryIcons[category.value] || BookOpen;
                        return (
                            <button
                                key={category.value}
                                onClick={() => setSelectedCategory(
                                    selectedCategory === category.value ? null : category.value
                                )}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${selectedCategory === category.value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {category.label}
                            </button>
                        );
                    })}
                </div>

                {/* Enrolled Only Toggle */}
                {isLoggedIn && (
                    <button
                        onClick={() => setShowEnrolledOnly(!showEnrolledOnly)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${showEnrolledOnly
                            ? 'bg-green-600 text-white'
                            : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                            }`}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        My Subjects
                    </button>
                )}
            </div>

            {/* Subjects Grid */}
            {Object.keys(groupedSubjects).length === 0 ? (
                <div className="text-center py-20">
                    <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-6" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">No subjects found</h3>
                    <p className="text-muted-foreground">
                        {searchQuery
                            ? 'Try adjusting your search or filters'
                            : 'Check back soon for new subjects'}
                    </p>
                </div>
            ) : (
                <div className="space-y-12">
                    {Object.entries(groupedSubjects).map(([categoryValue, categorySubjects]) => {
                        const category = categories.find(c => c.value === categoryValue);
                        const Icon = categoryIcons[categoryValue] || BookOpen;
                        const color = categoryColors[categoryValue] || '#ffffff';

                        return (
                            <motion.div
                                key={categoryValue}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                {/* Category Header */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{ backgroundColor: `${color}20` }}
                                    >
                                        <Icon className="w-5 h-5" style={{ color }} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-foreground">{category?.label}</h2>
                                        <p className="text-sm text-muted-foreground">{category?.description}</p>
                                    </div>
                                </div>

                                {/* Subject Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {categorySubjects.map(subject => (
                                        <SubjectCard 
                                            key={subject.id} 
                                            subject={subject} 
                                            isLoggedIn={isLoggedIn}
                                            onDelete={() => setSubjectToDelete(subject)}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Create Subject Button */}
            {isLoggedIn && (
                <div className="mt-8 text-center">
                    <p className="text-muted-foreground mb-4">Can&apos;t find what you&apos;re looking for?</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold transition-all shadow-lg shadow-purple-500/25"
                    >
                        <Wand2 className="w-5 h-5" />
                        Create New Subject with AI
                    </button>
                </div>
            )}

            {/* Create Subject Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                        {creationMode === 'ai' ? <Wand2 className="w-5 h-5 text-white" /> : <BookOpen className="w-5 h-5 text-white" />}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-foreground">Create New Subject</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {creationMode === 'ai' ? 'AI will generate topics & structure' : 'Design your own learning roadmap'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="p-2 hover:bg-secondary rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-muted-foreground" />
                                </button>
                            </div>

                            {/* Mode Toggle */}
                            <div className="flex bg-secondary/50 p-1 rounded-xl mb-6">
                                <button
                                    onClick={() => setCreationMode('ai')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                                        creationMode === 'ai' 
                                        ? 'bg-card text-foreground shadow-sm' 
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    AI Generated
                                </button>
                                <button
                                    onClick={() => setCreationMode('manual')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                                        creationMode === 'manual' 
                                        ? 'bg-card text-foreground shadow-sm' 
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Plus className="w-4 h-4" />
                                    Manual Creation
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                                        Subject Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={newSubjectName}
                                        onChange={(e) => setNewSubjectName(e.target.value)}
                                        placeholder="e.g., Calculus 2, Organic Chemistry, Contract Law..."
                                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                                        disabled={isCreating}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                                        Description (optional)
                                    </label>
                                    <textarea
                                        value={newSubjectDescription}
                                        onChange={(e) => setNewSubjectDescription(e.target.value)}
                                        placeholder="What should this subject cover? Any specific focus areas?"
                                        rows={2}
                                        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                                        disabled={isCreating}
                                    />
                                </div>

                                {creationMode === 'manual' && (
                                    <div className="pt-2 border-t border-border">
                                        <label className="block text-sm font-medium text-foreground mb-3">
                                            Subject Topics
                                        </label>
                                        
                                        {/* Added Topics List */}
                                        <div className="space-y-2 mb-4">
                                            {manualTopics.map((topic, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border group">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-foreground">{topic.name}</p>
                                                        {topic.description && <p className="text-xs text-muted-foreground line-clamp-1">{topic.description}</p>}
                                                    </div>
                                                    <button 
                                                        onClick={() => removeManualTopic(idx)}
                                                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-all"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            {manualTopics.length === 0 && (
                                                <div className="text-center py-6 rounded-xl border border-dashed border-border text-muted-foreground">
                                                    <p className="text-xs">No topics added yet. Add your first topic below.</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Add Topic Input */}
                                        <div className="p-4 rounded-xl bg-secondary/20 border border-border space-y-3">
                                            <input
                                                type="text"
                                                value={newTopicName}
                                                onChange={(e) => setNewTopicName(e.target.value)}
                                                placeholder="Topic name (e.g. Limits and Continuity)"
                                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                                            />
                                            <textarea
                                                value={newTopicDescription}
                                                onChange={(e) => setNewTopicDescription(e.target.value)}
                                                placeholder="Short description (optional)"
                                                rows={2}
                                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary resize-none"
                                            />
                                            <button
                                                onClick={addManualTopic}
                                                disabled={!newTopicName.trim()}
                                                className="w-full py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add Topic
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {createError && (
                                    <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg">
                                        {createError}
                                    </div>
                                )}

                                <div className="flex gap-4 pt-4 sticky bottom-0 bg-card">
                                    <button
                                        onClick={() => setShowCreateModal(false)}
                                        disabled={isCreating}
                                        className="flex-1 py-3 rounded-xl border border-border text-muted-foreground hover:bg-secondary transition-colors font-medium disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateSubject}
                                        disabled={isCreating || !newSubjectName.trim()}
                                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isCreating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                {creationMode === 'ai' ? <Sparkles className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                                Create Subject
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {subjectToDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
                        >
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground">Delete Subject?</h3>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Are you sure you want to delete <span className="font-semibold text-foreground">{subjectToDelete.name}</span>? This action cannot be undone and will remove it for everyone.
                                    </p>
                                </div>
                                <div className="flex gap-3 w-full mt-4">
                                    <button
                                        onClick={() => setSubjectToDelete(null)}
                                        disabled={isDeleting}
                                        className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-secondary transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDeleteSubject}
                                        disabled={isDeleting}
                                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors font-medium flex items-center justify-center gap-2"
                                    >
                                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        Delete Forever
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function SubjectCard({ subject, isLoggedIn, onDelete }: { subject: Subject; isLoggedIn: boolean; onDelete?: () => void }) {
    const [isHovered, setIsHovered] = useState(false);
    const color = subject.color || categoryColors[subject.category] || '#ffffff';

    return (
        <div className="relative group h-full">
            <Link href={`/subjects/${subject.slug}`} className="block h-full">
                <motion.div
                    whileHover={{ scale: 1.02, y: -4 }}
                    onHoverStart={() => setIsHovered(true)}
                    onHoverEnd={() => setIsHovered(false)}
                    className="relative p-6 rounded-2xl bg-card border border-border cursor-pointer hover:border-primary/50 transition-all h-full flex flex-col"
                >
                    {/* Enrolled Badge */}
                    {subject.isEnrolled && (
                        <div className="absolute top-4 right-4">
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                            </div>
                        </div>
                    )}

                    {/* Icon */}
                    <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                        style={{ backgroundColor: `${color}20` }}
                    >
                        {subject.icon ? (
                            <span className="text-2xl">{subject.icon}</span>
                        ) : (
                            <BookOpen className="w-7 h-7" style={{ color }} />
                        )}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-foreground mb-2 pr-8">
                        {subject.name}
                    </h3>

                    {/* Description */}
                    {subject.description && (
                        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">
                            {subject.description}
                        </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto">
                        {subject.estimatedHours && (
                            <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{subject.estimatedHours}h</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{subject.topicCount} topics</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            <span>{subject.enrollmentCount.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Difficulty Badge */}
                    {subject.difficultyLevel && (
                        <div className="mt-4">
                            <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${subject.difficultyLevel === 'beginner'
                                ? 'bg-green-500/15 text-green-500'
                                : subject.difficultyLevel === 'intermediate'
                                    ? 'bg-yellow-500/15 text-yellow-500'
                                    : 'bg-red-500/15 text-red-500'
                                }`}>
                                {subject.difficultyLevel.charAt(0).toUpperCase() + subject.difficultyLevel.slice(1)}
                            </span>
                        </div>
                    )}

                    {/* Hover Arrow */}
                    <AnimatePresence>
                        {isHovered && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="absolute bottom-6 right-6"
                            >
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </Link>

            {/* Delete Button - Visible on hover for all logged-in users */}
            {isLoggedIn && onDelete && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete();
                    }}
                    className={`absolute top-4 right-14 p-2 rounded-full transition-all z-10 ${
                        subject.isEnrolled 
                        ? 'bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white' 
                        : 'bg-card border border-border text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white hover:border-red-500'
                    }`}
                    title="Delete Subject Permanently"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
