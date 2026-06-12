import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { subjectId } = await request.json();

        if (!subjectId) {
            return NextResponse.json({ error: 'Subject ID is required' }, { status: 400 });
        }

        const result = await prisma.userSubject.deleteMany({
            where: {
                userId: session.user.id,
                subjectId,
            },
        });

        if (result.count === 0) {
            return NextResponse.json(
                { error: 'Subject enrollment not found' },
                { status: 404 }
            );
        }

        revalidatePath('/subjects');
        revalidatePath('/');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing subject enrollment:', error);
        return NextResponse.json(
            { error: 'Failed to remove subject enrollment' },
            { status: 500 }
        );
    }
}
