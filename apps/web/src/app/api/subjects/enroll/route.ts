import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { subjectId, goalHoursPerWeek, targetDeadline } = await request.json();

        if (!subjectId) {
            return NextResponse.json(
                { error: 'Subject ID is required' },
                { status: 400 }
            );
        }

        // Check if subject exists
        const subject = await prisma.subject.findUnique({
            where: { id: subjectId, isActive: true },
        });

        if (!subject) {
            return NextResponse.json(
                { error: 'Subject not found' },
                { status: 404 }
            );
        }

        // Check if already enrolled
        const existingEnrollment = await prisma.userSubject.findUnique({
            where: {
                userId_subjectId: {
                    userId: session.user.id,
                    subjectId,
                },
            },
        });

        if (existingEnrollment) {
            return NextResponse.json(
                { error: 'Already enrolled in this subject' },
                { status: 409 }
            );
        }

        // Create enrollment
        const enrollment = await prisma.userSubject.create({
            data: {
                userId: session.user.id,
                subjectId,
                status: 'active',
                goalHoursPerWeek,
                targetDeadline: targetDeadline ? new Date(targetDeadline) : null,
            },
        });

        // Revalidate pages
        revalidatePath('/');
        revalidatePath('/subjects');

        return NextResponse.json({
            success: true,
            enrollment: {
                id: enrollment.id,
                subjectId: enrollment.subjectId,
                enrolledAt: enrollment.enrolledAt,
            },
        });
    } catch (error) {
        console.error('Error enrolling in subject:', error);
        return NextResponse.json(
            { error: 'Failed to enroll in subject' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const subjectId = searchParams.get('subjectId');

        if (!subjectId) {
            return NextResponse.json(
                { error: 'Subject ID is required' },
                { status: 400 }
            );
        }

        // Check if enrollment exists
        const enrollment = await prisma.userSubject.findUnique({
            where: {
                userId_subjectId: {
                    userId: session.user.id,
                    subjectId,
                },
            },
        });

        if (!enrollment) {
            return NextResponse.json(
                { error: 'Not enrolled in this subject' },
                { status: 404 }
            );
        }

        // Delete enrollment (this will also delete related progress)
        await prisma.userSubject.delete({
            where: {
                userId_subjectId: {
                    userId: session.user.id,
                    subjectId,
                },
            },
        });

        // Revalidate pages
        revalidatePath('/');
        revalidatePath('/subjects');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error unenrolling from subject:', error);
        return NextResponse.json(
            { error: 'Failed to unenroll from subject' },
            { status: 500 }
        );
    }
}
