import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkCSRF } from '@/lib/csrf';
import { logSecurityEvent } from '@/lib/logging';
import { headers } from 'next/headers';
import OpenAI from 'openai';

const getOpenAI = () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
    }
    return new OpenAI({ apiKey });
};

type ContentPreferences = {
    style?: string;
    tone?: string;
    customInstructions?: string;
};

function formatPreferences(preferences?: ContentPreferences): string {
    if (!preferences) return '';
    const lines: string[] = [];
    if (preferences.style) lines.push(`Match difficulty to "${preferences.style}" learners.`);
    if (preferences.tone) lines.push(`Use a "${preferences.tone}" tone in wording.`);
    if (preferences.customInstructions) lines.push(`Apply user guidance: ${preferences.customInstructions}`);
    return lines.join('\n');
}

type MCQ = {
    question: string;
    options: string[];
    correctAnswers: Array<number | string>;
    explanation?: string;
};

function normalizeMCQ(raw: any): MCQ | null {
    if (!raw) return null;
    const optionsRaw = Array.isArray(raw.options) ? raw.options : [];
    let options: string[] = optionsRaw.map((o: any) => (o ?? '').toString().trim()).filter(Boolean);

    if (options.length === 1) {
        // Split condensed options like "14 15 16 18" or "14, 15, 16, 18"
        const splitByComma = options[0].split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
        if (splitByComma.length > 1) {
            options = splitByComma;
        } else {
            const numbers = options[0].match(/\d+/g);
            if (numbers && numbers.length > 1) {
                options = numbers;
            }
        }
    }

    if (options.length < 2) {
        options = ['True', 'False'];
    }

    const lowerOptions = options.map(o => o.toLowerCase());

    const correctRaw: Array<number | string> = Array.isArray(raw.correctAnswers)
        ? raw.correctAnswers
        : raw.correctAnswer
            ? [raw.correctAnswer]
            : [];

    const normalizedIndices: number[] = [];

    const addIfValid = (idx: number) => {
        if (Number.isInteger(idx) && idx >= 0 && idx < options.length && !normalizedIndices.includes(idx)) {
            normalizedIndices.push(idx);
        }
    };

    for (const entry of correctRaw) {
        if (typeof entry === 'number') {
            addIfValid(entry);
            continue;
        }
        const value = entry?.toString().trim();
        if (!value) continue;
        const lower = value.toLowerCase();

        // Letter choices (A, B, C, D)
        if (/^[a-d]$/.test(lower)) {
            addIfValid(lower.charCodeAt(0) - 'a'.charCodeAt(0));
            continue;
        }

        // Check if this is a numeric value - prioritize matching by option text first
        // This handles cases where AI returns correctAnswer: "1" meaning the VALUE "1", not index 1
        const numIndex = Number.parseInt(lower, 10);
        if (!Number.isNaN(numIndex)) {
            // First, try to match by option text (e.g., if options are ["0", "1", "2", "3"] and answer is "1")
            const idxByValue = lowerOptions.indexOf(lower);
            if (idxByValue !== -1) {
                addIfValid(idxByValue);
                continue;  // Found by value match, don't also add as index
            }
            // If no value match, treat as index (e.g., if options are ["A", "B", "C", "D"] and answer is 1)
            addIfValid(numIndex);
            continue;
        }

        // Match by option text
        const idx = lowerOptions.indexOf(lower);
        if (idx !== -1) {
            addIfValid(idx);
        }
    }

    if (normalizedIndices.length === 0) {
        // Try to infer from explanation if it contains a matching option
        const explanation = raw.explanation?.toString() || '';
        const numberHint = explanation.match(/\d+/g);
        if (numberHint) {
            for (const hint of numberHint) {
                const idx = options.findIndex(o => o.includes(hint));
                if (idx !== -1) {
                    addIfValid(idx);
                    break;
                }
            }
        }
    }

    if (normalizedIndices.length === 0) {
        addIfValid(0);
    }

    return {
        question: raw.question?.toString() || 'Question content missing',
        options,
        correctAnswers: normalizedIndices,
        explanation: raw.explanation?.toString(),
    };
}

