/**
 * Level Calculation Utilities
 * 
 * XP Thresholds for each level:
 * Level 1: 0 XP
 * Level 2: 100 XP
 * Level 3: 300 XP
 * Level 4: 600 XP
 * Level 5: 1000 XP
 * Level 6: 1500 XP
 * Level 7: 2100 XP
 * Level 8: 2800 XP
 * Level 9: 3600 XP
 * Level 10: 4500 XP
 * Level 11+: 1000 XP per level
 */

// XP thresholds for each level (0-indexed, so index 0 = level 1)
const LEVEL_THRESHOLDS = [
    0,      // Level 1
    100,    // Level 2
    300,    // Level 3
    600,    // Level 4
    1000,   // Level 5
    1500,   // Level 6
    2100,   // Level 7
    2800,   // Level 8
    3600,   // Level 9
    4500,   // Level 10
];

/**
 * Calculate the level based on total XP
 */
export function calculateLevel(xp: number): number {
    // Check predefined thresholds
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (xp >= LEVEL_THRESHOLDS[i]) {
            // If at max threshold, calculate additional levels
            if (i === LEVEL_THRESHOLDS.length - 1) {
                const extraXP = xp - LEVEL_THRESHOLDS[i];
                const extraLevels = Math.floor(extraXP / 1000);
                return i + 1 + extraLevels;
            }
            return i + 1;
        }
    }
    return 1;
}

/**
 * Get XP required for the next level
 */
export function getXPForNextLevel(currentLevel: number): number {
    if (currentLevel < LEVEL_THRESHOLDS.length) {
        return LEVEL_THRESHOLDS[currentLevel];
    }
    // After level 10, it's 1000 XP per level
    return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (currentLevel - LEVEL_THRESHOLDS.length + 1) * 1000;
}

/**
 * Get XP required for current level (start of current level)
 */
export function getXPForLevel(level: number): number {
    if (level <= 1) return 0;
    if (level <= LEVEL_THRESHOLDS.length) {
        return LEVEL_THRESHOLDS[level - 1];
    }
    return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (level - LEVEL_THRESHOLDS.length) * 1000;
}

/**
 * Get progress percentage within current level
 */
export function getLevelProgress(xp: number): number {
    const currentLevel = calculateLevel(xp);
    const currentLevelXP = getXPForLevel(currentLevel);
    const nextLevelXP = getXPForNextLevel(currentLevel);

    if (nextLevelXP === currentLevelXP) return 100;

    const progress = ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
    return Math.min(100, Math.max(0, progress));
}

/**
 * Format study time in human-readable format
 */
export function formatStudyTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;

    if (remainingMins === 0) return `${hours}h`;
    return `${hours}h ${remainingMins}m`;
}
