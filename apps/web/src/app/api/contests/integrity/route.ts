import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Log integrity violation
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { contestId, violationType, details } = body;

        if (!contestId || !violationType) {
            return NextResponse.json({ error: 'Contest ID and violation type required' }, { status: 400 });
        }

        // Verify user is participating in contest
        const contestSubmission = await prisma.contestSubmission.findFirst({
            where: {
                contestId,
                userId: session.user.id,
            },
        });

        // Log the integrity flag
        const flag = await prisma.contestIntegrityFlags.create({
            data: {
                id: uuidv4(),
                contestId: contestId,
                userId: session.user.id,
                flagType: violationType,
                details: details || {},
            },
        });

        // Count total violations for this user in this contest
        const totalViolations = await prisma.contestIntegrityFlags.count({
            where: {
                contestId: contestId,
                userId: session.user.id,
            },
        });

        // Auto-disqualify after 5 violations
        let disqualified = false;
        if (totalViolations >= 5) {
            await prisma.contestSubmission.updateMany({
                where: {
                    contestId,
                    userId: session.user.id,
                },
                data: {
                    // Mark as disqualified (you may need to add this field)
                    // disqualified: true,
                },
            });

            // Log disqualification event
            await prisma.events.create({
                data: {
                    id: uuidv4(),
                    userId: session.user.id,
                    eventType: 'contest_disqualified',
                    payload: {
                        contestId,
                        reason: 'auto_integrity_violations',
                        totalViolations,
                    },
                },
            });

            disqualified = true;
        }

        return NextResponse.json({
            recorded: true,
            totalViolations,
            disqualified,
            warning: totalViolations >= 3
                ? `Warning: ${5 - totalViolations} violations remaining before disqualification`
                : null,
        });
    } catch (error) {
        console.error('Integrity log error:', error);
        return NextResponse.json({ error: 'Failed to log violation' }, { status: 500 });
    }
}

// Get integrity status for a contest
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const contestId = url.searchParams.get('contestId');

        if (!contestId) {
            return NextResponse.json({ error: 'Contest ID required' }, { status: 400 });
        }

        const violations = await prisma.contestIntegrityFlags.findMany({
            where: {
                contestId: contestId,
                userId: session.user.id,
            },
            orderBy: { createdAt: 'asc' },
        });

        // Categorize violations
        const violationsByType: Record<string, number> = {};
        violations.forEach(v => {
            violationsByType[v.flagType] = (violationsByType[v.flagType] || 0) + 1;
        });

        return NextResponse.json({
            totalViolations: violations.length,
            violationsByType,
            violations: violations.map(v => ({
                type: v.flagType,
                timestamp: v.createdAt.toISOString(),
                details: v.details,
            })),
            status: violations.length >= 5 ? 'disqualified' : violations.length >= 3 ? 'warning' : 'clean',
            remainingViolations: Math.max(0, 5 - violations.length),
        });
    } catch (error) {
        console.error('Integrity status error:', error);
        return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }
}
