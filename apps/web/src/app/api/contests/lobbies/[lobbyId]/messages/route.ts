
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

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

    const messages = await prisma.contestLobbyMessage.findMany({
        where: { lobbyId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    image: true,
                    email: true,
                },
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
                select: {
                    id: true,
                    name: true,
                    image: true,
                    email: true,
                },
            },
        },
    });

    return NextResponse.json(newMessage);
}
