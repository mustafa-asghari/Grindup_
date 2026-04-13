import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AssessmentClient } from '@/components/subjects/assessment-client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export const metadata = {
    title: 'Assessment | GrindUp',
};

export default async function SubjectAssessmentPage({ params }: PageProps) {
    const { slug } = await params;
    const session = await auth();

    const subject = await prisma.subject.findUnique({
        where: { slug },
    });

    if (!subject) {
        redirect('/subjects');
    }

    // Fetch all topics for this subject to get a comprehensive "Final Boss" assessment
    const topics = await prisma.subjectTopic.findMany({
        where: { subjectId: subject.id },
        select: { id: true, name: true },
    });

    // Fetch questions from all topics - max 20, evenly distributed across topics
    // This creates a comprehensive "Final Boss" assessment covering everything learned
    const allExercises = await prisma.exercise.findMany({
        where: {
            subjectId: subject.id,
            type: { in: ['mcq', 'flashcard'] }
        },
        include: {
            topic: { select: { name: true } }
        },
        take: 50, // Get more than needed, then shuffle and pick
    });

    // Shuffle exercises for randomness
    const shuffled = allExercises.sort(() => Math.random() - 0.5);

    // Take first 20 (or all if less than 20)
    const selectedExercises = shuffled.slice(0, 20);

    // Transform for client - include topic info for context
    const questions = selectedExercises.map((e: any) => ({
        id: e.id,
        title: e.title,
        type: e.type.toUpperCase() as 'MCQ' | 'FLASHCARD',
        content: e.content,
        points: e.points,
        topicName: e.topic?.name || 'General',
    }));

    if (questions.length === 0) {
        return (
            <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center justify-center">
                <h1 className="text-2xl font-bold mb-4">No Assessment Available</h1>
                <p className="text-gray-400 mb-8">There are no practice questions available for this subject yet.</p>
                <Link
                    href={`/subjects/${slug}`}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4">
            <Link
                href={`/subjects/${slug}`}
                className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-colors absolute top-8 left-8"
            >
                <ArrowLeft className="w-4 h-4" /> Exit
            </Link>

            <AssessmentClient
                subjectId={subject.id}
                subjectSlug={slug}
                subjectName={subject.name}
                questions={questions}
            />
        </div>
    );
}
