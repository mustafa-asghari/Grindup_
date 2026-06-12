import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { openai } from '@/lib/openai';

type ContentPreferences = {
    style?: string;
    tone?: string;
    customInstructions?: string;
};

function formatPreferences(preferences?: ContentPreferences): string {
    if (!preferences) return '';
    const lines: string[] = [];
    if (preferences.style) lines.push(`Adjust difficulty for "${preferences.style}" learners.`);
    if (preferences.tone) lines.push(`Use a "${preferences.tone}" tone throughout.`);
    if (preferences.customInstructions) lines.push(`Apply user guidance: ${preferences.customInstructions}`);
    return lines.join('\n');
}

// Generate homework assignments for a topic
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { topicId, subjectId, topicName, content, daysUntilDue = 3, contentPreferences, isFinal } = body;

        if (!topicId || !subjectId || !topicName) {
            return NextResponse.json({ error: 'Topic ID, subject ID, and topic name are required' }, { status: 400 });
        }

        // Check if homework already exists for this topic
        const existingHomework = await prisma.homeworkAssignment.findFirst({
            where: {
                userId: session.user.id,
                topicId: topicId,
                completedAt: null,
            },
        });

        if (existingHomework) {
            return NextResponse.json({
                success: false,
                error: 'Homework already exists for this topic',
                existingAssignment: {
                    id: existingHomework.id,
                    title: existingHomework.title,
                },
            }, { status: 400 });
        }

        // If final, gather subtopic content
        let contextContent = content || '';
        if (isFinal) {
            const subtopics = await prisma.subjectTopic.findMany({
                where: { parentId: topicId },
                select: { name: true, content: true }
            });
            if (subtopics.length > 0) {
                contextContent = subtopics.map(s => `## Subtopic: ${s.name}\n${s.content?.substring(0, 2000) || '(No content)'}`).join('\n\n');
            }
        }

        // Generate homework using AI
        const preferencesText = formatPreferences(contentPreferences as ContentPreferences);

        const prompt = `You are an educational content creator. Create a ${isFinal ? 'massive CAPSTONE/FINAL' : 'regular'} homework assignment for a student learning about "${topicName}".

${contextContent ? `Lesson Content:\n${contextContent.substring(0, 50000)}` : ''}
${preferencesText ? `\nFollow these user preferences:\n${preferencesText}\n` : ''}
${isFinal ? `\nCRITICAL: This is the Final Exam/Homework for the entire module.
1. It MUST be longer and harder than normal.
2. It MUST include at least 10 distinct questions/problems.
3. It MUST cover every subtopic listed in the content.` : ''}

Generate a homework assignment in JSON format:
{
    "title": "Brief title (max 50 chars)",
    "description": "Well-formatted markdown description (see format rules below)",
    "type": "exercise" | "problem" | "reading",
    "estimatedMins": 15-60,
    "xpReward": 30-100
}

CRITICAL - DESCRIPTION MUST BE PROPERLY FORMATTED MARKDOWN:

Use this exact structure with proper line breaks (use \\n\\n for paragraph breaks):

"description": "Brief intro paragraph explaining the assignment goal.\\n\\n## Materials\\n\\n(REQUIRED: If your instructions say 'read the text', YOU must paste the text here. If you don't have text, do NOT ask them to read something. Instead, ask them to research online or solve a problem based on general knowledge.)\\n\\n## Instructions\\n\\n1. **First Task**: Clear description of what to do\\n\\n2. **Second Task**: Clear description of what to do\\n\\n## Questions\\n\\n1. First question to answer?\\n\\n2. Second question to answer?\\n\\n... (Continue to at least 10 if Final)\\n\\n## Guidelines\\n\\n- Keep answers concise but comprehensive\\n- Show your work where applicable"

FORMATTING RULES:
- **NO PLACEHOLDERS**: Never say "refer to the provided materials" if you didn't provide them in the ## Materials section.
- If lesson content is missing/empty, create a **Research Assignment** where the user must find the info themselves, or a **Thought Experiment** based on the topic name.
- Use ## for section headers (Materials, Instructions, Questions, Guidelines)
- Use numbered lists (1. 2. 3.) for sequential tasks/questions
- Use bullet points (- ) for guidelines or tips
- Use **bold** for task names and key terms
- Add \\n\\n between every section, list item, and paragraph
- MATH FORMATTING:
  - Inline math: $x$ (single variables only)
  - Display math: $$\\int f(x)dx$$ (for ALL formulas)
  - STRICTLY separate math from text with blank lines (\\n\\n)
  - NEVER mix math formulas with non-math text in the same line
  - Use display math ($$ ... $$) to center all equations
- Keep total length ${isFinal ? '400-800' : '150-300'} words

Return only valid JSON.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            max_tokens: isFinal ? 3000 : 800,
        });

        const generatedContent = completion.choices[0]?.message?.content;
        if (!generatedContent) {
            throw new Error('No content generated');
        }

        const homework = JSON.parse(generatedContent);

        // Calculate due date
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + daysUntilDue);
        dueDate.setHours(23, 59, 59, 999);

        // Create the homework assignment
        const assignment = await prisma.homeworkAssignment.create({
            data: {
                id: uuidv4(),
                userId: session.user.id,
                subjectId: subjectId,
                topicId: topicId,
                title: homework.title || `${topicName} Assignment`,
                description: homework.description,
                assignmentType: homework.type || 'exercise',
                dueDate: dueDate,
                estimatedMins: homework.estimatedMins || 30,
                xpReward: homework.xpReward || 50,
            },
        });

        // Create reminder for 24h before due date
        const reminderDate = new Date(dueDate);
        reminderDate.setHours(reminderDate.getHours() - 24);

        if (reminderDate > new Date()) {
            await prisma.homeworkReminders.create({
                data: {
                    id: uuidv4(),
                    homeworkId: assignment.id,
                    reminderType: 'before_due',
                    scheduledFor: reminderDate,
                },
            });
        }

        return NextResponse.json({
            success: true,
            assignment: {
                id: assignment.id,
                title: assignment.title,
                description: assignment.description,
                type: assignment.assignmentType,
                dueDate: assignment.dueDate.toISOString(),
                estimatedMins: assignment.estimatedMins,
                xpReward: assignment.xpReward,
            },
        });
    } catch (error) {
        console.error('Homework generation error:', error);
        return NextResponse.json({ error: 'Failed to generate homework' }, { status: 500 });
    }
}
