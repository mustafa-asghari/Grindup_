// XP rewards
export const XP_REWARDS = {
    PROBLEM_EASY: 10,
    PROBLEM_MEDIUM: 25,
    PROBLEM_HARD: 50,
    STREAK_BONUS_PERCENT: 10,
    DAILY_TASK_BONUS: 5,
    EXPLAIN_BONUS: 15,
    CONTEST_PARTICIPATION: 20,
    CONTEST_WIN: 100,
} as const;

// Level thresholds
export const LEVEL_THRESHOLDS = [
    0,      // Level 1
    100,    // Level 2
    300,    // Level 3
    600,    // Level 4
    1000,   // Level 5
    1500,   // Level 6
    2200,   // Level 7
    3000,   // Level 8
    4000,   // Level 9
    5000,   // Level 10
] as const;

// Supported languages
export const SUPPORTED_LANGUAGES = [
    'python',
    'javascript',
    'java',
    'cpp',
] as const;

// Time limits by difficulty (ms)
export const TIME_LIMITS = {
    EASY: 2000,
    MEDIUM: 3000,
    HARD: 5000,
} as const;

// Memory limits (KB)
export const MEMORY_LIMITS = {
    DEFAULT: 256000,
    LARGE: 512000,
} as const;

// Rate limits
export const RATE_LIMITS = {
    SUBMISSIONS_PER_MINUTE: 5,
    LOGIN_ATTEMPTS_PER_15_MIN: 5,
    DAILY_RUNS_FREE: 50,
} as const;

// Spaced repetition (SM-2 algorithm)
export const SM2_DEFAULTS = {
    EASE_FACTOR: 2.5,
    MIN_EASE_FACTOR: 1.3,
    INTERVAL_DAYS: 1,
} as const;

// Interview scoring weights
export const INTERVIEW_WEIGHTS = {
    PROBLEM_SOLVING: 0.30,
    CODE_QUALITY: 0.20,
    COMMUNICATION: 0.20,
    EDGE_CASES: 0.15,
    ADAPTABILITY: 0.15,
} as const;

// Interview pass thresholds
export const INTERVIEW_THRESHOLDS = {
    PASS_TOTAL: 75,
    PASS_MIN_CATEGORY: 60,
    CONDITIONAL_TOTAL: 65,
    RETRY_COOLDOWN_DAYS: 7,
} as const;

// Mistake tags
export const MISTAKE_TAGS = [
    'off-by-one',
    'overflow',
    'underflow',
    'wrong-base-case',
    'forgot-to-sort',
    'null-check',
    'edge-case',
    'infinite-loop',
    'wrong-comparator',
    'boundary-error',
] as const;
