
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const challenges = await prisma.studyChallenge.findMany({
            where: {
                OR: [
                    { challengerId: session.user.id },
                    { challengedId: session.user.id }
                ]
            },
            include: {
                challenger: { select: { id: true, name: true, image: true, xp: true } },
                challenged: { select: { id: true, name: true, image: true, xp: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(challenges);
    } catch (error) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { targetUserId, type, stake, targetValue, duration, targetProblemId } = await req.json();

        // Validate XP balance
        const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { xp: true } });
        if (!user || user.xp < stake) {
            return NextResponse.json({ error: "Insufficient XP for stake" }, { status: 400 });
        }

        // Validate Opponent XP
        const opponent = await prisma.user.findUnique({ where: { id: targetUserId }, select: { xp: true } });
        if (!opponent) {
            return NextResponse.json({ error: "Opponent not found" }, { status: 404 });
        }
        if (opponent.xp < stake) {
            return NextResponse.json({ error: "Opponent does not have enough XP to accept this challenge" }, { status: 400 });
        }

        // Also check XP already committed in pending/active challenges
        const existingChallenges = await prisma.studyChallenge.findMany({
            where: {
                challengerId: session.user.id,
                status: { in: ['pending', 'active'] }
            },
            select: { xpStake: true }
        });
        const committedXp = existingChallenges.reduce((sum, c) => sum + c.xpStake, 0);

        if (user.xp - committedXp < stake) {
            return NextResponse.json({
                error: `Insufficient XP. You have ${user.xp} XP but ${committedXp} is already committed to other challenges.`
            }, { status: 400 });
        }

        // Create challenge AND deduct XP from challenger (escrow)
        const [challenge] = await prisma.$transaction([
            prisma.studyChallenge.create({
                data: {
                    challengerId: session.user.id,
                    challengedId: targetUserId,
                    challengeType: type,
                    xpStake: stake,
                    targetValue: targetValue,
                    targetProblemId: (type === 'leetcode_race') ? targetProblemId : undefined,
                    duration: duration,
                    status: 'pending'
                }
            }),
            // Deduct XP from challenger immediately (escrow)
            prisma.user.update({
                where: { id: session.user.id },
                data: { xp: { decrement: stake } }
            })
        ]);

        return NextResponse.json(challenge);
    } catch (error) {
        console.error('Create challenge error:', error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { challengeId, action } = await req.json();

        if (action === 'accept') {
            const challenge = await prisma.studyChallenge.findUnique({ where: { id: challengeId } });
            if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });

            // Verify challenged user
            if (challenge.challengedId !== session.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

            // Check if challenged user has enough XP stake (also check committed XP)
            const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { xp: true } });
            const existingChallenges = await prisma.studyChallenge.findMany({
                where: {
                    challengedId: session.user.id,
                    status: 'active'
                },
                select: { xpStake: true }
            });
            const committedXp = existingChallenges.reduce((sum: number, c: { xpStake: number }) => sum + c.xpStake, 0);

            if (!user || user.xp - committedXp < challenge.xpStake) {
                return NextResponse.json({ error: "Insufficient XP to accept challenge" }, { status: 400 });
            }

            // Accept AND deduct XP from challenged user (escrow)
            await prisma.$transaction([
                prisma.studyChallenge.update({
                    where: { id: challengeId },
                    data: {
                        status: 'active',
                        startsAt: new Date(),
                        endsAt: new Date(Date.now() + challenge.duration * 3600 * 1000)
                    }
                }),
                // Deduct XP from challenged user (escrow)
                prisma.user.update({
                    where: { id: session.user.id },
                    data: { xp: { decrement: challenge.xpStake } }
                })
            ]);
            return NextResponse.json({ success: true });
        } else if (action === 'decline') {
            const challenge = await prisma.studyChallenge.findUnique({ where: { id: challengeId } });
            if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });

            // Refund XP to challenger AND cancel challenge
            await prisma.$transaction([
                prisma.studyChallenge.update({
                    where: { id: challengeId },
                    data: { status: 'cancelled' }
                }),
                // Refund XP to challenger
                prisma.user.update({
                    where: { id: challenge.challengerId },
                    data: { xp: { increment: challenge.xpStake } }
                })
            ]);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
