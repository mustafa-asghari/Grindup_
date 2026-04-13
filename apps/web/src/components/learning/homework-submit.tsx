'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload,
    FileText,
    Image,
    CheckCircle2,
    XCircle,
    Loader2,
    Send,
    Star,
    Award,
    AlertTriangle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

interface HomeworkSubmitProps {
    homeworkId: string;
    homeworkTitle: string;
    onSubmitted?: (result: { score: number; feedback: string }) => void;
}

export function HomeworkSubmit({ homeworkId, homeworkTitle, onSubmitted }: HomeworkSubmitProps) {
    const [mode, setMode] = useState<'file' | 'text'>('file');
    const [file, setFile] = useState<File | null>(null);
    const [textContent, setTextContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ score: number; feedback: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            // Validate file size (max 10MB)
            if (selectedFile.size > 10 * 1024 * 1024) {
                setError('File too large. Maximum size is 10MB.');
                return;
            }
            setFile(selectedFile);
            setError(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('homeworkId', homeworkId);

            if (mode === 'file' && file) {
                formData.append('file', file);
            } else if (mode === 'text' && textContent) {
                formData.append('textContent', textContent);
            } else {
                setError('Please upload a file or enter your work.');
                setIsSubmitting(false);
                return;
            }

            const response = await fetch('/api/homework/submit', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.details || data.error || 'Submission failed');
                return;
            }

            setResult({ score: data.submission.score, feedback: data.submission.feedback });
            onSubmitted?.({ score: data.submission.score, feedback: data.submission.feedback });
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        if (score >= 40) return 'text-orange-400';
        return 'text-red-400';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 90) return 'Excellent!';
        if (score >= 80) return 'Great job!';
        if (score >= 70) return 'Good work!';
        if (score >= 60) return 'Nice effort!';
        if (score >= 50) return 'Keep going!';
        return 'Needs improvement';
    };

    // Result view after submission
    if (result) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-950 rounded-2xl border border-zinc-800 p-6 space-y-6"
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Award className="w-5 h-5 text-yellow-400" />
                        Submission Graded
                    </h3>
                    <div className={`text-3xl font-bold ${getScoreColor(result.score)}`}>
                        {result.score}/100
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`px-4 py-2 rounded-full ${getScoreColor(result.score)} bg-zinc-900`}>
                        <Star className="w-4 h-4 inline mr-2" />
                        {getScoreLabel(result.score)}
                    </div>
                </div>

                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <h4 className="text-sm font-medium text-zinc-400 mb-3">AI Feedback</h4>
                    <div className="prose prose-invert prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm text-zinc-300 font-sans">
                            {result.feedback}
                        </pre>
                    </div>
                </div>

                <button
                    onClick={() => {
                        setResult(null);
                        setFile(null);
                        setTextContent('');
                    }}
                    className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium transition-colors"
                >
                    Submit Another Version
                </button>
            </motion.div>
        );
    }

    return (
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-6 space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-white mb-1">Submit Your Work</h3>
                <div className="text-sm text-zinc-500">
                    Upload your homework for "<span className="text-zinc-300 inline">
                        <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                                p: ({ children }) => <span>{children}</span>,
                            }}
                        >
                            {homeworkTitle}
                        </ReactMarkdown>
                    </span>" and get instant AI feedback
                </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setMode('file')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${mode === 'file'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
                        }`}
                >
                    <Upload className="w-4 h-4" />
                    Upload File
                </button>
                <button
                    type="button"
                    onClick={() => setMode('text')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${mode === 'text'
                        ? 'border-green-500 bg-green-500/10 text-green-400'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600'
                        }`}
                >
                    <FileText className="w-4 h-4" />
                    Type/Paste
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence mode="wait">
                    {mode === 'file' ? (
                        <motion.div
                            key="file"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${file
                                    ? 'border-blue-500 bg-blue-500/5'
                                    : 'border-zinc-700 hover:border-zinc-600'
                                    }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                {file ? (
                                    <div className="flex items-center justify-center gap-3">
                                        {file.type.startsWith('image/') ? (
                                            <Image className="w-6 h-6 text-blue-500" />
                                        ) : (
                                            <FileText className="w-6 h-6 text-blue-500" />
                                        )}
                                        <span className="text-blue-400 font-medium">{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFile(null);
                                            }}
                                            className="text-zinc-500 hover:text-white"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
                                        <p className="text-zinc-400">Click to upload your work</p>
                                        <p className="text-xs text-zinc-500 mt-2">
                                            Supports PDF, images (PNG, JPG), TXT, DOCX (max 10MB)
                                        </p>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="text"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <textarea
                                value={textContent}
                                onChange={(e) => setTextContent(e.target.value)}
                                rows={8}
                                placeholder="Type or paste your work here..."
                                className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-white placeholder-zinc-500 focus:border-green-500 focus:outline-none resize-none transition-colors"
                            />
                            <p className="text-xs text-zinc-500 mt-2">
                                Minimum 10 characters required
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400"
                    >
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                    </motion.div>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting || (mode === 'file' && !file) || (mode === 'text' && textContent.length < 10)}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Grading your work...
                        </>
                    ) : (
                        <>
                            <Send className="w-5 h-5" />
                            Submit for AI Grading
                        </>
                    )}
                </button>
            </form>

            <p className="text-xs text-zinc-600 text-center">
                Your work will be reviewed by AI and you'll receive instant feedback
            </p>
        </div>
    );
}
