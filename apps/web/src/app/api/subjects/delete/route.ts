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

        // Delete the subject (Cascade will handle topics, userSubjects, etc.)
        await prisma.subject.delete({
            where: { id: subjectId },
        });

        revalidatePath('/subjects');
        revalidatePath('/');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting subject:', error);
        return NextResponse.json(
            { error: 'Failed to delete subject' },
            { status: 500 }
        );
    }
}
