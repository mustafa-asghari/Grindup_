'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActivityData {
    date: string; // ISO date string
    count: number;
    minutes?: number; // Time spent in minutes
    type?: 'submission' | 'review' | 'lesson' | 'exercise';
}

interface ActivityHeatmapProps {
    data: ActivityData[];
    weeks?: number;
    showLabels?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getIntensityClass(count: number): string {
    if (count === 0) return 'bg-zinc-800/50';
    if (count <= 2) return 'bg-green-900/60';
    if (count <= 5) return 'bg-green-700/70';
    if (count <= 10) return 'bg-green-500/80';
    return 'bg-green-400';
}

function formatMinutes(mins: number): string {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function ActivityHeatmap({ data, weeks = 52, showLabels = true }: ActivityHeatmapProps) {
    const [hoveredDay, setHoveredDay] = useState<{
        date: Date;
        count: number;
        minutes: number;
        dateStr: string;
        x: number;
        y: number;
    } | null>(null);

    const { grid, monthLabels, stats } = useMemo(() => {
        const today = new Date();
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (weeks * 7));

        // Create date -> count map and minutes map
        const dateMap = new Map<string, number>();
        const minutesMap = new Map<string, number>();
        data.forEach(d => {
            const dateObj = new Date(d.date);
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const key = `${year}-${month}-${day}`; // Get YYYY-MM-DD local
            dateMap.set(key, (dateMap.get(key) || 0) + d.count);
            minutesMap.set(key, (minutesMap.get(key) || 0) + (d.minutes || 0));
        });

        // Generate grid (weeks x 7 days)
        const grid: { date: Date; count: number; minutes: number; dateStr: string }[][] = [];
        const monthLabels: { month: string; col: number }[] = [];

        let currentDate = new Date(startDate);
        // Align to Sunday
        currentDate.setDate(currentDate.getDate() - currentDate.getDay());

        let currentMonth = -1;

        for (let week = 0; week < weeks; week++) {
            const weekData: { date: Date; count: number; minutes: number; dateStr: string }[] = [];

            for (let day = 0; day < 7; day++) {
                // Use local date string to avoid timezone issues
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                const dayNum = String(currentDate.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${dayNum}`;
                weekData.push({
                    date: new Date(currentDate),
                    count: dateMap.get(dateStr) || 0,
                    minutes: minutesMap.get(dateStr) || 0,
                    dateStr,
                });

                // Track month labels
                if (day === 0 && currentDate.getMonth() !== currentMonth) {
                    currentMonth = currentDate.getMonth();
                    monthLabels.push({ month: MONTHS[currentMonth], col: week });
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }

            grid.push(weekData);
        }

        // Calculate stats
        const totalActivity = data.reduce((sum, d) => sum + d.count, 0);
        const totalMinutes = data.reduce((sum, d) => sum + (d.minutes || 0), 0);
        const activeDays = new Set(data.map(d => d.date.split('T')[0])).size;
        const streak = calculateStreak(dateMap, today);

        return {
            grid,
            monthLabels,
            stats: { totalActivity, totalMinutes, activeDays, streak }
        };
    }, [data, weeks]);

    const handleMouseEnter = (day: { date: Date; count: number; minutes: number; dateStr: string }, event: React.MouseEvent) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setHoveredDay({
            ...day,
            x: rect.left + rect.width / 2,
            y: rect.top,
        });
    };

    return (
        <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-bold text-white text-xl">Activity</h3>
                    <p className="text-sm text-zinc-500">{stats.totalActivity} activities in the last year</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">{stats.streak}</div>
                        <div className="text-xs text-zinc-500">day streak</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">{stats.activeDays}</div>
                        <div className="text-xs text-zinc-500">active days</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">{formatMinutes(stats.totalMinutes)}</div>
                        <div className="text-xs text-zinc-500">studied</div>
                    </div>
                </div>
            </div>

            {/* Month labels */}
            {showLabels && (
                <div className="flex mb-2 text-xs text-zinc-500 relative" style={{ marginLeft: '32px', height: '18px' }}>
                    {monthLabels.map((m, idx) => (
                        <div
                            key={idx}
                            className="absolute"
                            style={{ left: `${m.col * 16}px` }}
                        >
                            {m.month}
                        </div>
                    ))}
                </div>
            )}

            {/* Heatmap grid */}
            <div className="flex gap-[3px] overflow-x-auto pb-2">
                {/* Day labels */}
                {showLabels && (
                    <div className="flex flex-col gap-[3px] mr-2">
                        {DAYS.map((day, idx) => (
                            <div
                                key={day}
                                className="h-[14px] text-[10px] text-zinc-500 flex items-center"
                                style={{ visibility: idx % 2 === 1 ? 'visible' : 'hidden' }}
                            >
                                {day}
                            </div>
                        ))}
                    </div>
                )}

                {/* Grid */}
                {grid.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-[3px]">
                        {week.map((day, dayIdx) => (
                            <motion.div
                                key={day.dateStr}
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: (weekIdx * 7 + dayIdx) * 0.0005 }}
                                onMouseEnter={(e) => handleMouseEnter(day, e)}
                                onMouseLeave={() => setHoveredDay(null)}
                                className={`w-[14px] h-[14px] rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-white/40 hover:scale-110 ${getIntensityClass(day.count)}`}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/* Tooltip */}
            <AnimatePresence>
                {hoveredDay && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="fixed z-50 pointer-events-none"
                        style={{
                            left: hoveredDay.x,
                            top: hoveredDay.y - 10,
                            transform: 'translate(-50%, -100%)',
                        }}
                    >
                        <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
                            <div className="text-white font-semibold text-sm">
                                {hoveredDay.date.toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs">
                                <span className={`font-medium ${hoveredDay.count > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                                    {hoveredDay.count} {hoveredDay.count === 1 ? 'activity' : 'activities'}
                                </span>
                                {hoveredDay.minutes > 0 && (
                                    <span className="text-blue-400">
                                        {formatMinutes(hoveredDay.minutes)} studied
                                    </span>
                                )}
                            </div>
                        </div>
                        <div
                            className="w-2 h-2 bg-zinc-900 border-r border-b border-zinc-700 rotate-45 mx-auto -mt-1"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4">
                <span className="text-xs text-zinc-500">Less</span>
                <div className="flex gap-[3px]">
                    {[0, 2, 5, 10, 15].map((level, idx) => (
                        <div
                            key={idx}
                            className={`w-[14px] h-[14px] rounded-sm ${getIntensityClass(level)}`}
                        />
                    ))}
                </div>
                <span className="text-xs text-zinc-500">More</span>
            </div>
        </div>
    );
}

function calculateStreak(dateMap: Map<string, number>, today: Date): number {
    let streak = 0;
    const current = new Date(today);

    while (true) {
        const dateStr = current.toISOString().split('T')[0];
        if (dateMap.has(dateStr) && dateMap.get(dateStr)! > 0) {
            streak++;
            current.setDate(current.getDate() - 1);
        } else {
            // Check if it's today and no activity yet
            if (streak === 0 && dateStr === today.toISOString().split('T')[0]) {
                current.setDate(current.getDate() - 1);
                continue;
            }
            break;
        }
    }

    return streak;
}
