
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const searchParams = new URL(req.url).searchParams;
        const targetId = searchParams.get('targetId');
        const before = searchParams.get('before'); // pagination cursor

        if (!targetId) return NextResponse.json({ error: "Missing targetId" }, { status: 400 });

        const messages = await prisma.directMessage.findMany({
            where: {
                OR: [
                    { senderId: session.user.id, receiverId: targetId },
                    { senderId: targetId, receiverId: session.user.id }
                ],
                createdAt: before ? { lt: new Date(before) } : undefined
            },
            orderBy: { createdAt: 'desc' }, // Latest first for pagination
            take: 50,
            include: {
                sender: { select: { id: true, name: true, image: true } }
            }
        });

        return NextResponse.json(messages.reverse()); // Return chronological
    } catch (error) {
        console.error('Fetch messages error:', error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { targetId, content } = await req.json();

        if (!targetId || !content) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

        const message = await prisma.directMessage.create({
            data: {
                senderId: session.user.id,
                receiverId: targetId,
                content,
                isRead: false
            }
        });

        return NextResponse.json(message);
    } catch (error) {
        console.error('Send message error:', error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
