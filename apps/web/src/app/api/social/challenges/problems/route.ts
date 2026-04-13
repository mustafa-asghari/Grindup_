
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const problems = await prisma.problem.findMany({
            // No status filter - show ALL problems
            select: {
                id: true,
                title: true,
                difficulty: true
            },
            orderBy: { title: 'asc' }
            // No limit - show ALL problems
        });

        console.log(`Found ${problems.length} problems for challenge selector`);

        return NextResponse.json(problems);
    } catch (error) {
        console.error('Fetch problems error:', error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
