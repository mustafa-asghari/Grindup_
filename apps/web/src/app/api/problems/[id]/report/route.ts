import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { v4 as uuidv4 } from 'uuid';

// Report a problem
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id: problemId } = await params;
        const body = await request.json();
        const { reason, details } = body;

        // Rate limit check (5 reports per hour)
        const rateLimit = await checkRateLimit(session.user.id, 'report');
        if (!rateLimit.allowed) {
            return NextResponse.json({
                error: 'Too many reports. Please try again later.',
                resetAt: rateLimit.resetAt,
            }, { status: 429 });
        }

        // Verify problem exists
        // Verify problem exists
        const problem = await prisma.problem.findUnique({
            where: { id: problemId },
        });

        if (!problem) {
            return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
        }

        // Check for duplicate report
        // Check for duplicate report
        const existingReport = await prisma.problemReports.findFirst({
            where: {
                problemId: problemId,
                userId: session.user.id,
                status: { in: ['open', 'investigating'] },
            },
        });

        if (existingReport) {
            return NextResponse.json({
                error: 'You already have an open report for this problem',
                reportId: existingReport.id,
            }, { status: 409 });
        }

        // Create the report
        // Create the report
        const report = await prisma.problemReports.create({
            data: {
                id: uuidv4(),
                problemId: problemId,
                userId: session.user.id,
                reason,
                details,
                status: 'open',
            },
        });

        // Log as event for admin dashboard
        // Log as event for admin dashboard
        await prisma.events.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                eventType: 'problem_report',
                payload: {
                    reportId: report.id,
                    problemId,
                    problemTitle: problem.title,
                    reason,
                },
            },
        });

        return NextResponse.json({
            success: true,
            reportId: report.id,
            message: 'Thank you for your report. Our team will review it shortly.',
        });
    } catch (error) {
        console.error('Problem report error:', error);
        return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
    }
}

// Get reports for a problem (admin only)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (you'll need to implement this check)
    // For now, we'll just return the user's own reports
    try {
        const { id: problemId } = await params;

        const reports = await prisma.problemReports.findMany({
            where: {
                problemId: problemId,
                userId: session.user.id,
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(reports);
    } catch (error) {
        console.error('Fetch reports error:', error);
        return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
    }
}
