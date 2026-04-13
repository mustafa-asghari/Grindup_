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
    if (preferences.style) lines.push(`Adjust complexity for "${preferences.style}" learners.`);
    if (preferences.tone) lines.push(`Use a "${preferences.tone}" tone and examples.`);
    if (preferences.customInstructions) lines.push(`Follow user guidance: ${preferences.customInstructions}`);
    return lines.join('\n');
}

// Helper to find relevant content chunks from the source material
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
                const relevantContent = scoredChunks
                    .slice(0, 8)
                    .map(c => c.content)
                    .join('\n\n---\n\n');

                if (relevantContent.length > 200) {
                    return relevantContent;
                }
            } catch (e) {
                console.warn('Vector search failed, using full content:', e);
            }
        }
        return subject.sourceContent.substring(0, 20000);
    }
    return '';
}

function buildSourceBasedLessonPrompt({
    subjectName,
    topicName,
    sourceContent,
    topicDescription,
    preferencesText
}: {
    subjectName: string;
    topicName: string;
    sourceContent: string;
    topicDescription?: string;
    preferencesText?: string;
}): string {
    return `
You are a world-class tutor who has taught thousands of students. Your lessons are known for making complex topics click instantly. Create a comprehensive, premium-quality lesson that students would gladly pay for.

TEACHING PHILOSOPHY - THE "AHA MOMENT" APPROACH:
- Start with WHY this matters in real life before diving into what it is
- Build understanding in layers: intuition first, then precise definitions, then applications
- Every concept needs a concrete mental model or analogy that makes it unforgettable
- Anticipate confusion points and address them proactively
- Connect new ideas to what students already know

PREMIUM CONTENT STANDARDS:
- Write like the best $200/hour tutor: every sentence teaches something valuable
- Include insights that textbooks miss - the "insider knowledge" that experts know
- Give specific numbers, real examples, and precise terminology (not vague generalities)
- Explain the REASONING behind each step, not just the procedure
- Add "expert tips" that come from deep understanding of the subject
- Include edge cases and when rules break down

DEPTH REQUIREMENTS:
- Key Facts must include: the core formula/rule, when to use it, when NOT to use it, units/constraints, and a quick intuition check
- Worked Examples must show: problem setup reasoning, why each step follows logically, common mistakes to avoid at each step, how to verify the answer
- Practice problems must range from straightforward application to slightly challenging transfer

SUBJECT: ${subjectName}
TOPIC: ${topicName}
${topicDescription ? `TOPIC DESCRIPTION: ${topicDescription}` : ''}
${preferencesText ? `USER PREFERENCES:\n${preferencesText}\n` : ''}

SOURCE CONTENT (from user's imported material):
---
${sourceContent}
---

REQUIRED STRUCTURE (follow exactly):

# ${topicName}

## Definition
3 sentences that build understanding progressively:
Line 1: A one-sentence intuitive definition using everyday language.
Line 2: The precise technical definition with key terminology bolded.
Line 3: A concrete real-world example or analogy that makes it memorable.

## Visual Overview
Create ONE mermaid diagram showing how concepts connect. Must have 5-8 nodes with meaningful, topic-specific labels.
Use flowchart TD only.
Labels must be 1-3 words, plain text only (no punctuation, quotes, math, or emojis).
Show relationships: causes, components, steps, or categories - whatever best illuminates the topic.
\`\`\`mermaid
flowchart TD
    A[${topicName}] --> B[Core Concept]
    B --> C[Mechanism]
    C --> D[Outcome]
    B --> E[Constraint]
\`\`\`

## Key Facts
Provide 6-8 essential facts that a student MUST know. Each fact should teach something actionable:
- **Bold term 1:** Explanation with specific details. Include when/why this matters.

- **Bold term 2:** The key formula or rule. Explain what each variable means and typical units.

- **Bold term 3:** Important constraint or condition. Explain what happens if violated.

- **Bold term 4:** Connection to related concepts. Show how this fits the bigger picture.

- **Bold term 5:** Common real-world application. Be specific (e.g., "used in MRI machines" not "used in medicine").

- **Bold term 6:** Expert insight or non-obvious fact that distinguishes surface vs. deep understanding.

## Worked Example
**Problem:**
State a realistic, moderately challenging problem. Include all given information clearly.

**Why this problem matters:** One sentence on what skill this tests.

**Solution:**

**Step 1:** [Descriptive Label]
First, explain WHY we start here - what's our strategy?
Then show the calculation with reasoning for each manipulation.
Note any common mistakes students make at this step.

**Step 2:** [Descriptive Label]
Explain the logical connection from Step 1.
Show the calculation, explaining why each operation is valid.
Point out any tricky parts or sign errors to watch for.

**Step 3:** [Descriptive Label]
Explain how this brings us to the conclusion.
Show final calculation clearly.

**Answer:** State the complete answer with proper units.

**Sanity check:** Briefly verify the answer makes sense (right units? right order of magnitude? passes limiting cases?).

## Practice
Three problems that progressively build skill:

1. [Direct application] A straightforward problem using the core concept.

2. [Slight variation] A problem requiring one additional step or small twist.

3. [Deeper thinking] A problem that tests true understanding, not just formula plugging.

## Answers
Provide complete solutions, not just final answers:

1. Brief solution approach, then final answer with units.

2. Brief solution approach, then final answer with units.

3. Brief solution approach, then final answer with units.

## Common Errors
Identify the 3 most frequent mistakes and how to avoid them:
- **Error 1 (The classic trap):** Describe the mistake. Why students make it. How to avoid it.

- **Error 2 (Conceptual confusion):** Describe a misunderstanding. The correct way to think about it.

- **Error 3 (Careless mistake):** Describe a procedural error. A specific check to catch it.

## Summary
Three takeaways that capture the essence of mastering this topic:
- **Core principle:** The fundamental idea in one memorable sentence.

- **Key technique:** The most important method or formula to remember.

- **Expert tip:** An insight that separates those who truly understand from those who just memorized.

FORMATTING RULES:
- Use **bold** for key terms, step labels, and emphasis
- Leave blank lines between list items and sections
- Practice must be exactly 3 numbered items (1., 2., 3.) with blank lines between
- Answers must be exactly 3 numbered items (1., 2., 3.) with blank lines between
- ONLY mermaid code blocks are allowed (no other fenced code blocks)
- Only one mermaid diagram (Visual Overview) and no other visuals or images
- No ASCII diagrams or visual blocks
- No long paragraphs (max 3 sentences)
- No empty motivation - every word teaches
- Headings must match exactly

MATH FORMATTING:
- Inline math: $x^2$ (Use only for single variables like $x$ or $y$)
- Display math: $$\\int f(x)\\,dx$$ (Use for ALL formulas, equations, and expressions)
- SPACING: STRICTLY separate math content from text. Always add a blank line before and after any math block.
- CENTERED: Use display math ($$ ... $$) for all math content. This puts it on a new line and centers it.
- ISOLATION: NEVER mix math formulas with non-math text in the same line.
- Use \\text{} for words inside math: $$ v = \\text{distance} / \\text{time} $$
`;
}

