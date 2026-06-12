// Submission types
export type ExecutionLanguage = 'python' | 'javascript' | 'java' | 'cpp';

export interface SubmissionRequest {
    code: string;
    language: ExecutionLanguage;
    problem_id: string;
    test_cases: TestCase[];
    time_limit_ms?: number;
    memory_limit_kb?: number;
}

export interface TestCase {
    id: string;
    input: string;
    expected_output: string;
    is_hidden: boolean;
}

export interface SubmissionResult {
    status: 'accepted' | 'wrong_answer' | 'tle' | 'mle' | 'error';
    test_results: TestResult[];
    runtime_ms: number;
    memory_kb: number;
    submission_id?: string;
    error?: string | null;
}

export interface TestResult {
    test_case_id: string;
    passed: boolean;
    actual_output?: string | null;
    runtime_ms: number;
    is_hidden: boolean;
    error?: string | null;
}

// AI types
export interface HintRequest {
    problemId: string;
    submissionHistory: SubmissionSummary[];
    currentAttempt: number;
}

export interface SubmissionSummary {
    code: string;
    status: string;
    failedCategories: string[];
}

export interface HintResponse {
    hint: string;
    level: 1 | 2 | 3;
    concept?: string;
}

// Proctoring types
export interface ProctoringSession {
    mode: 'interview' | 'exam' | 'contest';
    restrictions: {
        blockPaste: boolean;
        detectTabSwitch: boolean;
        blockCopy: boolean;
        recordTranscript: boolean;
    };
    flags: IntegrityFlag[];
}

export interface IntegrityFlag {
    type: 'paste_attempt' | 'tab_switch' | 'copy_attempt' | 'long_pause';
    timestamp: string;
    details?: string;
}

// Confidence boost types
export interface ConfidenceBoost {
    skill: string;
    masteryBefore: number;
    masteryAfter: number;
    percentile: number;
    peerComparisonText: string;
}

// Weekly report types
export interface WeeklyReport {
    weekOf: string;
    problemsSolved: number;
    topicsImproved: TopicProgress[];
    topicsNeedingWork: string[];
    timeSpentMinutes: number;
    streakDays: number;
    personalBestsAchieved: string[];
    recommendedFocus: string;
    motivationalNote: string;
}

export interface TopicProgress {
    topic: string;
    masteryBefore: number;
    masteryAfter: number;
}

// Roadmap types
export interface RoadmapRequest {
    goal: string;
    currentLevel: 'beginner' | 'intermediate' | 'advanced';
    hoursPerWeek: number;
    deadline?: string;
    preferences?: {
        moreTheory?: boolean;
        morePractice?: boolean;
        moreProjects?: boolean;
    };
}

// Problem recommendation explanation
export interface ProblemRecommendationExplanation {
    reasons: {
        weakTopic?: string;
        prerequisiteGap?: string;
        timeConstraint?: string;
        reviewDue?: string;
        contractGoal?: string;
    };
}
