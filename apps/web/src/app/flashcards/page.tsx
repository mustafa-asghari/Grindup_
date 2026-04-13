import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FlashcardStudy } from '@/components/learning/flashcard-study';
import { AppShell } from '@/components/layout/app-shell';
import { prisma } from '@/lib/db';

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

    // Get user stats for header
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            xp: true,
            level: true,
            currentStreak: true,
            name: true,
        },
    });

    const displayName = user?.name || session.user.name || 'Student';
    const displayInitial = displayName.charAt(0).toUpperCase();

    return (
        <AppShell
            isLoggedIn={true}
            userStats={{
                streak: user?.currentStreak || 0,
                xp: user?.xp || 0,
                level: user?.level || 1,
            }}
            displayName={displayName}
            displayInitial={displayInitial}
        >
            <FlashcardStudy subjectId={subjectId} topicId={params.topic} />
        </AppShell>
    );
}