function buildGenericLessonPrompt({
    subjectName,
    topicName,
    preferencesText
}: {
    subjectName: string;
    topicName: string;
    preferencesText?: string;
}): string {
    return `
You are a world-class tutor who has taught thousands of students. Your lessons are known for making complex topics click instantly. Create a comprehensive, premium-quality lesson on "${topicName}" for "${subjectName}" that students would gladly pay for.
${preferencesText ? `\nFollow these user preferences:\n${preferencesText}\n` : ''}

TEACHING PHILOSOPHY - THE "AHA MOMENT" APPROACH:
- Start with WHY this matters in real life before diving into what it is
- Build understanding in layers: intuition first, then precise definitions, then applications
- Every concept needs a concrete mental model or analogy that makes it unforgettable
- Anticipate confusion points and address them proactively
- Connect new ideas to what students already know

PREMIUM CONTENT STANDARDS:
- Write like the best $200/hour tutor: every sentence teaches something valuable
- Include insights that textbooks miss - the "insider knowledge" that experts know
- Give specific numbers, real examples, and precise terminology (not vague generalities)
- Explain the REASONING behind each step, not just the procedure
- Add "expert tips" that come from deep understanding of the subject
- Include edge cases and when rules break down

DEPTH REQUIREMENTS:
- Key Facts must include: the core formula/rule, when to use it, when NOT to use it, units/constraints, and a quick intuition check
- Worked Examples must show: problem setup reasoning, why each step follows logically, common mistakes to avoid at each step, how to verify the answer
- Practice problems must range from straightforward application to slightly challenging transfer

REQUIRED STRUCTURE (follow exactly):

# ${topicName}

## Definition
3 sentences that build understanding progressively:
Line 1: A one-sentence intuitive definition using everyday language.
Line 2: The precise technical definition with key terminology bolded.
Line 3: A concrete real-world example or analogy that makes it memorable.

## Visual Overview
Create ONE mermaid diagram showing how concepts connect. Must have 5-8 nodes with meaningful, topic-specific labels.
Use flowchart TD only.
Labels must be 1-3 words, plain text only (no punctuation, quotes, math, or emojis).
Show relationships: causes, components, steps, or categories - whatever best illuminates the topic.
\`\`\`mermaid
flowchart TD
    A[${topicName}] --> B[Core Concept]
    B --> C[Mechanism]
    C --> D[Outcome]
    B --> E[Constraint]
\`\`\`

## Key Facts
Provide 6-8 essential facts that a student MUST know. Each fact should teach something actionable:
- **Bold term 1:** Explanation with specific details. Include when/why this matters.

- **Bold term 2:** The key formula or rule. Explain what each variable means and typical units.

- **Bold term 3:** Important constraint or condition. Explain what happens if violated.

- **Bold term 4:** Connection to related concepts. Show how this fits the bigger picture.

- **Bold term 5:** Common real-world application. Be specific (e.g., "used in MRI machines" not "used in medicine").

- **Bold term 6:** Expert insight or non-obvious fact that distinguishes surface vs. deep understanding.

## Worked Example
**Problem:**
State a realistic, moderately challenging problem. Include all given information clearly.

**Why this problem matters:** One sentence on what skill this tests.

**Solution:**

**Step 1:** [Descriptive Label]
First, explain WHY we start here - what's our strategy?
Then show the calculation with reasoning for each manipulation.
Note any common mistakes students make at this step.

**Step 2:** [Descriptive Label]
Explain the logical connection from Step 1.
Show the calculation, explaining why each operation is valid.
Point out any tricky parts or sign errors to watch for.

**Step 3:** [Descriptive Label]
Explain how this brings us to the conclusion.
Show final calculation clearly.

**Answer:** State the complete answer with proper units.

**Sanity check:** Briefly verify the answer makes sense (right units? right order of magnitude? passes limiting cases?).

## Practice
Three problems that progressively build skill:

1. [Direct application] A straightforward problem using the core concept.

2. [Slight variation] A problem requiring one additional step or small twist.

3. [Deeper thinking] A problem that tests true understanding, not just formula plugging.

## Answers
Provide complete solutions, not just final answers:

1. Brief solution approach, then final answer with units.

2. Brief solution approach, then final answer with units.

3. Brief solution approach, then final answer with units.

## Common Errors
Identify the 3 most frequent mistakes and how to avoid them:
- **Error 1 (The classic trap):** Describe the mistake. Why students make it. How to avoid it.

- **Error 2 (Conceptual confusion):** Describe a misunderstanding. The correct way to think about it.

- **Error 3 (Careless mistake):** Describe a procedural error. A specific check to catch it.

## Summary
Three takeaways that capture the essence of mastering this topic:
- **Core principle:** The fundamental idea in one memorable sentence.

- **Key technique:** The most important method or formula to remember.

- **Expert tip:** An insight that separates those who truly understand from those who just memorized.

FORMATTING RULES:
- Use **bold** for key terms, step labels, and emphasis
- Leave blank lines between list items and sections
- Practice must be exactly 3 numbered items (1., 2., 3.) with blank lines between
- Answers must be exactly 3 numbered items (1., 2., 3.) with blank lines between
- ONLY mermaid code blocks are allowed (no other fenced code blocks)
- Only one mermaid diagram (Visual Overview) and no other visuals or images
- No ASCII diagrams or visual blocks
- No long paragraphs (max 3 sentences)
- No empty motivation - every word teaches
- Headings must match exactly

MATH FORMATTING:
- Inline math: $x^2$ (Use only for single variables like $x$ or $y$)
- Display math: $$\\int f(x)\\,dx$$ (Use for ALL formulas, equations, and expressions)
- SPACING: STRICTLY separate math content from text. Always add a blank line before and after any math block.
- CENTERED: Use display math ($$ ... $$) for all math content. This puts it on a new line and centers it.
- ISOLATION: NEVER mix math formulas with non-math text in the same line.
- Use \\text{} for words inside math: $$ v = \\text{distance} / \\text{time} $$
`;
}

