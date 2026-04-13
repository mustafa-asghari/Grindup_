'use server';

import { auth, signOut } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function updateProfile(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: 'Unauthorized' };
    }

    const name = formData.get('name') as string;
    const username = formData.get('username') as string;

    if (!username) {
        return { error: 'Username is required' };
    }

    try {
        // Check username uniqueness if changed
        const existing = await prisma.user.findUnique({
            where: { username },
        });

        if (existing && existing.id !== session.user.id) {
            return { error: 'Username is already taken' };
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name,
                username,
            },
        });

        revalidatePath('/settings');
        return { success: true };
    } catch (e) {
        console.error('Update profile error:', e);
        return { error: 'Failed to update profile' };
    }
}

export async function deleteAccount() {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: 'Unauthorized' };
    }

    try {
        const userId = session.user.id;

        // Order matters for FK constraints (delete dependents first).
        // Order matters for FK constraints (delete dependents first).

        // 1. Unlink from challenges (User? relation)
        await prisma.studyChallenge.updateMany({
            where: { winnerId: userId },
            data: { winnerId: null }
        });

        // 2. Delete all dependents
        await prisma.$transaction([
            // Social
            prisma.friendship.deleteMany({ where: { OR: [{ requesterId: userId }, { addresseeId: userId }] } }),
            prisma.directMessage.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
            prisma.studyChallenge.deleteMany({ where: { OR: [{ challengerId: userId }, { challengedId: userId }] } }),

            // Learning & Content
            prisma.learningContracts.deleteMany({ where: { userId } }),
            prisma.learningMilestones.deleteMany({ where: { userId } }), // Singular model name, verify plural property?
            prisma.userSubject.deleteMany({ where: { userId } }),
            prisma.userTopicProgress.deleteMany({ where: { userId } }),
            prisma.userKnowledgeGraph.deleteMany({ where: { userId } }),
            prisma.exerciseAttempt.deleteMany({ where: { userId } }),
            prisma.mistakeCards.deleteMany({ where: { userId } }),
            prisma.reviewCards.deleteMany({ where: { userId } }),
            prisma.personalBests.deleteMany({ where: { userId } }),
            prisma.conceptDriftAlerts.deleteMany({ where: { userId } }),
            prisma.problemReports.deleteMany({ where: { userId } }),
            prisma.starterTasks.deleteMany({ where: { userId } }),
            prisma.onboardingProfile.deleteMany({ where: { userId } }),

            // System & Logs
            prisma.xpTransactions.deleteMany({ where: { userId } }),
            prisma.userBadges.deleteMany({ where: { userId } }),
            prisma.events.deleteMany({ where: { userId } }),
            prisma.contestSubmission.deleteMany({ where: { userId } }),
            prisma.submission.deleteMany({ where: { userId } }),
            prisma.account.deleteMany({ where: { userId } }),
            prisma.session.deleteMany({ where: { userId } }),
            prisma.auditLogs.deleteMany({ where: { adminId: userId } }),

            // Finally User
            prisma.user.delete({ where: { id: userId } }),
        ]);

        // Clear session cookie without throwing a redirect from the server action.
        await signOut({ redirect: false });
        return { success: true };
    } catch (e) {
        console.error('Delete account error:', e);
        return { error: 'Failed to delete account' };
    }
}
