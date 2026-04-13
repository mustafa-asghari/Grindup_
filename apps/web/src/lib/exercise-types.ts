import { ExerciseType, Difficulty } from '@prisma/client';

export type McqContent = {
    question: string;
    options: string[];
    correctAnswers: number[]; // indices
    explanation?: string;
};

export type FlashcardContent = {
    front: string;
    back: string;
    hints?: string[];
};

export type ExerciseContent = McqContent | FlashcardContent | any;

export interface ExerciseData {
    id: string;
    title: string;
    type: ExerciseType;
    content: ExerciseContent;
    difficulty: Difficulty;
    points: number;
    subjectId: string;
}