const REQUIRED_H2_HEADINGS = [
    'Definition',
    'Visual Overview',
    'Key Facts',
    'Worked Example',
    'Practice',
    'Answers',
    'Common Errors',
    'Summary',
] as const;

const BANNED_PHRASES = [
    'TLDR',
    'TL;DR',
    'How to use',
    'How to Use',
    'Introduction',
    'Key Concepts',
    'Important Points',
    'Visual Concept',
    "What you'll learn",
    "What you'll be able to do",
] as const;

function findMarkdownHeadingIndex(lines: string[], level: 1 | 2, headingText?: string): number {
    const prefix = level === 1 ? '^\\s*#(?!#)\\s+' : '^\\s*##(?!#)\\s+';
    if (!headingText) {
        const re = new RegExp(`${prefix}.+`, 'i');
        return lines.findIndex(line => re.test(line));
    }
    // Use partial matching - heading must contain the text (case insensitive)
    return lines.findIndex(line => {
        if (!new RegExp(prefix, 'i').test(line)) return false;
        return line.toLowerCase().includes(headingText.toLowerCase());
    });
}

function getSectionLines(lines: string[], startIdx: number, endIdx: number): string[] {
    return lines.slice(startIdx + 1, endIdx).map(l => l.trimEnd());
}

function findMermaidBlocks(lines: string[]): Array<{ start: number; end: number }> {
    const blocks: Array<{ start: number; end: number }> = [];
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!/^```mermaid/i.test(trimmed)) continue;
        let end = i + 1;
        while (end < lines.length && !/^```$/.test(lines[end].trim())) end++;
        blocks.push({ start: i, end: Math.min(end, lines.length - 1) });
        i = end;
    }
    return blocks;
}

