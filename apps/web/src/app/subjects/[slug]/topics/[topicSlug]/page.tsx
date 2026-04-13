import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { TopicViewClient } from '@/components/subjects/topic-view-client';

interface PageProps {
    params: Promise<{ slug: string; topicSlug: string }>;
}

export default async function TopicPage({ params }: PageProps) {
    const { slug, topicSlug } = await params;
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
        redirect('/login');
    }

    // 1. Fetch Subject
    const subject = await prisma.subject.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true }
    });

    if (!subject) notFound();

    // 2. Fetch Topic with Exercises
    const topic = await prisma.subjectTopic.findFirst({
        where: {
            slug: topicSlug,
            subjectId: subject.id
        },
        include: {
            otherSubjecttopic: {
                orderBy: { order: 'asc' },
                include: {
                    userTopicProgress: {
                        where: { userId },
                        select: { status: true, masteryPercent: true }
                    },
                    exercise: {
                        include: {
                            exerciseAttempts: {
                                where: { userId },
                                orderBy: { createdAt: 'desc' },
                                take: 1
                            }
                        }
                    }
                }
            },
            exercise: {
                include: {
                    exerciseAttempts: {
                        where: { userId },
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }
                }
            },
            userTopicProgress: {
                where: { userId },
                select: { status: true, masteryPercent: true }
            }
        }
    });

    if (!topic) notFound();

    // 3. If topic is a child, fetch parent to get siblings context
    let rootTopic = topic;
    let initialTopicId = topic.id;

    if (topic.parentId) {
        const parent = await prisma.subjectTopic.findUnique({
            where: { id: topic.parentId },
            include: {
                otherSubjecttopic: {
                    orderBy: { order: 'asc' },
                    include: {
                        userTopicProgress: {
                            where: { userId },
                            select: { status: true, masteryPercent: true }
                        },
                        exercise: {
                            include: {
                                exerciseAttempts: {
                                    where: { userId },
                                    orderBy: { createdAt: 'desc' },
                                    take: 1
                                }
                            }
                        }
                    }
                },
                exercise: {
                    include: {
                        exerciseAttempts: {
                            where: { userId },
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    }
                },
                userTopicProgress: {
                    where: { userId },
                    select: { status: true, masteryPercent: true }
                }
            }
        });
        if (parent) {
            rootTopic = parent;
        }
    }

    // Fetch homework assignments for this topic
    const now = new Date();
    const homeworkAssignments = await prisma.homeworkAssignment.findMany({
        where: {
            userId,
            topicId: topic.id,
        },
        orderBy: [
            { dueDate: 'asc' },
            { createdAt: 'desc' },
        ],
        include: {
            subject: {
                select: { name: true, slug: true },
            },
        },
    });

    // Process homework to add computed fields
    const processedHomework = homeworkAssignments.map(a => {
        const dueDate = new Date(a.dueDate);
        const isLate = !a.completedAt && dueDate < now;
        const daysOverdue = isLate
            ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
            : 0;
        const latePenalty = isLate ? Math.min(50, daysOverdue * 5) : 0;

        return {
            id: a.id,
            title: a.title,
            description: a.description,
            type: a.assignmentType as 'exercise' | 'problem' | 'reading',
            subjectId: a.subjectId,
            subjectName: a.subject?.name || subject.name,
            subjectSlug: a.subject?.slug || subject.slug,
            dueDate: a.dueDate.toISOString(),
            estimatedMins: a.estimatedMins || 30,
            isLate,
            latePenalty,
            isCompleted: !!a.completedAt,
            xpReward: a.xpReward,
        };
    });

    const serializeExercise = (ex: any) => {
        const { exerciseAttempts, ...exerciseData } = ex;
        return {
            ...exerciseData,
            createdAt: exerciseData.createdAt?.toISOString(),
            updatedAt: exerciseData.updatedAt?.toISOString(),
            attempts: (exerciseAttempts || []).map((attempt: any) => ({
                ...attempt,
                createdAt: attempt.createdAt?.toISOString(),
            })),
        };
    };

    // Transform for client
    const serializeTopic = (t: any) => {
        const { otherSubjecttopic, exercise, userTopicProgress, ...topicData } = t;
        return {
            ...topicData,
            createdAt: topicData.createdAt?.toISOString(),
            updatedAt: topicData.updatedAt?.toISOString(),
            exercise: (exercise || []).map(serializeExercise),
            userProgress: userTopicProgress || [],
            children: (otherSubjecttopic || []).map(serializeTopic),
        };
    };

    const serializedRootTopic = serializeTopic(rootTopic);


    return (
        <TopicViewClient
            subject={subject}
            topic={serializedRootTopic}
            initialTopicId={initialTopicId}
            homework={processedHomework}
        />
    );
}
