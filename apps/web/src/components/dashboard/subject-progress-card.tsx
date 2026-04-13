'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Award, BookOpen } from 'lucide-react';

interface SubjectProgress {
    id: string;
    name: string;
    color: string | null;
    progressPercent: number;
}

interface SubjectProgressCardProps {
    subjects: SubjectProgress[];
}

// Get color based on score
const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e'; // green
    if (score >= 60) return '#84cc16'; // lime
    if (score >= 40) return '#eab308'; // yellow
    if (score >= 20) return '#f97316'; // orange
    return '#ef4444'; // red
};

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 shadow-xl">
                <p className="text-white font-medium text-sm">{data.fullName}</p>
                <p className="text-gray-400 text-xs mt-1">
                    Progress: <span className="text-white font-semibold">{data.score}%</span>
                </p>
            </div>
        );
    }
    return null;
};

export function SubjectProgressCard({ subjects }: SubjectProgressCardProps) {
    // Calculate overall score
    const overallScore = subjects.length > 0
        ? Math.round(subjects.reduce((sum, s) => sum + s.progressPercent, 0) / subjects.length)
        : 0;

    // Prepare chart data - truncate names for display
    const chartData = subjects.map(s => ({
        name: s.name.length > 10 ? s.name.slice(0, 10) + '…' : s.name,
        fullName: s.name,
        score: Math.round(s.progressPercent),
        color: getScoreColor(s.progressPercent),
    }));

    // Add overall score as the last bar
    if (subjects.length > 0) {
        chartData.push({
            name: 'Overall',
            fullName: 'Overall Average',
            score: overallScore,
            color: getScoreColor(overallScore),
        });
    }

    return (
        <div className="p-6 rounded-2xl bg-gray-900 border border-gray-800 col-span-1 lg:col-span-2 h-[320px]">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <Award className="w-5 h-5 text-gray-400" />
                    <h3 className="text-lg font-semibold text-white">Subject Scores</h3>
                </div>
                {subjects.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700">
                        <span className="text-gray-400 text-sm">Overall:</span>
                        <span
                            className="text-lg font-bold"
                            style={{ color: getScoreColor(overallScore) }}
                        >
                            {overallScore}%
                        </span>
                    </div>
                )}
            </div>

            {subjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[220px] text-gray-500">
                    <BookOpen className="w-12 h-12 mb-3 opacity-40" />
                    <p>No subjects enrolled yet</p>
                    <p className="text-sm mt-1">Enroll in subjects to see your scores</p>
                </div>
            ) : (
                <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{
                                top: 20,
                                right: 10,
                                left: -10,
                                bottom: 20,
                            }}
                        >
                            <defs>
                                {/* Gradients for each score level */}
                                <linearGradient id="gradientGreen" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.6} />
                                </linearGradient>
                                <linearGradient id="gradientLime" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#84cc16" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#84cc16" stopOpacity={0.6} />
                                </linearGradient>
                                <linearGradient id="gradientYellow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#eab308" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#eab308" stopOpacity={0.6} />
                                </linearGradient>
                                <linearGradient id="gradientOrange" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.6} />
                                </linearGradient>
                                <linearGradient id="gradientRed" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.6} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis
                                dataKey="name"
                                stroke="#666"
                                tick={{ fill: '#888', fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                                angle={-15}
                                textAnchor="end"
                                height={50}
                            />
                            <YAxis
                                stroke="#666"
                                tick={{ fill: '#888', fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                domain={[0, 100]}
                                ticks={[0, 25, 50, 75, 100]}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            <Bar
                                dataKey="score"
                                radius={[6, 6, 0, 0]}
                                maxBarSize={50}
                            >
                                {chartData.map((entry, index) => {
                                    // Determine gradient based on score
                                    let gradientId = 'gradientRed';
                                    if (entry.score >= 80) gradientId = 'gradientGreen';
                                    else if (entry.score >= 60) gradientId = 'gradientLime';
                                    else if (entry.score >= 40) gradientId = 'gradientYellow';
                                    else if (entry.score >= 20) gradientId = 'gradientOrange';

                                    return (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={`url(#${gradientId})`}
                                            stroke={entry.color}
                                            strokeWidth={1}
                                        />
                                    );
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
