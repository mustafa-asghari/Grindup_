
'use client';

import { useState, useEffect } from 'react';

export function useLiveStats(initialStats?: { xp: number; streak: number; dailyHours: number; weeklyHours: number }) {
    const [stats, setStats] = useState({
        xp: initialStats?.xp || 0,
        streak: initialStats?.streak || 0,
        dailyHours: initialStats?.dailyHours || 0,
        weeklyHours: initialStats?.weeklyHours || 0,
        level: 1,
        skillRating: 1000
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/stats/study-time');
                if (res.ok) {
                    const data = await res.json();
                    setStats(prev => ({
                        ...prev,
                        xp: data.xp,
                        streak: data.streak,
                        dailyHours: data.dailyHours,
                        weeklyHours: data.weeklyHours,
                        level: data.level,
                        skillRating: data.skillRating
                    }));
                }
            } catch (error) {
                console.error('Failed to fetch live stats', error);
            }
        };

        // Fetch immediately (if no initial stats) and then poll
        if (!initialStats) fetchStats();

        // 30 seconds interval for "live" feel
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [initialStats]);

    return stats;
}
