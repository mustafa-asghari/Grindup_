
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const searchParams = new URL(req.url).searchParams;
        const query = searchParams.get('q');

        if (!query || query.length < 3) {
            return NextResponse.json([]);
        }

        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: query, mode: 'insensitive' } },
                    { name: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } }
                ],
                NOT: {
                    id: session.user.id
                }
            },
            take: 10,
            select: {
                id: true,
                username: true,
                name: true,
                image: true,
                level: true,
                xp: true
            }
        });

        return NextResponse.json(users);
    } catch (error) {
        console.error('Failed to search users:', error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