async function getRelevantSourceContent(subjectId: string, topicName: string, openai: OpenAI): Promise<string> {
    const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        select: { sourceContent: true, name: true }
    });

    if (subject?.sourceContent && subject.sourceContent.length > 100) {
        const vectors = await prisma.subjectVectors.findMany({
            where: { subjectId },
            select: { content: true, embedding: true }
        });

        if (vectors.length > 0) {
            try {
                const topicEmbedding = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: topicName,
                });
                const queryVector = topicEmbedding.data[0].embedding;

                const scoredChunks = vectors.map(v => {
                    const dotProduct = v.embedding.reduce((sum, val, i) => sum + val * queryVector[i], 0);
                    const normA = Math.sqrt(v.embedding.reduce((sum, val) => sum + val * val, 0));
                    const normB = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0));
                    const similarity = dotProduct / (normA * normB);
                    return { content: v.content, similarity };
                });

                scoredChunks.sort((a, b) => b.similarity - a.similarity);
                const relevantContent = scoredChunks.slice(0, 5).map(c => c.content).join('\n\n---\n\n');
                if (relevantContent.length > 200) return relevantContent;
            } catch (e) {
                console.warn('Vector search failed, using full content:', e);
            }
        }
        return subject.sourceContent.substring(0, 15000);
    }
    return '';
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';

    const csrfValid = await checkCSRF();
    if (!csrfValid) {
        logSecurityEvent({ type: 'csrf_failure', userId: session.user.id, ip, route: '/api/topics/generate-quiz', status: 403 });
        return NextResponse.json({ error: 'Forbidden: CSRF check failed' }, { status: 403 });
    }

    const rateLimit = await checkRateLimit(session.user.id, 'quiz_gen', { windowMs: 60 * 1000, maxRequests: 15 }, ip);
    if (!rateLimit.allowed) {
        logSecurityEvent({ type: 'rate_limit', userId: session.user.id, ip, route: '/api/topics/generate-quiz', status: 429 });
        return NextResponse.json({ error: 'Too many requests. Please wait a minute.', resetAt: rateLimit.resetAt }, { status: 429 });
    }

    try {
        const { topicId, topicName, content, force, contentPreferences } = await request.json();

        if (!topicId) {
            return NextResponse.json({ error: 'Topic ID required' }, { status: 400 });
        }

        if (!force) {
            const existing = await prisma.exercise.findMany({
                where: { topicId, isActive: true },
                orderBy: { createdAt: 'asc' }
            });
            if (existing.length > 0) {
                return NextResponse.json({ success: true, exercises: existing, reused: true });
            }
        } else {
            // Delete existing exercises to avoid duplication
            await prisma.exercise.deleteMany({
                where: { topicId }
            });
        }

        const topic = await prisma.subjectTopic.findUnique({
            where: { id: topicId },
            select: { name: true, content: true, subjectId: true, description: true }
        });
        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        const actualTopicName = topicName || topic.name;
        const openai = getOpenAI();
        const sourceContent = await getRelevantSourceContent(topic.subjectId, actualTopicName, openai);
        const hasSourceContent = sourceContent && sourceContent.length > 100;
        const contentForQuiz = content || topic.content || sourceContent;

        if (!hasSourceContent && !contentForQuiz) {
            return NextResponse.json({ error: 'No source content available.' }, { status: 400 });
        }

        const preferencesText = formatPreferences(contentPreferences as ContentPreferences);

        const prompt = `Create learning activities for "${actualTopicName}" based STRICTLY on: ${contentForQuiz.substring(0, 8000)}.

${preferencesText ? `User preferences:\n${preferencesText}\n` : ''}

Output JSON with:
1. "questions": array of MCQ objects with fields: question, options (array of 4 strings), correctAnswers (array of zero-based INDEX numbers indicating which options are correct - e.g., [0] means first option is correct, [2] means third option), explanation. Generate **5** high-quality MCQs.
   IMPORTANT for correctAnswers: Use the INDEX (0, 1, 2, or 3) of the correct option, NOT the answer value itself.
   Example: If options are ["5", "10", "15", "20"] and 15 is correct, correctAnswers should be [2] (index of "15"), NOT [15].
2. "flashcards": array of objects with fields: front, back. Generate **5** flashcards.
3. "fillBlank": array of objects with fields: question (sentence with ___), answer (string). Generate **3** fill-in-the-blank items.
4. "trueFalse": array of objects with fields: question, answer (boolean), explanation. Generate **3** true/false items.

CRITICAL - LATEX FORMATTING (MUST USE DOUBLE BACKSLASHES IN JSON):
Since this is JSON output, you MUST use DOUBLE BACKSLASHES for all LaTeX commands.
- Inline math: $x$ (Use only for single variables like $x$)
- Display math: $$\\\\int f(x)\\\\,dx$$ (Use for ALL formulas, equations, and expressions)
- SPACING: STRICTLY separate math content from text. Always add a blank line before and after any math block.
- CENTERED: Use display math ($$ ... $$) for all math content. This puts it on a new line and centers it.
- ISOLATION: NEVER mix math formulas with non-math text in the same line.
- Use \\\\text{} for words inside math: $$ v = \\\\text{distance} / \\\\text{time} $$
- REQUIRED double backslash examples (use these EXACTLY):
  - Fractions: $\\\\frac{a}{b}$ NOT $\\frac{a}{b}$ or a/b
  - Square roots: $\\\\sqrt{x}$ NOT $\\sqrt{x}$ or sqrt(x)
  - Integrals: $\\\\int_a^b f(x)\\\\,dx$
  - Summations: $\\\\sum_{i=1}^{n}$
  - Limits: $\\\\lim_{x \\\\to 0}$
  - Greek letters: $\\\\alpha$, $\\\\beta$, $\\\\theta$, $\\\\pi$
  - Vectors: $\\\\vec{v}$
  - Partial derivatives: $\\\\frac{\\\\partial f}{\\\\partial x}$
  - Inequalities: $\\\\leq$, $\\\\geq$, $\\\\neq$

FORMATTING FOR READABILITY:
- Put mathematical expressions on their OWN LINE when they are the focus of the question
- Add blank lines between question text and math expressions
- Wrap ONLY the core question prompt inside a question block:
  :::question
  [question text with any formulas/given values]
  :::
  Any short setup/context can appear above the block if needed.
- Example question format:
  "Solve the following.\\n\\n:::question\\nWhat is the value of the following expression?\\n\\n$$\\\\frac{1}{x-2}$$\\n\\nwhen $x = 4$?\\n:::"
- Keep options clean and concise
- Make questions look like professional textbook problems
- NEVER use plain text for math like "x^2" - always use $x^2$ or $$x^2$$
- ENSURE blank lines around all $$ ... $$ blocks.
- ONLY generate content that is explicitly supported by the source text provided.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "system", content: "You are a teacher." }, { role: "user", content: prompt }],
            temperature: 0.5,
            response_format: { type: "json_object" },
            max_tokens: 4000,
        });

        let parsed;
        try {
            let contentStr = completion.choices[0].message.content || "{}";
            // Remove null bytes which postgres hates
            contentStr = contentStr.replace(/\\u0000/g, '').replace(/\0/g, '');
            parsed = JSON.parse(contentStr);
        } catch (e) {
            console.error("Failed to parse AI response:", completion.choices[0].message.content);
            throw new Error("AI generated incomplete data. Please try again.");
        }
        const questions = (parsed.questions || []).slice(0, 10).map(normalizeMCQ).filter(Boolean) as MCQ[];
        const flashcards = (parsed.flashcards || []).slice(0, 10);
        const fillBlank = (parsed.fillBlank || []).slice(0, 5);
        const trueFalse = (parsed.trueFalse || []).slice(0, 5);

        const createdExercises = [];
        for (const q of questions) {
            const exercise = await prisma.exercise.create({
                data: {
                    id: crypto.randomUUID(),
                    subjectId: topic.subjectId,
                    topicId: topicId,
                    type: 'mcq',
                    title: 'Quiz: ' + actualTopicName,
                    difficulty: 'medium',
                    content: q,
                    points: 10,
                    isActive: true,
                    updatedAt: new Date()
                }
            });
            createdExercises.push(exercise);
        }

        for (const fc of flashcards) {
            const exercise = await prisma.exercise.create({
                data: {
                    id: crypto.randomUUID(),
                    subjectId: topic.subjectId,
                    topicId: topicId,
                    type: 'flashcard',
                    title: 'Flashcard: ' + actualTopicName,
                    difficulty: 'medium',
                    content: { front: fc.front, back: fc.back },
                    points: 5,
                    isActive: true,
                    updatedAt: new Date()
                }
            });
            createdExercises.push(exercise);
        }

        for (const fb of fillBlank) {
            const exercise = await prisma.exercise.create({
                data: {
                    id: crypto.randomUUID(),
                    subjectId: topic.subjectId,
                    topicId: topicId,
                    type: 'fill_blank',
                    title: 'Fill Blank: ' + actualTopicName,
                    difficulty: 'medium',
                    content: fb,
                    points: 5,
                    isActive: true,
                    updatedAt: new Date()
                }
            });
            createdExercises.push(exercise);
        }

        for (const tf of trueFalse) {
            const exercise = await prisma.exercise.create({
                data: {
                    id: crypto.randomUUID(),
                    subjectId: topic.subjectId,
                    topicId: topicId,
                    type: 'true_false',
                    title: 'True/False: ' + actualTopicName,
                    difficulty: 'medium',
                    content: tf,
                    points: 5,
                    isActive: true,
                    updatedAt: new Date()
                }
            });
            createdExercises.push(exercise);
        }

        logSecurityEvent({
            type: 'ai_usage',
            userId: session.user.id,
            ip,
            route: '/api/topics/generate-quiz',
            status: 200,
            details: { topicId, activityCount: createdExercises.length }
        });

        return NextResponse.json({ success: true, exercises: createdExercises });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        logSecurityEvent({ type: 'ai_usage', userId: session.user.id, ip, route: '/api/topics/generate-quiz', status: 500, details: { error: message } });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
