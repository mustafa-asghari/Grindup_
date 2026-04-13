'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Award, Download, Share2, Trophy, Star, Calendar } from 'lucide-react';

interface GraduationCertificateProps {
    userName: string;
    subjectName: string;
    completionDate: string;
    certificateId: string;
    totalHours: number;
    exercisesCompleted: number;
    averageScore: number;
    ranking?: number; // Percentile ranking
    specialAchievements?: string[];
}

export function GraduationCertificate({
    userName,
    subjectName,
    completionDate,
    certificateId,
    totalHours,
    exercisesCompleted,
    averageScore,
    ranking,
    specialAchievements = [],
}: GraduationCertificateProps) {
    const certificateRef = useRef<HTMLDivElement>(null);

    const handleDownload = async () => {
        // This would use html2canvas or similar to generate image
        alert('Certificate download feature - would generate PDF/image');
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: `${subjectName} Certificate - ${userName}`,
                text: `I completed the ${subjectName} course on GrindUp!`,
                url: `https://grindup.io/certificates/${certificateId}`,
            });
        } else {
            // Fallback - copy to clipboard
            navigator.clipboard.writeText(`https://grindup.io/certificates/${certificateId}`);
            alert('Certificate link copied to clipboard!');
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const getGrade = (score: number) => {
        if (score >= 95) return { grade: 'A+', color: 'text-emerald-400' };
        if (score >= 90) return { grade: 'A', color: 'text-emerald-400' };
        if (score >= 85) return { grade: 'A-', color: 'text-green-400' };
        if (score >= 80) return { grade: 'B+', color: 'text-green-400' };
        if (score >= 75) return { grade: 'B', color: 'text-yellow-400' };
        if (score >= 70) return { grade: 'B-', color: 'text-yellow-400' };
        if (score >= 65) return { grade: 'C+', color: 'text-orange-400' };
        if (score >= 60) return { grade: 'C', color: 'text-orange-400' };
        return { grade: 'P', color: 'text-zinc-400' };
    };

    const gradeInfo = getGrade(averageScore);

    return (
        <div className="max-w-4xl mx-auto p-8">
            {/* Certificate Card */}
            <motion.div
                ref={certificateRef}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative bg-gradient-to-br from-zinc-900 via-zinc-950 to-black rounded-3xl border-2 border-amber-500/30 overflow-hidden"
            >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f59e0b' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                    }} />
                </div>

                {/* Decorative Corner Elements */}
                <div className="absolute top-0 left-0 w-32 h-32 border-t-4 border-l-4 border-amber-500/50 rounded-tl-3xl" />
                <div className="absolute top-0 right-0 w-32 h-32 border-t-4 border-r-4 border-amber-500/50 rounded-tr-3xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 border-b-4 border-l-4 border-amber-500/50 rounded-bl-3xl" />
                <div className="absolute bottom-0 right-0 w-32 h-32 border-b-4 border-r-4 border-amber-500/50 rounded-br-3xl" />

                <div className="relative p-12">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
                            <Award className="w-5 h-5 text-amber-400" />
                            <span className="text-amber-300 font-medium">Certificate of Completion</span>
                        </div>
                        <h1 className="text-5xl font-bold text-white mb-2">GrindUp</h1>
                        <p className="text-zinc-500">Mastery Learning Platform</p>
                    </div>

                    {/* Main Content */}
                    <div className="text-center space-y-6">
                        <p className="text-zinc-400 text-lg">This certifies that</p>
                        <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
                            {userName}
                        </h2>
                        <p className="text-zinc-400 text-lg">has successfully completed</p>
                        <h3 className="text-3xl font-semibold text-white">{subjectName}</h3>

                        {/* Stats Row */}
                        <div className="flex justify-center gap-8 py-8">
                            <div className="text-center">
                                <div className={`text-4xl font-bold ${gradeInfo.color}`}>{gradeInfo.grade}</div>
                                <div className="text-sm text-zinc-500 mt-1">Final Grade</div>
                            </div>
                            <div className="w-px bg-zinc-800" />
                            <div className="text-center">
                                <div className="text-4xl font-bold text-white">{totalHours}h</div>
                                <div className="text-sm text-zinc-500 mt-1">Study Time</div>
                            </div>
                            <div className="w-px bg-zinc-800" />
                            <div className="text-center">
                                <div className="text-4xl font-bold text-white">{exercisesCompleted}</div>
                                <div className="text-sm text-zinc-500 mt-1">Exercises</div>
                            </div>
                            {ranking && (
                                <>
                                    <div className="w-px bg-zinc-800" />
                                    <div className="text-center">
                                        <div className="text-4xl font-bold text-purple-400">Top {100 - ranking}%</div>
                                        <div className="text-sm text-zinc-500 mt-1">Ranking</div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Special Achievements */}
                        {specialAchievements.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-3">
                                {specialAchievements.map((achievement, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20"
                                    >
                                        <Star className="w-4 h-4 text-purple-400" />
                                        <span className="text-sm text-purple-300">{achievement}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Date and ID */}
                        <div className="pt-8 flex items-center justify-center gap-6 text-zinc-500 text-sm">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {formatDate(completionDate)}
                            </div>
                            <span>•</span>
                            <span>Certificate ID: {certificateId}</span>
                        </div>
                    </div>

                    {/* Signature Area */}
                    <div className="mt-12 pt-8 border-t border-zinc-800 flex justify-between items-end">
                        <div className="text-center">
                            <div className="w-48 border-b border-zinc-700 mb-2" />
                            <p className="text-sm text-zinc-500">Student Signature</p>
                        </div>
                        <div className="text-center">
                            <div className="w-48 border-b border-zinc-700 mb-2">
                                <span className="text-2xl italic text-zinc-400">GrindUp</span>
                            </div>
                            <p className="text-sm text-zinc-500">Platform Verification</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Actions */}
            <div className="flex justify-center gap-4 mt-8">
                <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white transition-colors"
                >
                    <Download className="w-5 h-5" />
                    Download Certificate
                </button>
                <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                    <Share2 className="w-5 h-5" />
                    Share Achievement
                </button>
            </div>
        </div>
    );
}
