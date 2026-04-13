'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function joinContest(contestId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: 'Unauthorized' };
    }

    try {
        await prisma.contestParticipant.create({
            data: {
                contestId,
                userId: session.user.id,
            },
        });
        revalidatePath(`/contests/${contestId}`);
        return { success: true };
    } catch (e) {
        return { error: 'Failed to join contest' };
    }
}

export async function startContest(contestId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: 'Unauthorized' };
    }

    const contest = await prisma.contest.findUnique({
        where: { id: contestId },
        select: { createdById: true },
    });

    if (!contest || contest.createdById !== session.user.id) {
        return { error: 'Unauthorized to start this contest' };
    }

    const now = new Date();
    // Default duration 1 hour if endsAt is older than startsAt (sanity check) or just push endsAt
    // But better to respect original duration or user setting.
    // The user asked "mandatory end time like in hour".
    // I'll set startsAt to now, and endsAt to now + 1 hour.
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    await prisma.contest.update({
        where: { id: contestId },
        data: {
            startsAt: now,
            endsAt: oneHourLater,
        },
    });

    revalidatePath(`/contests/${contestId}`);
    return { success: true };
}
