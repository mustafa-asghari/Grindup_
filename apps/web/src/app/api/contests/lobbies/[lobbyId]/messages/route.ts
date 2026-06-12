
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const messageUserSelect = {
    id: true,
    name: true,
    image: true,
};

async function canAccessLobbyChat(lobbyId: string, userId: string) {
    const lobby = await prisma.contestLobby.findFirst({
        where: {
            id: lobbyId,
            OR: [
                { createdById: userId },
                { participants: { some: { userId } } },
            ],
        },
        select: { id: true },
    });

    return Boolean(lobby);
}

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ lobbyId: string }> }
) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { lobbyId } = params;

    if (!(await canAccessLobbyChat(lobbyId, session.user.id))) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const messages = await prisma.contestLobbyMessage.findMany({
        where: { lobbyId },
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
    props: { params: Promise<{ lobbyId: string }> }
) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { lobbyId } = params;

    if (!(await canAccessLobbyChat(lobbyId, session.user.id))) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const json = await request.json();
    const { message } = json;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return new NextResponse('Message required', { status: 400 });
    }

    const newMessage = await prisma.contestLobbyMessage.create({
        data: {
            lobbyId,
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
