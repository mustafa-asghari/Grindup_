import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import OnboardingClient from './onboarding-client';

export default async function OnboardingPage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    // Verify user exists in the database
    // This handles the "zombie session" case where the user has a valid session token
    // but the user record has been deleted from the database.
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true },
    });

    if (!user) {
        // Redirect to force signout if the user record is missing but session exists
        redirect('/force-signout');
    }

    return <OnboardingClient />;
}
