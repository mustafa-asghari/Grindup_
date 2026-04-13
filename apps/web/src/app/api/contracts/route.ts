import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Get learning contract for a subject
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const subjectId = url.searchParams.get('subjectId');

        if (!subjectId) {
            return NextResponse.json({ error: 'Subject ID required' }, { status: 400 });
        }

        const contract = await prisma.learningContracts.findFirst({
            where: {
                userId: session.user.id,
                subjectId: subjectId,
                isActive: true, // Assuming isActive is boolean and camelCase in Prisma JS client
            },
            orderBy: { signedAt: 'desc' },
        });

        return NextResponse.json(contract);
    } catch (error) {
        console.error('Contract fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch contract' }, { status: 500 });
    }
}

// Create or update learning contract
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { subjectId, weeklyHours, targetDate, goals } = body;

        if (!subjectId || !weeklyHours) {
            return NextResponse.json({ error: 'Subject ID and weekly hours required' }, { status: 400 });
        }

        // Verify subject enrollment
        const enrollment = await prisma.userSubject.findFirst({
            where: {
                userId: session.user.id,
                subjectId: subjectId,
            },
        });

        if (!enrollment) {
            return NextResponse.json({ error: 'Not enrolled in subject' }, { status: 403 });
        }

        // Deactivate any existing contracts for this subject
        // Deactivate any existing contracts for this subject
        await prisma.learningContracts.updateMany({
            where: {
                userId: session.user.id,
                subjectId: subjectId,
                isActive: true,
            },
            data: { isActive: false },
        });

        // Create new contract
        // Create new contract
        const contract = await prisma.learningContracts.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                subjectId: subjectId,
                weeklyHoursCommitment: weeklyHours,
                targetCompletionDate: targetDate ? new Date(targetDate) : null,
                goals: goals || [],
                isActive: true,
            },
        });

        // Log event
        // Log event
        await prisma.events.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                eventType: 'learning_contract_signed',
                payload: {
                    subjectId,
                    weeklyHours,
                    hasTargetDate: !!targetDate,
                    goalsCount: goals?.length || 0,
                },
            },
        });

        return NextResponse.json({
            success: true,
            contract: {
                id: contract.id,
                weeklyHoursCommitment: contract.weeklyHoursCommitment,
                targetCompletionDate: contract.targetCompletionDate?.toISOString(),
                goals: contract.goals,
                signedAt: contract.signedAt.toISOString(),
            },
        });
    } catch (error) {
        console.error('Contract create error:', error);
        return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 });
    }
}

// Update contract compliance (called by system)
export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { contractId, weeklyHoursActual } = body;

        if (!contractId) {
            return NextResponse.json({ error: 'Contract ID required' }, { status: 400 });
        }

        const contract = await prisma.learningContracts.findFirst({
            where: {
                id: contractId,
                userId: session.user.id,
            },
        });

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        // Calculate compliance rate
        const complianceRate = Math.min(100, (weeklyHoursActual / contract.weeklyHoursCommitment) * 100);
        const weeksCompliant = complianceRate >= 80
            ? contract.weeksCompliant + 1
            : contract.weeksCompliant;

        await prisma.learningContracts.update({
            where: { id: contractId },
            data: {
                weeksCompliant: weeksCompliant,
                complianceRate: complianceRate,
            },
        });

        return NextResponse.json({
            success: true,
            complianceRate,
            weeksCompliant,
            isOnTrack: complianceRate >= 80,
        });
    } catch (error) {
        console.error('Contract update error:', error);
        return NextResponse.json({ error: 'Failed to update contract' }, { status: 500 });
    }
}
