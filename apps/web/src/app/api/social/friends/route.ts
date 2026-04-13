
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userId = session.user.id;

        // Fetch all friendships
        const friendships = await prisma.friendship.findMany({
            where: {
                OR: [
                    { requesterId: userId },
                    { addresseeId: userId }
                ]
            },
            include: {
                requester: { select: { id: true, name: true, username: true, image: true, level: true, xp: true, skillRating: true } },
                addressee: { select: { id: true, name: true, username: true, image: true, level: true, xp: true, skillRating: true } }
            }
        });

        // Format response
        const friends = friendships.map(f => {
            const isRequester = f.requesterId === userId;
            const friend = isRequester ? f.addressee : f.requester;
            return {
                id: f.id,
                friendId: friend.id,
                name: friend.name || friend.username,
                image: friend.image,
                level: friend.level,
                xp: friend.xp,
                skillRating: friend.skillRating,
                status: f.status,
                isIncoming: !isRequester && f.status === 'pending'
            };
        });

        return NextResponse.json(friends);
    } catch (error) {
        console.error('Failed to fetch friends:', error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { targetUserId, action, friendshipId } = await req.json();

        if (action === 'send_request') {
            const exists = await prisma.friendship.findFirst({
                where: {
                    OR: [
                        { requesterId: session.user.id, addresseeId: targetUserId },
                        { requesterId: targetUserId, addresseeId: session.user.id }
                    ]
                }
            });

            if (exists) return NextResponse.json({ error: "Friendship already exists" }, { status: 400 });

            await prisma.friendship.create({
                data: {
                    requesterId: session.user.id,
                    addresseeId: targetUserId,
                    status: 'pending'
                }
            });

            return NextResponse.json({ success: true });
        } else if (action === 'accept') {
            await prisma.friendship.update({
                where: { id: friendshipId },
                data: { status: 'accepted' }
            });
            return NextResponse.json({ success: true });
        } else if (action === 'decline' || action === 'remove') {
            await prisma.friendship.delete({
                where: { id: friendshipId }
            });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error('Failed to manage friends:', error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
