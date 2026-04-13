import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { problemId, reason, details } = body;

    if (!problemId || !reason) {
        return NextResponse.json({ error: 'Missing problemId or reason' }, { status: 400 });
    }

    const exists = await prisma.problem.findUnique({ where: { id: problemId }, select: { id: true } });
    if (!exists) {
        return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    await prisma.problemReports.create({
        data: {
            id: uuidv4(),
            userId: session.user.id,
            problemId,
            reason,
            details,
            status: 'open',
        },
    });

    return NextResponse.json({ success: true });
}