function validateLessonStructure(content: string): { ok: true } | { ok: false; reasons: string[] } {
    const reasons: string[] = [];
    const lines = content.split(/\r?\n/);

    // Reject banned template headings (as headings only) to avoid false positives in normal prose.
    for (const line of lines) {
        const trimmed = line.trim();
        if (!/^#{1,6}\s+/.test(trimmed)) continue;
        const lower = trimmed.toLowerCase();
        for (const phrase of BANNED_PHRASES) {
            if (lower.includes(phrase.toLowerCase())) {
                reasons.push(`banned_heading_phrase:${phrase}`);
            }
        }
    }

    // Reject ASCII-art / visual blocks (but allow mermaid code blocks).
    let inMermaidBlock = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (/^```mermaid/i.test(trimmed)) {
            inMermaidBlock = true;
            continue;
        }
        if (inMermaidBlock && /^```$/.test(trimmed)) {
            inMermaidBlock = false;
            continue;
        }
        if (inMermaidBlock) continue;

        if (/!\[[^\]]*\]\([^)]+\)/.test(line) || /<img\s/i.test(line)) {
            reasons.push('image_not_allowed');
            break;
        }
        if (/[-|\\/=_]{10,}/.test(line)) {
            reasons.push('ascii_art_line');
            break;
        }
        if (/^```/.test(trimmed)) {
            reasons.push('fenced_code_block');
            break;
        }
    }

    const titleIdx = findMarkdownHeadingIndex(lines, 1);
    if (titleIdx === -1) reasons.push('missing_title_h1');

    const idx: Record<(typeof REQUIRED_H2_HEADINGS)[number], number> = {
        'Definition': findMarkdownHeadingIndex(lines, 2, 'Definition'),
        'Visual Overview': findMarkdownHeadingIndex(lines, 2, 'Visual Overview'),
        'Key Facts': findMarkdownHeadingIndex(lines, 2, 'Key Facts'),
        'Worked Example': findMarkdownHeadingIndex(lines, 2, 'Worked Example'),
        'Practice': findMarkdownHeadingIndex(lines, 2, 'Practice'),
        'Answers': findMarkdownHeadingIndex(lines, 2, 'Answers'),
        'Common Errors': findMarkdownHeadingIndex(lines, 2, 'Common Errors'),
        'Summary': findMarkdownHeadingIndex(lines, 2, 'Summary'),
    };

    for (const h of REQUIRED_H2_HEADINGS) {
        if (idx[h] === -1) reasons.push(`missing_heading:${h}`);
    }

    const mermaidBlocks = findMermaidBlocks(lines);
    if (mermaidBlocks.length !== 1) {
        reasons.push('mermaid_block_count_not_one');
    }

    // Required heading order + key placement checks.
    const ordered = [
        ['Definition', idx['Definition']],
        ['Visual Overview', idx['Visual Overview']],
        ['Key Facts', idx['Key Facts']],
        ['Worked Example', idx['Worked Example']],
        ['Practice', idx['Practice']],
        ['Answers', idx['Answers']],
        ['Common Errors', idx['Common Errors']],
        ['Summary', idx['Summary']],
    ] as const;

    if (idx['Visual Overview'] !== -1) {
        const headingIndices = Object.values(idx)
            .filter(i => i !== -1)
            .sort((a, b) => a - b);
        const visualEndIdx = headingIndices.find(i => i > idx['Visual Overview']) ?? lines.length;
        const mermaidInVisual = mermaidBlocks.some(b => b.start > idx['Visual Overview'] && b.start < visualEndIdx);
        if (!mermaidInVisual) reasons.push('visual_overview_missing_mermaid');
        if (mermaidBlocks.some(b => b.start < idx['Visual Overview'] || b.start > visualEndIdx)) {
            reasons.push('mermaid_outside_visual_overview');
        }
        if (mermaidBlocks.length === 1) {
            const blockLines = lines.slice(mermaidBlocks[0].start + 1, mermaidBlocks[0].end);
            const hasFlowchart = blockLines.some(l => /^\s*flowchart\s+td/i.test(l.trim()));
            if (!hasFlowchart) reasons.push('mermaid_not_flowchart_td');
        }
    }

    let last = titleIdx;
    for (const [name, hIdx] of ordered) {
        if (hIdx !== -1 && last !== -1 && hIdx <= last) {
            reasons.push(`heading_out_of_order:${name}`);
        }
        if (hIdx !== -1) last = hIdx;
    }

    if (idx['Worked Example'] !== -1 && idx['Practice'] !== -1 && !(idx['Worked Example'] < idx['Practice'])) {
        reasons.push('worked_example_not_before_practice');
    }
    if (idx['Practice'] !== -1 && idx['Answers'] !== -1 && !(idx['Practice'] < idx['Answers'])) {
        reasons.push('practice_not_before_answers');
    }

    // Practice/Answers validation: exactly 3 numbered lines "1.", "2.", "3." each on its own line.
    if (idx['Practice'] !== -1 && idx['Answers'] !== -1) {
        const practiceLines = getSectionLines(lines, idx['Practice'], idx['Answers'])
            .map(l => l.trim())
            .filter(Boolean);
        const matches = practiceLines.map(l => l.match(/^([1-3])\.\s+(.+)$/));
        if (practiceLines.length !== 3 || matches.some(m => !m)) {
            reasons.push('practice_not_3_numbered_lines');
        } else if (matches.map(m => m![1]).join(',') !== '1,2,3') {
            reasons.push('practice_numbering_not_1_2_3');
        }
    }
    if (idx['Answers'] !== -1 && idx['Common Errors'] !== -1) {
        const answerLines = getSectionLines(lines, idx['Answers'], idx['Common Errors'])
            .map(l => l.trim())
            .filter(Boolean);
        const matches = answerLines.map(l => l.match(/^([1-3])\.\s+(.+)$/));
        if (answerLines.length !== 3 || matches.some(m => !m)) {
            reasons.push('answers_not_3_numbered_lines');
        } else if (matches.map(m => m![1]).join(',') !== '1,2,3') {
            reasons.push('answers_numbering_not_1_2_3');
        }
    }

    return reasons.length ? { ok: false, reasons } : { ok: true };
}

function buildStructureRepairPrompt(originalLesson: string): string {
    return `
Reformat the lesson below to match the REQUIRED LESSON TEMPLATE exactly.

HARD RULES:
- Fix STRUCTURE/FORMATTING ONLY. Do NOT change meaning, mathematical facts, examples, or results.
- Do NOT add or remove concepts; do not introduce new facts.
- Keep all equations, numbers, and final answers the same.
- Keep any existing mermaid diagrams intact.
- PRESERVE all the detailed explanations, insights, and reasoning from the original.

REQUIRED STRUCTURE (headings must match exactly):

# <Title>

## Definition
3 sentences on separate lines (intuitive definition, technical definition, example/analogy).

## Visual Overview
Include ONE mermaid diagram. If the original has one, keep it. If not, create an appropriate one.
Use flowchart TD only. Labels must be 1-3 words, plain text only (no punctuation, quotes, math, or emojis).
\`\`\`mermaid
flowchart TD
    A[Topic] --> B[Core Idea]
    B --> C[Mechanism]
    C --> D[Outcome]
    B --> E[Constraint]
\`\`\`

## Key Facts
- **Bold key term:** explanation (6-8 bullets with blank lines between, preserve all detailed explanations)

## Worked Example
**Problem:**
State the problem.

**Why this problem matters:** (keep if present, add brief sentence if missing)

**Solution:**

**Step 1:** [Label]
Explanation with reasoning.

**Step 2:** [Label]
Explanation with reasoning.

**Step 3:** [Label]
Explanation with reasoning.

**Answer:** Final answer with units.

**Sanity check:** (keep if present, add brief verification if missing)

## Practice
1. Question one

2. Question two

3. Question three

## Answers
1. Solution approach and answer.

2. Solution approach and answer.

3. Solution approach and answer.

## Common Errors
- **Error 1 (descriptive label):** Description and how to avoid.

- **Error 2 (descriptive label):** Description and how to avoid.

- **Error 3 (descriptive label):** Description and how to avoid.

## Summary
- **Core principle:** Main takeaway.

- **Key technique:** Important method to remember.

- **Expert tip:** Deeper insight.

FORMATTING RULES:
- Use **bold** for key terms, step labels, and emphasis
- Leave blank lines between list items and sections
- Practice must be exactly 3 numbered items (1., 2., 3.) with blank lines between
- Answers must be exactly 3 numbered items (1., 2., 3.) with blank lines between
- ONLY mermaid code blocks are allowed (no other fenced code blocks)
- Only one mermaid diagram (Visual Overview) and no other visuals or images
- No ASCII diagrams or visual blocks
- No long paragraphs (max 3 sentences)
- No empty motivational language
- If headings differ slightly, rename them to match EXACTLY
- If Practice/Answers use bullets or other numbering, convert to "1.", "2.", "3."
- MATH FORMATTING: Ensure all formulas are in display math ($$ ... $$) on their own lines, separated by blank lines from text.


LESSON TO REFORMAT:
---
${originalLesson}
---
`;
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';

    const csrfValid = await checkCSRF();
    if (!csrfValid) {
        logSecurityEvent({ type: 'csrf_failure', userId: session.user.id, ip, route: '/api/topics/generate', status: 403 });
        return NextResponse.json({ error: 'Forbidden: CSRF check failed' }, { status: 403 });
    }

    const rateLimit = await checkRateLimit(session.user.id, 'content_gen', { windowMs: 60 * 1000, maxRequests: 15 }, ip);
    if (!rateLimit.allowed) {
        logSecurityEvent({ type: 'rate_limit', userId: session.user.id, ip, route: '/api/topics/generate', status: 429 });
        return NextResponse.json({ error: 'Too many requests. Please wait a minute.', resetAt: rateLimit.resetAt }, { status: 429 });
    }

    try {
        const { topicId, subjectName, topicName, force, contentPreferences } = await request.json();

        if (!topicId || !subjectName || !topicName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const topic = await prisma.subjectTopic.findUnique({
            where: { id: topicId },
            select: { subjectId: true, description: true, content: true }
        });

        if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

        if (!force && topic.content && topic.content.length > 100) {
            return NextResponse.json({ content: topic.content, cached: true });
        }

        const openai = getOpenAI();
        const sourceContent = await getRelevantSourceContent(topic.subjectId, topicName, openai);
        const hasSourceContent = sourceContent && sourceContent.length > 100;

        const preferencesText = formatPreferences(contentPreferences as ContentPreferences);

        const prompt = hasSourceContent
            ? buildSourceBasedLessonPrompt({ subjectName, topicName, sourceContent, topicDescription: topic.description || undefined, preferencesText })
            : buildGenericLessonPrompt({ subjectName, topicName, preferencesText });

        const generateLessonOnce = async (p: string, temperature: number) => {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are a world-class educator known for creating premium, insightful lessons that make complex topics click. Your teaching style combines expert-level knowledge with clear explanations that students actually remember. Every sentence you write teaches something valuable - no filler, no fluff. You explain the WHY behind every concept and include the insider insights that textbooks miss." },
                    { role: "user", content: p }
                ],
                temperature,
                max_tokens: 3500,
            });
            return completion.choices[0].message.content || "";
        };

        let content = await generateLessonOnce(prompt, hasSourceContent ? 0.4 : 0.6);
        const v1 = validateLessonStructure(content);
        if (!v1.ok) {
            console.warn('Lesson structure validation failed (attempt 1)', {
                topicId,
                topicName,
                subjectName,
                reasons: v1.reasons,
            });

            const repaired = await generateLessonOnce(buildStructureRepairPrompt(content), 0.2);
            const v2 = validateLessonStructure(repaired);
            if (!v2.ok) {
                console.warn('Lesson structure validation failed (attempt 2)', {
                    topicId,
                    topicName,
                    subjectName,
                    reasons: v2.reasons,
                });
                return NextResponse.json({ error: `Lesson structure validation failed: ${v2.reasons.join(', ')}` }, { status: 500 });
            }
            content = repaired;
        }

        await prisma.subjectTopic.update({
            where: { id: topicId },
            data: { content }
        });

        logSecurityEvent({
            type: 'ai_usage',
            userId: session.user.id,
            ip,
            route: '/api/topics/generate',
            status: 200,
            details: { topicId, subjectName: subjectName.slice(0, 50), completionSize: content.length }
        });

        return NextResponse.json({ content, sourceUsed: hasSourceContent ? 'imported_content' : 'generic' });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate content';
        logSecurityEvent({ type: 'ai_usage', userId: session.user.id, ip, route: '/api/topics/generate', status: 500, details: { error: message } });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
