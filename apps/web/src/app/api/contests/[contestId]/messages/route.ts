
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const messageUserSelect = {
    id: true,
    name: true,
    image: true,
};

async function canAccessContestChat(contestId: string, userId: string) {
    const contest = await prisma.contest.findFirst({
        where: {
            id: contestId,
            OR: [
                { createdById: userId },
                { participants: { some: { userId } } },
            ],
        },
        select: { id: true },
    });

    return Boolean(contest);
}

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ contestId: string }> }
) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { contestId } = params;

    if (!(await canAccessContestChat(contestId, session.user.id))) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const messages = await prisma.contestMessage.findMany({
        where: { contestId },
        include: {
            user: {
                select: messageUserSelect,
            },
        },
        orderBy: {
            createdAt: 'asc',
        },
        take: 100,
    });

    return NextResponse.json(messages);
}

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ contestId: string }> }
) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { contestId } = params;

    if (!(await canAccessContestChat(contestId, session.user.id))) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const json = await request.json();
    const { message } = json;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return new NextResponse('Message required', { status: 400 });
    }

    const newMessage = await prisma.contestMessage.create({
        data: {
            contestId,
            userId: session.user.id,
            message: message.trim(),
        },
        include: {
            user: {
                select: messageUserSelect,
            },
        },
    });

    return NextResponse.json(newMessage);
}
