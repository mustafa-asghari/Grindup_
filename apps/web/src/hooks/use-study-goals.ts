'use client';

import { useCallback, useEffect, useState } from 'react';

export type StudyGoals = {
    daily: number;
    weekly: number;
};

const STORAGE_KEY = 'studyGoals';

export function useStudyGoals(defaultGoals: StudyGoals = { daily: 2, weekly: 10 }) {
    const [goals, setGoals] = useState<StudyGoals>(defaultGoals);

    useEffect(() => {
        try {
            if (typeof window === 'undefined') return;
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (typeof parsed.daily === 'number' && typeof parsed.weekly === 'number') {
                    setGoals(parsed);
                    return;
                }
            }
            setGoals(defaultGoals);
        } catch (e) {
            console.warn('Failed to read saved study goals', e);
            setGoals(defaultGoals);
        }
    }, [defaultGoals.daily, defaultGoals.weekly]);

    const saveGoals = useCallback((next: StudyGoals) => {
        setGoals(next);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (e) {
            console.warn('Failed to persist study goals', e);
        }
    }, []);

    return { goals, setGoals: saveGoals };
}
