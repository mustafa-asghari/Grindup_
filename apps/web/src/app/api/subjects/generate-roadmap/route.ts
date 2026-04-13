import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { subjectId, goalHoursPerWeek, targetDeadline, diagnosticResults } = await request.json();

        if (!subjectId) {
            return NextResponse.json({ error: 'Subject ID required' }, { status: 400 });
        }

        // 1. Ensure Enrollment Exists (or create/update it)
        // We use upsert-like logic via create or update
        const existingEnrollment = await prisma.userSubject.findUnique({
            where: {
                userId_subjectId: {
                    userId: session.user.id,
                    subjectId,
                },
            },
        });

        if (!existingEnrollment) {
            await prisma.userSubject.create({
                data: {
                    id: crypto.randomUUID(),
                    userId: session.user.id,
                    subjectId,
                    status: 'active',
                    goalHoursPerWeek,
                    targetDeadline: targetDeadline ? new Date(targetDeadline) : null,
                },
            });
        } else {
            // Update goals if re-running setup
            await prisma.userSubject.update({
                where: { id: existingEnrollment.id },
                data: {
                    goalHoursPerWeek,
                    targetDeadline: targetDeadline ? new Date(targetDeadline) : null,
                },
            });
        }

        // 2. Process Diagnostic Results
        if (diagnosticResults && Array.isArray(diagnosticResults)) {
            // Fetch all topics for the subject to match against
            const topics = await prisma.subjectTopic.findMany({
                where: { subjectId },
                select: { id: true, name: true },
            });

            const updates = [];

            for (const result of diagnosticResults) {
                const { topicName, topicId, score } = result; // score 0-10

                let targetTopicId = topicId;

                // Fallback to fuzzy matching if no ID provided (e.g. from generic questions)
                if (!targetTopicId) {
                    const normalizedResultName = topicName.toLowerCase();
                    const match = topics.find((t: any) =>
                        t.name.toLowerCase().includes(normalizedResultName) ||
                        normalizedResultName.includes(t.name.toLowerCase())
                    );
                    if (match) {
                        targetTopicId = match.id;
                    }
                }

                if (targetTopicId) {
                    let status = 'not_started';
                    let mastery = 0;

                    if (score <= 4) {
                        status = 'focus'; // Weak-spot
                        mastery = Math.max(0, score * 10);
                    } else if (score >= 8) {
                        status = 'mastered';
                        mastery = 100;
                    } else {
                        status = 'in_progress';
                        mastery = score * 10;
                    }

                    updates.push(prisma.userTopicProgress.upsert({
                        where: {
                            userId_topicId: {
                                userId: session.user.id,
                                topicId: targetTopicId,
                            },
                        },
                        update: {
                            masteryPercent: mastery,
                            status: status,
                            lastPracticed: new Date(),
                        },
                        create: {
                            id: crypto.randomUUID(),
                            userId: session.user.id,
                            topicId: targetTopicId,
                            masteryPercent: mastery,
                            status: status,
                            lastPracticed: new Date(),
                        },
                    }));
                }
            }

            if (updates.length > 0) {
                await prisma.$transaction(updates);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Roadmap generation failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
