'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface TopicMastery {
    topic: string;
    mastery: number; // 0-100
    color?: string;
}

interface WeaknessRadarProps {
    topics: TopicMastery[];
    size?: number;
    showLabels?: boolean;
}

// Calculate dynamic size based on number of topics
function calculateDynamicSize(numTopics: number, baseSize: number): number {
    // Minimum size of 250, scales up with more topics
    // More topics need more space for labels to not overlap
    if (numTopics <= 3) return Math.max(250, baseSize);
    if (numTopics <= 5) return Math.max(280, baseSize);
    if (numTopics <= 8) return Math.max(320, baseSize);
    if (numTopics <= 10) return Math.max(360, baseSize);
    return Math.max(400, baseSize); // For 10+ topics
}

export function WeaknessRadar({ topics, size: propSize = 300, showLabels = true }: WeaknessRadarProps) {
    // Calculate dynamic size based on number of topics
    const size = useMemo(() => calculateDynamicSize(topics.length, propSize), [topics.length, propSize]);

    const { points, labelPositions, gridLevels, sectors } = useMemo(() => {
        const numTopics = topics.length;
        if (numTopics < 1) return { points: '', labelPositions: [], gridLevels: [], sectors: [] };

        const center = size / 2;
        const radius = (size / 2) - 40; // Leave room for labels
        const angleStep = (2 * Math.PI) / numTopics;

        // Calculate points for the data polygon line
        const dataPoints = topics.map((topic, idx) => {
            const angle = angleStep * idx - Math.PI / 2; // Start from top
            const r = (topic.mastery / 100) * radius;
            return {
                x: (center + r * Math.cos(angle)).toFixed(4),
                y: (center + r * Math.sin(angle)).toFixed(4),
            };
        });

        const points = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

        // Calculate label positions
        const labelPositions = topics.map((topic, idx) => {
            const angle = angleStep * idx - Math.PI / 2;
            const r = radius + 25;
            return {
                x: center + r * Math.cos(angle),
                y: center + r * Math.sin(angle),
                topic: topic.topic,
                mastery: topic.mastery,
                angle,
            };
        });

        // Grid levels (20%, 40%, 60%, 80%, 100%)
        const gridLevels = [0.2, 0.4, 0.6, 0.8, 1].map(level => {
            const gridPoints = Array.from({ length: numTopics }, (_, idx) => {
                const angle = angleStep * idx - Math.PI / 2;
                const r = level * radius;
                return {
                    x: (center + r * Math.cos(angle)).toFixed(4),
                    y: (center + r * Math.sin(angle)).toFixed(4),
                };
            });
            return gridPoints.map(p => `${p.x},${p.y}`).join(' ');
        });

        // Calculate INTERACTIVE SECTORS (Invisible wedges for hover)
        const sectors = topics.map((topic, idx) => {
            const startAngle = angleStep * idx - Math.PI / 2 - angleStep / 2;
            const endAngle = angleStep * idx - Math.PI / 2 + angleStep / 2;
            const r = size / 2;

            const x1 = (center + r * Math.cos(startAngle)).toFixed(4);
            const y1 = (center + r * Math.sin(startAngle)).toFixed(4);
            const x2 = (center + r * Math.cos(endAngle)).toFixed(4);
            const y2 = (center + r * Math.sin(endAngle)).toFixed(4);
            const c = center.toFixed(4);
            const rFixed = r.toFixed(4);

            const path = `M ${c},${c} L ${x1},${y1} A ${rFixed},${rFixed} 0 0 1 ${x2},${y2} Z`;

            return {
                path,
                topic: topic.topic,
                mastery: topic.mastery
            };
        });

        return { points, labelPositions, gridLevels, sectors };
    }, [topics, size]);

    if (topics.length < 1) {
        return (
            <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-6 flex items-center justify-center" style={{ minHeight: size }}>
                <p className="text-sm text-zinc-500">No topic data available</p>
            </div>
        );
    }

    // Color based on average mastery
    const avgMastery = topics.reduce((sum, t) => sum + t.mastery, 0) / topics.length;
    const fillColor = avgMastery >= 70 ? 'rgb(34, 197, 94)' : avgMastery >= 40 ? 'rgb(234, 179, 8)' : 'rgb(239, 68, 68)';
    const strokeColor = avgMastery >= 70 ? 'rgb(22, 163, 74)' : avgMastery >= 40 ? 'rgb(202, 138, 4)' : 'rgb(220, 38, 38)';

    return (
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-6 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-white text-lg">Skill Radar</h3>
                    <p className="text-sm text-zinc-500">Topic mastery overview</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-white">{Math.round(avgMastery)}%</div>
                    <div className="text-xs text-zinc-500">avg mastery</div>
                </div>
            </div>

            <div className="flex justify-center">
                <svg width={size} height={size} className="overflow-visible">
                    {/* Interactive Sectors - Render first as invisible hit targets */}
                    {sectors.map((sector, idx) => (
                        <TooltipProvider key={`sector-${idx}`}>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <path
                                        d={sector.path}
                                        fill="transparent"
                                        stroke="none"
                                        className="cursor-pointer hover:fill-white/5 transition-colors"
                                    />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <div className="text-xs">
                                        <p className="font-semibold text-white">{sector.topic}</p>
                                        <p className="text-zinc-400">Mastery: {Math.round(sector.mastery)}%</p>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ))}

                    {/* Grid lines */}
                    {gridLevels.map((gridPoints, idx) => (
                        <polygon
                            key={idx}
                            points={gridPoints}
                            fill="none"
                            stroke="rgb(63, 63, 70)"
                            strokeWidth={idx === gridLevels.length - 1 ? 1.5 : 0.5}
                            strokeDasharray={idx < gridLevels.length - 1 ? '2,2' : 'none'}
                            className="pointer-events-none"
                        />
                    ))}

                    {/* Axis lines */}
                    {labelPositions.map((pos, idx) => (
                        <line
                            key={idx}
                            x1={size / 2}
                            y1={size / 2}
                            x2={size / 2 + ((size / 2 - 40) * Math.cos(pos.angle))}
                            y2={size / 2 + ((size / 2 - 40) * Math.sin(pos.angle))}
                            stroke="rgb(63, 63, 70)"
                            strokeWidth={0.5}
                            opacity={0.5}
                            className="pointer-events-none"
                        />
                    ))}

                    {/* Data polygon (The "Red Thing") */}
                    <motion.polygon
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        points={points}
                        fill={fillColor}
                        fillOpacity={0.2}
                        stroke={strokeColor}
                        strokeWidth={2}
                        style={{ transformOrigin: 'center' }}
                        className="pointer-events-none"
                    />

                    {/* Data points */}
                    {topics.map((topic, idx) => {
                        const angle = (2 * Math.PI / topics.length) * idx - Math.PI / 2;
                        const r = (topic.mastery / 100) * ((size / 2) - 40);
                        const center = size / 2;
                        const x = (center + r * Math.cos(angle)).toFixed(4);
                        const y = (center + r * Math.sin(angle)).toFixed(4);

                        return (
                            <motion.circle
                                key={`point-${idx}`}
                                initial={{ r: 0 }}
                                animate={{ r: 4 }}
                                transition={{ delay: 0.3 + idx * 0.05 }}
                                cx={x}
                                cy={y}
                                fill={strokeColor}
                                className="pointer-events-none"
                            />
                        );
                    })}

                    {/* Labels */}
                    {showLabels && labelPositions.map((pos, idx) => (
                        <text
                            key={idx}
                            x={pos.x}
                            y={pos.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-[10px] fill-zinc-400 pointer-events-none"
                        >
                            <tspan className="fill-zinc-300 font-medium">
                                {pos.topic.length > 20 ? pos.topic.slice(0, 20) + '...' : pos.topic}
                            </tspan>
                            <tspan x={pos.x} dy="12" className="text-[9px] fill-zinc-500">
                                {pos.mastery}%
                            </tspan>
                        </text>
                    ))}
                </svg>
            </div>

            {/* Weak topics list */}
            <div className="mt-6 space-y-2">
                <h4 className="text-sm font-medium text-zinc-400 mb-3">Focus Areas</h4>
                {topics
                    .filter(t => t.mastery < 50)
                    .sort((a, b) => a.mastery - b.mastery)
                    .slice(0, 3)
                    .map((topic, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                            <span className="text-sm text-white">{topic.topic}</span>
                            <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${topic.mastery}%` }}
                                        transition={{ delay: idx * 0.1 }}
                                        className={`h-full rounded-full ${topic.mastery < 30 ? 'bg-red-500' : 'bg-amber-500'
                                            }`}
                                    />
                                </div>
                                <span className={`text-xs font-medium ${topic.mastery < 30 ? 'text-red-400' : 'text-amber-400'
                                    }`}>
                                    {topic.mastery}%
                                </span>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
}
