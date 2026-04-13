import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { openai } from '@/lib/openai';
import { v4 as uuidv4 } from 'uuid';

type DiagnosticAnswer = {
    topicId?: string;
    topicName?: string;
    score: number;
};

async function resolveTopicId(answer: DiagnosticAnswer): Promise<string | null> {
    if (answer.topicId) return answer.topicId;
    if (!answer.topicName) return null;
    const topic = await prisma.topic.findUnique({ where: { name: answer.topicName } });
    return topic?.id ?? null;
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await prisma.onboardingProfile.findUnique({
        where: { userId: session.user.id },
    });

    const starterTasks = await prisma.starterTasks.findMany({
        where: { userId: session.user.id },
        include: { problem: { select: { title: true, difficulty: true } } },
    });

    return NextResponse.json({
        profile,
        starterTasks,
    });
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user exists in DB to prevent foreign key errors
    const userExists = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true },
    });

    if (!userExists) {
        return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const body = await req.json();
    const {
        goal,
        hoursPerWeek,
        deadline,
        difficultyPreference,
        learningStyle,
        aiPersona,
        diagnosticAnswers = [],
        status = 'complete',
    } = body;

    const answers: DiagnosticAnswer[] = Array.isArray(diagnosticAnswers) ? diagnosticAnswers : [];

    // Map diagnostic answers to topic IDs and baseline scores
    const baselineEntries: { topicId: string; score: number }[] = [];
    for (const ans of answers) {
        const topicId = await resolveTopicId(ans);
        if (!topicId) continue;
        baselineEntries.push({ topicId, score: ans.score });
    }

    // Upsert onboarding profile
    // Upsert onboarding profile
    const profile = await prisma.onboardingProfile.upsert({
        where: { userId: session.user.id },
        update: {
            goal,
            hoursPerWeek,
            deadline: deadline ? new Date(deadline) : null,
            difficultyPreference,
            learningStyle,
            aiPersona,
            track: null,
            diagnosticResponses: answers,
            baselineMastery: baselineEntries,
            status,
            updatedAt: new Date(),
        },
        create: {
            userId: session.user.id,
            goal,
            hoursPerWeek,
            deadline: deadline ? new Date(deadline) : null,
            difficultyPreference,
            learningStyle,
            aiPersona,
            track: null,
            diagnosticResponses: answers,
            baselineMastery: baselineEntries,
            status,
            updatedAt: new Date(),
        },
    });

    // Create a Subject based on Goal
    if (goal) {
        const slug = goal.toLowerCase().slice(0, 50).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'my-goal';
        const subjectName = goal.slice(0, 30); // Truncate to avoid errors

        // Check if subject exists
        let subject = await prisma.subject.findUnique({ where: { slug } });

        if (!subject) {
            subject = await prisma.subject.create({
                data: {
                    name: subjectName,
                    slug: slug,
                    description: `Custom subject for goal: ${goal}`,
                    category: 'professional',
                    isActive: true,
                    updatedAt: new Date(),
                }
            });
        }

        // Enroll user in subject
        await prisma.userSubject.upsert({
            where: { userId_subjectId: { userId: session.user.id, subjectId: subject.id } },
            update: {},
            create: {
                userId: session.user.id,
                subjectId: subject.id,
                status: 'active',
                goalHoursPerWeek: typeof hoursPerWeek === 'number' ? hoursPerWeek : 5,
                targetDeadline: deadline ? new Date(deadline) : null,
            }
        });

        // Create a Roadmap
        await prisma.roadmaps.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                goal: goal,
                hoursPerWeek: Number(hoursPerWeek) || 5,
                deadline: deadline ? new Date(deadline) : undefined,
                isActive: true,
            }
        }).catch((err: any) => console.log('Roadmap creation failed (optional):', err));

        // Generate Topics via AI
        try {
            const timeContext = `
            Constraints:
            - Study Time: ${hoursPerWeek || 5} hours/week
            - Deadline: ${deadline ? new Date(deadline).toLocaleDateString() : 'None (Self-paced)'}
            
            Adjust the curriculum scope accordingly:
            - If time is tight, focus ONLY on critical "must-know" topics.
            - If time is abundant, include advanced topics and deep dives.
            - Ensure the number of topics fits the schedule (approx 1 topic per week usually, or more intensive if short deadline).
            `;

            const topicPrompt = `Generate a structured learning path with topics for a course on: "${goal}".
            Target audience: Beginner to Intermediate.
            ${timeContext}
            
            Output STRICT JSON array: [{ "name": "Topic Title", "description": "Short summary", "estimatedMins": 60, "slug": "topic-slug" }].
            Ensure slugs are url-friendly and unique.`;

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: 'You are a curriculum designer.' }, { role: 'user', content: topicPrompt }],
                temperature: 0.7,
            });

            const content = completion.choices[0].message.content || '[]';
            const jsonStr = content.replace(/^```json\s*|\s*```$/g, '').trim();
            const topics = JSON.parse(jsonStr);

            if (Array.isArray(topics)) {
                for (let i = 0; i < topics.length; i++) {
                    const t = topics[i];
                    const tSlug = (t.slug || t.name.toLowerCase().slice(0, 40).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) + '-' + i;

                    // Generate actual lesson content for this topic
                    let topicContent = `# ${t.name}\n\n${t.description || 'Learn about this topic.'}\n\n*Content is being generated...*`;

                    try {
                        const lessonPrompt = `Create a comprehensive lesson on "${t.name}" for the course "${goal}".
${aiPersona ? `ADOPT PERSONA: ${aiPersona}` : ''}
Use LaTeX for ALL math equations. Enclose inline math in single $ delimiters (e.g., $E=mc^2$) and block math in double $$ delimiters. Do NOT use \\( ... \\) or \\[ ... \\].

FORMAT:
## Introduction
Brief explanation of why this topic matters.

## Core Concepts
Main ideas explained clearly with bullet points.

## Key Points
- Important takeaway 1
- Important takeaway 2
- Important takeaway 3

## Visual Concepts
Provide a Mermaid diagram (graph TD or sequenceDiagram) or ASCII art to visualize the core concept. Wrap in code block.

## Examples
Practical examples where applicable.

## Summary
Key takeaways in 2-3 sentences.

Use markdown formatting. Be educational and engaging.`;

                        const lessonCompletion = await openai.chat.completions.create({
                            model: 'gpt-4o-mini',
                            messages: [
                                { role: 'system', content: 'You are a world-class educator creating lesson content.' },
                                { role: 'user', content: lessonPrompt }
                            ],
                            temperature: 0.7,
                        });

                        topicContent = lessonCompletion.choices[0].message.content || topicContent;
                    } catch (lessonError) {
                        console.warn(`Failed to generate content for topic ${t.name}:`, lessonError);
                    }

                    const createdTopic = await prisma.subjectTopic.upsert({
                        where: { subjectId_slug: { subjectId: subject.id, slug: tSlug } },
                        create: {
                            subjectId: subject.id,
                            name: t.name,
                            slug: tSlug,
                            description: t.description || '',
                            estimatedMins: t.estimatedMins || 60,
                            level: 1,
                            order: i + 1,
                            content: topicContent,
                        },
                        update: {}
                    });

                    // Generate Quiz and Flashcards
                    try {
                        const quizPrompt = `Create learning activities for the topic "${t.name}".
                        Context: ${t.description}
                        
                        Output STRICT JSON:
                        {
                            "questions": [
                                { "question": "Q?", "options": ["A", "B", "C", "D"], "correctAnswers": [0], "explanation": "Why correct" }
                            ],
                            "flashcards": [
                                { "front": "Concept", "back": "Definition" }
                            ]
                        }
                        Include 2-3 of each.`;

                        const quizCompletion = await openai.chat.completions.create({
                            model: 'gpt-4o-mini',
                            messages: [{ role: 'system', content: 'You are an educational content generator.' }, { role: 'user', content: quizPrompt }],
                            temperature: 0.7,
                            response_format: { type: 'json_object' }
                        });

                        const quizJson = JSON.parse(quizCompletion.choices[0].message.content || '{}');

                        if (quizJson.questions && Array.isArray(quizJson.questions)) {
                            for (const q of quizJson.questions) {
                                await prisma.exercise.create({
                                    data: {
                                        id: crypto.randomUUID(),
                                        subjectId: subject.id,
                                        topicId: createdTopic.id,
                                        title: 'Quiz: ' + t.name,
                                        type: 'mcq',
                                        content: q,
                                        difficulty: 'medium',
                                        points: 10,
                                        updatedAt: new Date(),
                                    }
                                });
                            }
                        }

                        if (quizJson.flashcards && Array.isArray(quizJson.flashcards)) {
                            for (const fc of quizJson.flashcards) {
                                await prisma.exercise.create({
                                    data: {
                                        id: crypto.randomUUID(),
                                        subjectId: subject.id,
                                        topicId: createdTopic.id,
                                        title: 'Flashcard: ' + t.name,
                                        type: 'flashcard',
                                        content: { front: fc.front, back: fc.back },
                                        difficulty: 'medium',
                                        points: 5,
                                        updatedAt: new Date(),
                                    }
                                });
                            }
                        }

                    } catch (genError) {
                        console.warn(`Failed to generate activities for ${t.name}`, genError);
                    }
                }
            }
        } catch (e) {
            console.error("Failed to generate topics", e);
        }
    }

    // Update user knowledge graph (using correct model name)
    // skipping topic checks if topic IDs are missing
    for (const { topicId, score } of baselineEntries) {
        if (!topicId) continue;
        const confidence = Math.max(0, Math.min(1, score / 10));
        const statusLabel = score >= 8 ? 'mastered' : score >= 5 ? 'known' : score >= 3 ? 'learning' : 'unknown';

        const existing = await prisma.userKnowledgeGraph.findFirst({
            where: { userId: session.user.id, topicId },
        });

        if (existing) {
            await prisma.userKnowledgeGraph.update({
                where: { id: existing.id },
                data: { confidence, status: statusLabel, lastAssessed: new Date() },
            });
        } else {
            await prisma.userKnowledgeGraph.create({
                data: {
                    id: uuidv4(), // Assuming UUID
                    userId: session.user.id,
                    topicId,
                    confidence,
                    status: statusLabel,
                    lastAssessed: new Date(),
                },
            });
        }
    }

    // Seed starter tasks if none
    const existingStarter = await prisma.starterTasks.findMany({ where: { userId: session.user.id } }); // Correct model name
    if (existingStarter.length === 0) {
        const starterProblems = await prisma.problem.findMany({
            take: 3,
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        });
        for (const p of starterProblems) {
            await prisma.starterTasks.create({ // Correct model name
                data: {
                    id: uuidv4(),
                    userId: session.user.id,
                    problemId: p.id,
                    status: 'pending'
                }
            });
        }
    }

    return NextResponse.json({ success: true, profile });
}
