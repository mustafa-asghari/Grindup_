import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

// DEBUG endpoint to clean up duplicate/incorrect exercise attempts
// DELETE /api/debug/cleanup-attempts
export async function DELETE() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Delete all incorrect exercise attempts for this user
        // This is a cleanup for testing - remove duplicates
        const deleted = await prisma.exerciseAttempt.deleteMany({
            where: {
                userId: session.user.id,
                isCorrect: false
            }
        });

        return NextResponse.json({
            success: true,
            deletedCount: deleted.count,
            message: `Deleted ${deleted.count} incorrect attempts`
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        return NextResponse.json({ error: 'Failed to cleanup' }, { status: 500 });
    }
}
