'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Youtube, FileText, Loader2, CheckCircle2, Sparkles, BookOpen, Brain } from 'lucide-react';

// Loading messages that cycle during import
const LOADING_MESSAGES = [
    { icon: Upload, text: "Uploading your content...", subtext: "Preparing files for analysis" },
    { icon: FileText, text: "Extracting text...", subtext: "Reading document contents" },
    { icon: Brain, text: "AI is analyzing...", subtext: "Understanding the material" },
    { icon: Sparkles, text: "Generating curriculum...", subtext: "Creating your personalized learning path" },
    { icon: BookOpen, text: "Building your subject...", subtext: "Almost ready!" },
];

export default function ImportPage() {
    const router = useRouter();
    const [subjectName, setSubjectName] = useState('');
    const [sourceType, setSourceType] = useState<'youtube' | 'notes' | 'file'>('youtube');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [notesText, setNotesText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingStep, setLoadingStep] = useState(0);
    const [conflictData, setConflictData] = useState<any>(null);
    const [newSubjectName, setNewSubjectName] = useState('');
    const [showRenameInput, setShowRenameInput] = useState(false);

    // Cycle through loading messages
    useEffect(() => {
        if (!isSubmitting) {
            setLoadingStep(0);
            return;
        }

        const interval = setInterval(() => {
            setLoadingStep((prev) => (prev + 1) % LOADING_MESSAGES.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [isSubmitting]);

    const resetSources = (nextType: 'youtube' | 'notes' | 'file') => {
        setSourceType(nextType);
        setYoutubeUrl('');
        setNotesText('');
        setFile(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            const form = new FormData();
            form.append('sourceType', sourceType);
            if (subjectName) form.append('subjectName', subjectName);
            if (sourceType === 'youtube') form.append('youtubeUrl', youtubeUrl);
            if (sourceType === 'notes') form.append('notesText', notesText);
            if (sourceType === 'file' && file) form.append('file', file);

            const res = await fetch('/api/import', { method: 'POST', body: form });
            const data = await res.json();

            if (res.status === 409 && data.conflict) {
                // Show conflict modal
                setConflictData(data);
                setIsSubmitting(false);
                return;
            }

            if (!res.ok) {
                const errorMsg = data.details
                    ? `${data.error}: ${data.details}`
                    : (data.error || 'Failed to import');
                setError(errorMsg);
            } else {
                router.push(`/subjects/${data.slug}`);
            }
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const CurrentIcon = LOADING_MESSAGES[loadingStep].icon;

    return (
        <div className="min-h-screen bg-black text-white px-6 py-10">
            <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Import Source</h1>
                        <p className="text-gray-400 mt-2">Create a new subject from a YouTube video, PDF, or your notes.</p>
                    </div>
                    <Link href="/subjects" className="text-blue-400 hover:text-blue-300 text-sm">Back to Subjects</Link>
                </div>

                {/* Loading Overlay */}
                <AnimatePresence>
                    {isSubmitting && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-gray-900 border border-gray-800 rounded-3xl p-12 max-w-md w-full mx-4 text-center"
                            >
                                {/* Animated Icon */}
                                <motion.div
                                    key={loadingStep}
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-6"
                                >
                                    <CurrentIcon className="w-10 h-10 text-white" />
                                </motion.div>

                                {/* Progress Ring */}
                                <div className="relative w-16 h-16 mx-auto mb-6">
                                    <svg className="w-16 h-16 transform -rotate-90">
                                        <circle
                                            cx="32"
                                            cy="32"
                                            r="28"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                            className="text-gray-800"
                                        />
                                        <motion.circle
                                            cx="32"
                                            cy="32"
                                            r="28"
                                            stroke="url(#gradient)"
                                            strokeWidth="4"
                                            fill="none"
                                            strokeLinecap="round"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: (loadingStep + 1) / LOADING_MESSAGES.length }}
                                            transition={{ duration: 0.5 }}
                                            style={{ strokeDasharray: "1", strokeDashoffset: "0" }}
                                        />
                                        <defs>
                                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#3B82F6" />
                                                <stop offset="100%" stopColor="#8B5CF6" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                    </div>
                                </div>

                                {/* Loading Text */}
                                <motion.div
                                    key={`text-${loadingStep}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <h3 className="text-xl font-bold text-white mb-2">
                                        {LOADING_MESSAGES[loadingStep].text}
                                    </h3>
                                    <p className="text-gray-400 text-sm">
                                        {LOADING_MESSAGES[loadingStep].subtext}
                                    </p>
                                </motion.div>

                                {/* Progress Dots */}
                                <div className="flex justify-center gap-2 mt-8">
                                    {LOADING_MESSAGES.map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className={`w-2 h-2 rounded-full ${i <= loadingStep ? 'bg-blue-500' : 'bg-gray-700'}`}
                                            animate={{ scale: i === loadingStep ? 1.3 : 1 }}
                                        />
                                    ))}
                                </div>

                                {/* Time Estimate */}
                                <p className="text-gray-500 text-xs mt-6">
                                    This may take 30-60 seconds for large files
                                </p>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Conflict Modal */}
                <AnimatePresence>
                    {conflictData && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-gray-900 border border-yellow-700 rounded-2xl p-8 max-w-md w-full"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-yellow-900/20 flex items-center justify-center">
                                        <Sparkles className="w-6 h-6 text-yellow-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Subject Already Exists</h3>
                                        <p className="text-gray-400 text-sm">"{conflictData.existingSubject?.name}"</p>
                                    </div>
                                </div>

                                <p className="text-gray-300 mb-6">
                                    A subject with this name already exists. What would you like to do?
                                </p>

                                {showRenameInput ? (
                                    <>
                                        <div className="mb-4">
                                            <label className="block text-sm text-gray-400 mb-2">New Subject Name</label>
                                            <input
                                                type="text"
                                                value={newSubjectName}
                                                onChange={(e) => setNewSubjectName(e.target.value)}
                                                placeholder="e.g., Introduction to Physics - Part 2"
                                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder:text-gray-500 focus:border-indigo-500 outline-none"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <button
                                                onClick={async () => {
                                                    if (!newSubjectName.trim()) return;
                                                    setConflictData(null);
                                                    setShowRenameInput(false);
                                                    const form = new FormData();
                                                    form.append('sourceType', sourceType);
                                                    form.append('subjectName', newSubjectName.trim());
                                                    if (sourceType === 'youtube') form.append('youtubeUrl', youtubeUrl);
                                                    if (sourceType === 'notes') form.append('notesText', notesText);
                                                    if (sourceType === 'file' && file) form.append('file', file);

                                                    setIsSubmitting(true);
                                                    try {
                                                        const res = await fetch('/api/import', { method: 'POST', body: form });
                                                        const data = await res.json();
                                                        if (res.ok) {
                                                            router.push(`/subjects/${data.slug}`);
                                                        } else {
                                                            const errorMsg = data.details
                                                                ? `${data.error}: ${data.details}`
                                                                : (data.error || 'Failed to import');
                                                            setError(errorMsg);
                                                            setIsSubmitting(false);
                                                        }
                                                    } catch (err) {
                                                        console.error('Import error:', err);
                                                        setError('Something went wrong. Please try again.');
                                                        setIsSubmitting(false);
                                                    }
                                                }}
                                                disabled={!newSubjectName.trim()}
                                                className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Create with New Name
                                            </button>
                                            <button
                                                onClick={() => { setShowRenameInput(false); setNewSubjectName(''); }}
                                                className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
                                            >
                                                Back
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => router.push(`/subjects/${conflictData.existingSubject?.slug}`)}
                                            className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
                                        >
                                            Open Existing Subject
                                        </button>

                                        <button
                                            onClick={async () => {
                                                setConflictData(null);
                                                const form = new FormData();
                                                form.append('sourceType', sourceType);
                                                if (subjectName) form.append('subjectName', subjectName);
                                                if (sourceType === 'youtube') form.append('youtubeUrl', youtubeUrl);
                                                if (sourceType === 'notes') form.append('notesText', notesText);
                                                if (sourceType === 'file' && file) form.append('file', file);
                                                form.append('replace', 'true');

                                                setIsSubmitting(true);
                                                try {
                                                    const res = await fetch('/api/import', { method: 'POST', body: form });
                                                    const data = await res.json();
                                                    if (res.ok) {
                                                        router.push(`/subjects/${data.slug}`);
                                                    } else {
                                                        setError(data.error || 'Failed to replace');
                                                        setIsSubmitting(false);
                                                    }
                                                } catch (err) {
                                                    setError('Something went wrong');
                                                    setIsSubmitting(false);
                                                }
                                            }}
                                            className="w-full px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-medium transition-colors"
                                        >
                                            Replace with New Content
                                        </button>

                                        <button
                                            onClick={() => {
                                                setShowRenameInput(true);
                                                setNewSubjectName(subjectName + ' - Part 2');
                                            }}
                                            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                                        >
                                            Rename and Keep Both
                                        </button>

                                        <button
                                            onClick={() => setConflictData(null)}
                                            className="w-full px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Subject name</label>
                        <input
                            value={subjectName}
                            onChange={(e) => setSubjectName(e.target.value)}
                            className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 focus:border-blue-500 focus:outline-none transition-colors"
                            placeholder="e.g., Linear Algebra from 3Blue1Brown"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Source type</label>
                        <div className="flex gap-3 flex-wrap">
                            <button
                                type="button"
                                onClick={() => resetSources('youtube')}
                                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${sourceType === 'youtube'
                                    ? 'border-red-500 bg-red-500/10 text-red-400'
                                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                    }`}
                            >
                                <Youtube className="w-4 h-4" />
                                YouTube
                            </button>
                            <button
                                type="button"
                                onClick={() => resetSources('notes')}
                                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${sourceType === 'notes'
                                    ? 'border-green-500 bg-green-500/10 text-green-400'
                                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                    }`}
                            >
                                <FileText className="w-4 h-4" />
                                Notes
                            </button>
                            <button
                                type="button"
                                onClick={() => resetSources('file')}
                                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${sourceType === 'file'
                                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                    }`}
                            >
                                <Upload className="w-4 h-4" />
                                PDF / File
                            </button>
                        </div>
                    </div>

                    {sourceType === 'youtube' ? (
                        <motion.div
                            key="youtube"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <label className="block text-sm text-gray-400 mb-2">YouTube URL</label>
                            <input
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 focus:border-blue-500 focus:outline-none transition-colors"
                                placeholder="https://www.youtube.com/watch?v=..."
                                required
                            />
                            <p className="text-xs text-gray-500 mt-2">We'll extract the transcript and create a curriculum based on the video content.</p>
                        </motion.div>
                    ) : sourceType === 'file' ? (
                        <motion.div
                            key="file"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <label className="block text-sm text-gray-400 mb-2">Upload document</label>
                            <div className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-blue-500 bg-blue-500/5' : 'border-gray-700 hover:border-gray-600'
                                }`}>
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    required
                                />
                                {file ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <CheckCircle2 className="w-6 h-6 text-blue-500" />
                                        <span className="text-blue-400 font-medium">{file.name}</span>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                                        <p className="text-gray-400">Drop your file here or click to browse</p>
                                        <p className="text-xs text-gray-500 mt-2">PDF, DOCX, PPTX, TXT, MD, PNG, JPG, WebP (max 10MB)</p>
                                    </>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                📄 Supports text PDFs, <strong>scanned documents</strong>, and <strong>images</strong> (OCR powered by GPT-4 Vision)
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="notes"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <label className="block text-sm text-gray-400 mb-2">Notes content</label>
                            <textarea
                                value={notesText}
                                onChange={(e) => setNotesText(e.target.value)}
                                rows={8}
                                className="w-full rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 focus:border-blue-500 focus:outline-none transition-colors resize-none"
                                placeholder="Paste your notes, transcript, or markdown content here..."
                                required
                            />
                            <p className="text-xs text-gray-500 mt-2">Supports plain text and markdown formatting.</p>
                        </motion.div>
                    )}

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm"
                        >
                            {error}
                        </motion.div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting || (sourceType === 'file' && !file)}
                        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-4 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Creating your subject...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                Import and Create Subject
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
