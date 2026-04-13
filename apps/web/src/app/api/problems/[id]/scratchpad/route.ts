import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Create/update problem scratchpad
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id: problemId } = await params;
        const body = await request.json();
        const { notes, approach } = body;

        const scratchpad = await prisma.problemScratchpads.upsert({
            where: {
                userId_problemId: {
                    userId: session.user.id,
                    problemId: problemId,
                },
            },
            update: {
                notes: notes ?? undefined,
                approach: approach ?? undefined,
            },
            create: {
                id: uuidv4(),
                userId: session.user.id,
                problemId: problemId,
                notes: notes || '',
                approach: approach || '',
                updatedAt: new Date(),
            },
        });

        return NextResponse.json(scratchpad);
    } catch (error) {
        console.error('Scratchpad save error:', error);
        return NextResponse.json({ error: 'Failed to save scratchpad' }, { status: 500 });
    }
}

// Get problem scratchpad
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id: problemId } = await params;

        const scratchpad = await prisma.problemScratchpads.findUnique({
            where: {
                userId_problemId: {
                    userId: session.user.id,
                    problemId: problemId,
                },
            },
        });

        if (!scratchpad) {
            return NextResponse.json({ notes: '', approach: '' });
        }

        return NextResponse.json(scratchpad);
    } catch (error) {
        console.error('Scratchpad fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch scratchpad' }, { status: 500 });
    }
}
