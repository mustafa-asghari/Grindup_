export interface SM2State {
    easeFactor: number;
    intervalDays: number;
    repetitions: number;
}

export const INITIAL_SM2_STATE: SM2State = {
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
};

/**
 * Calculates next schedule based on SuperMemo-2 algorithm
 * @param quality 0-5 rating. <3 means failure.
 * @param state Current state
 */
export function calculateSM2(quality: number, state: SM2State): SM2State {
    let { easeFactor, intervalDays, repetitions } = state;

    if (quality < 3) {
        // Failure: Reset repetitions, short interval
        repetitions = 0;
        intervalDays = 1;
    } else {
        // Success
        if (repetitions === 0) {
            intervalDays = 1;
        } else if (repetitions === 1) {
            intervalDays = 6;
        } else {
            intervalDays = Math.round(intervalDays * easeFactor);
        }
        repetitions++;
    }

    // Update Ease Factor
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    const q = quality;
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    return { easeFactor, intervalDays, repetitions };
}
