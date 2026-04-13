'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseStudyTimeTrackerProps {
    subjectId: string;
    topicId?: string;
    enabled?: boolean;
}

/**
 * Hook to track time spent on a topic/lesson.
 * Sends time data to the server every 60 seconds and on unmount.
 */
export function useStudyTimeTracker({ subjectId, topicId, enabled = true }: UseStudyTimeTrackerProps) {
    const startTimeRef = useRef<number | null>(null);
    const lastSentRef = useRef<number>(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const sendTime = useCallback(async () => {
        if (startTimeRef.current === null) return;
        const now = Date.now();
        const secondsSpent = Math.floor((now - startTimeRef.current) / 1000) - lastSentRef.current;

        if (secondsSpent < 10) return; // Don't send for less than 10 seconds

        lastSentRef.current += secondsSpent;

        try {
            await fetch('/api/topics/track-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subjectId,
                    topicId,
                    secondsSpent
                })
            });
        } catch (err) {
            console.warn('Failed to track study time:', err);
        }
    }, [subjectId, topicId]);

    useEffect(() => {
        if (!enabled || !subjectId) return;

        startTimeRef.current = Date.now();
        lastSentRef.current = 0;

        // Send time every 60 seconds
        intervalRef.current = setInterval(sendTime, 60000);

        // Also track visibility changes (tab switching)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                sendTime();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Send remaining time on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            sendTime();
        };
    }, [enabled, subjectId, topicId, sendTime]);

    return null;
}
