import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { SetupClient } from '@/components/subjects/setup-client';

export default async function SubjectSetupPage({ params }: { params: Promise<{ slug: string }> }) {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    const { slug } = await params;

    const subject = await prisma.subject.findUnique({
        where: { slug },
        select: {
            id: true,
            name: true,
            slug: true,
            category: true,
        },
    });

    if (!subject) {
        notFound();
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.userSubject.findUnique({
        where: {
            userId_subjectId: {
                userId: session.user.id,
                subjectId: subject.id,
            },
        },
    });

    if (existingEnrollment) {
        redirect(`/subjects/${slug}`);
    }

    return <SetupClient subject={subject} />;
}
