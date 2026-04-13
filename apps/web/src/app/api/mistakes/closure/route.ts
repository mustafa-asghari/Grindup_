import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Record a mistake closure
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { mistakeCardId, closureType, closureNote, thenCode, nowCode } = body;

        // Verify the mistake card belongs to this user
        const mistakeCard = await prisma.mistakeCards.findUnique({
            where: { id: mistakeCardId },
        });

        if (!mistakeCard || mistakeCard.userId !== session.user.id) {
            return NextResponse.json({ error: 'Mistake not found' }, { status: 404 });
        }

        // Create closure record
        const closure = await prisma.mistakeClosures.create({
            data: {
                id: uuidv4(),
                mistakeCardId: mistakeCardId,
                userId: session.user.id,
                closureType: closureType,
                closureNote: closureNote,
                thenCode: thenCode,
                nowCode: nowCode,
            },
        });

        // If marked as "understood", update the mistake card
        if (closureType === 'understood') {
            await prisma.mistakeCards.update({
                where: { id: mistakeCardId },
                data: { mastered: true },
            });
        }

        return NextResponse.json(closure);
    } catch (error) {
        console.error('Mistake closure error:', error);
        return NextResponse.json({ error: 'Failed to create closure' }, { status: 500 });
    }
}

// Get closures for the current user
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const closures = await prisma.mistakeClosures.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        return NextResponse.json(closures);
    } catch (error) {
        console.error('Mistake closures fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch closures' }, { status: 500 });
    }
}
