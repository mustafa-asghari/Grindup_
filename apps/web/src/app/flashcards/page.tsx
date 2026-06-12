import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FlashcardStudy } from '@/components/learning/flashcard-study';

interface PageProps {
    searchParams: Promise<{ subject?: string; topic?: string }>;
}

export default async function FlashcardsPage({ searchParams }: PageProps) {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    const params = await searchParams;
    const subjectId = params.subject || '';

    return <FlashcardStudy subjectId={subjectId} topicId={params.topic} />;
}
