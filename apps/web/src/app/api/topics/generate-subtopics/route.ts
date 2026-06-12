import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { openai } from '@/lib/openai';

// Web search function for researching subtopics
async function searchSubtopics(subjectName: string, topicName: string): Promise<string | null> {
    const serperApiKey = process.env.SERPER_API_KEY;
    if (!serperApiKey) {
        return null;
    }

    try {
        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': serperApiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: `"${subjectName}" "${topicName}" syllabus subtopics curriculum outline`,
                num: 5,
            }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        const results: string[] = [];

        if (data.organic) {
            for (const result of data.organic.slice(0, 3)) {
                results.push(`${result.title}: ${result.snippet || ''}`);
            }
        }

        return results.length > 0 ? results.join('\n') : null;
    } catch {
        return null;
    }
}

type RawSubtopic = { name?: string; description?: string; estimatedMins?: number };
const ALLOWED_MINUTES = [30, 45, 60, 75, 90];

const GENERIC_SUBTOPIC_EXACT = new Set([
    'introduction',
    'intro',
    'overview',
    'review',
    'summary',
    'conclusion',
    'practice',
    'core concepts',
    'core concept',
    'examples',
    'example',
    'exercises',
    'exercise',
    'quiz',
    'definition',
    'definitions',
    // Only banned as standalone headings (allowed when paired with domain terms).
    'fundamentals',
    'foundations',
    'basics',
    'advanced',
]);

const GENERIC_SUBTOPIC_PREFIX_PATTERNS: RegExp[] = [
    /^(introduction|intro)\b/i,
    /^overview\b/i,
    /^core\s+concepts?\b/i,
    /^examples?\b/i,
    /^definitions?\b/i,
    /^exercises?\b/i,
    /^quiz\b/i,
    // Narrow "review/summary/conclusion" to typical template phrasing.
    /^review\b(?:\s+of\b|$)/i,
    /^summary\b(?:\s+of\b|$)/i,
    /^conclusion\b(?:\s+of\b|$)/i,
    // Ban "Practice" when it's clearly a learning-template heading (but allow domain phrases like "Practice Management").
    /^practice\b(?:\s+(problems?|questions?|exercises?|quizzes?|quiz)\b|$)/i,
];

const MICRO_SUBTOPIC_PATTERNS: RegExp[] = [
    /\bpart\s*\d+\b/i,
    /\bmodule\s*\d+\b/i,
    /\bunit\s*\d+\b/i,
    /\blesson\s*\d+\b/i,
    /\bchapter\s*\d+\b/i,
    /\b(quiz|quizzes|worksheet|worksheets)\b/i,
    /\bpractice\s+(problems?|questions?|exercises?)\b/i,
    /^\s*(intro|introduction|overview|review|summary|conclusion)\s*$/i,
    /^\s*(foundations|fundamentals|basics|advanced)\s*$/i,
];

const PLAYFUL_TITLE_TOKENS = new Set([
    'fun',
    'magic',
    'magical',
    'adventure',
    'adventures',
    'journey',
    'journeys',
    'quest',
    'quests',
]);

const TITLE_STOPWORDS = new Set([
    'and', 'or', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'with', 'on', 'at', 'by', 'from',
]);

const slugify = (value: string) => value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function normalizeTitle(text: string): string {
    return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenizeTitle(text: string): string[] {
    const normalized = normalizeTitle(text);
    if (!normalized) return [];
    return normalized
        .split(' ')
        .map(t => t.trim())
        .filter(t => t.length >= 2 && !TITLE_STOPWORDS.has(t));
}

function jaccardSimilarity(a: string[], b: string[]): number {
    const aSet = new Set(a);
    const bSet = new Set(b);
    if (aSet.size === 0 && bSet.size === 0) return 1;
    if (aSet.size === 0 || bSet.size === 0) return 0;

    let intersection = 0;
    for (const t of aSet) {
        if (bSet.has(t)) intersection += 1;
    }
    const union = aSet.size + bSet.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

function isGenericSubtopicHeading(normalized: string, tokens: string[]): boolean {
    if (GENERIC_SUBTOPIC_EXACT.has(normalized)) return true;
    for (const re of GENERIC_SUBTOPIC_PREFIX_PATTERNS) {
        if (re.test(normalized)) return true;
    }

    const first = tokens[0] || '';
    if (['fundamentals', 'foundations', 'basics', 'advanced'].includes(first)) {
        return tokens.length < 2;
    }

    return false;
}

function validateSubtopics(subtopics: RawSubtopic[]): { ok: true } | { ok: false; reasons: string[] } {
    const reasons: string[] = [];
    if (subtopics.length < 3 || subtopics.length > 5) {
        reasons.push(`subtopics_count_out_of_range:${subtopics.length}`);
    }

    const seen = new Set<string>();
    const tokenized: Array<{ tokens: string[]; name: string }> = [];

    for (const st of subtopics) {
        const name = (st.name || '').toString().trim();
        const normalized = normalizeTitle(name);
        const tokens = tokenizeTitle(name);

        if (!normalized) {
            reasons.push('subtopic_missing_name');
            continue;
        }

        if (tokens.some(tok => PLAYFUL_TITLE_TOKENS.has(tok))) {
            reasons.push('playful_subtopic_title');
        }

        const wordCount = normalized.split(' ').filter(Boolean).length;
        if (wordCount < 2 || wordCount > 6) {
            reasons.push('subtopic_title_word_count_out_of_range');
        }

        if (isGenericSubtopicHeading(normalized, tokens)) {
            reasons.push('generic_template_heading');
        }

        for (const re of MICRO_SUBTOPIC_PATTERNS) {
            if (re.test(name)) {
                reasons.push('micro_subtopic_title');
                break;
            }
        }

        if (!ALLOWED_MINUTES.includes(st.estimatedMins || 0)) {
            reasons.push('invalid_estimatedMins');
        }

        if (seen.has(normalized)) reasons.push('duplicate_subtopic_title');
        seen.add(normalized);
        tokenized.push({ tokens, name });
    }

    // Overlap heuristic: subtopics should be distinct lesson chunks.
    for (let i = 0; i < tokenized.length; i++) {
        for (let j = i + 1; j < tokenized.length; j++) {
            const sim = jaccardSimilarity(tokenized[i].tokens, tokenized[j].tokens);
            const a = new Set(tokenized[i].tokens);
            const b = new Set(tokenized[j].tokens);
            const shared = tokenized[i].tokens.filter(t => b.has(t));

            const aSubsetB = a.size >= 3 && [...a].every(t => b.has(t));
            const bSubsetA = b.size >= 3 && [...b].every(t => a.has(t));
            const nearDuplicate = sim >= 0.9 && shared.length >= 3;

            if (nearDuplicate || aSubsetB || bSubsetA) {
                reasons.push('overlapping_subtopic_titles');
                break;
            }
        }
        if (reasons.includes('overlapping_subtopic_titles')) break;
    }

    return reasons.length ? { ok: false, reasons } : { ok: true };
}

function sanitizeSubtopics(raw: unknown): RawSubtopic[] {
    if (!raw) return [];
    const baseArray = Array.isArray(raw)
        ? raw
        : typeof raw === 'object'
            ? (raw as any).subtopics || (raw as any).lessons || Object.values(raw as any).find(Array.isArray) || []
            : [];

    return (Array.isArray(baseArray) ? baseArray : []).map((item, idx) => {
        const name = (item as any)?.name?.toString().trim() || `Subtopic ${idx + 1}`;
        const description = (item as any)?.description?.toString().trim() || '';
        let estimatedMins = Number((item as any)?.estimatedMins);
        if (!ALLOWED_MINUTES.includes(estimatedMins)) {
            estimatedMins = 60;
        }
        return { name, description, estimatedMins };
    });
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { topicId, subjectName, topicName, contentPreferences } = await request.json();

        if (!topicId || !subjectName || !topicName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        console.log(`Generating subtopics for: ${topicName}`);

        const preferenceLines: string[] = [];
        const style = contentPreferences?.style as string | undefined;
        const tone = contentPreferences?.tone as string | undefined;
        const instructions = contentPreferences?.customInstructions as string | undefined;

        if (style) preferenceLines.push(`Adjust complexity for a "${style}" learner.`);
        if (tone) preferenceLines.push(`Use a "${tone}" tone in names and descriptions.`);
        if (instructions) preferenceLines.push(`User guidance: ${instructions}`);

        // 1. Check if subtopics already exist (double check)
        const existingCount = await prisma.subjectTopic.count({
            where: { parentId: topicId }
        });

        if (existingCount > 0) {
            return NextResponse.json({ message: 'Subtopics already exist', count: existingCount });
        }

        // 2. Research subtopics using web search (if available)
        const searchResults = await searchSubtopics(subjectName, topicName);
        const researchContext = searchResults
            ? `\nWEB RESEARCH (use this to inform your subtopics):\n${searchResults}\n`
            : '';

        // 3. Generate Subtopics Plan (with validation + 1 retry)
        const basePrompt = `
You are designing consolidated lessons (not micro-lessons). Output valid JSON only.

Task:
For the topic "${topicName}" in the subject "${subjectName}", generate EXACTLY 3 to 5 syllabus-style subtopics.
${researchContext}
${preferenceLines.length ? `User preferences (must follow):\n- ${preferenceLines.join('\n- ')}\n` : ''}

INTELLIGENCE RULES (be smart about this):
1) FIRST, identify if this topic belongs to a known curriculum (VCE, AP, IB, A-Level, HSC, etc.)
2) If it's a known curriculum topic, generate subtopics that MATCH the official syllabus breakdown.
3) Use any web research provided above to inform your subtopics.
4) Do NOT generate generic subtopics when specific curriculum content exists.

HARD RULES (do not violate):
1) Output MUST contain 3–5 items (no more, no less).
2) Each subtopic must be a BROAD lesson chunk that could reasonably take 30–90 minutes.
3) STRUCTURE BAN: do NOT use generic learning-template headings like:
   - Introduction/Intro/Overview
   - Foundations/Fundamentals/Basics when they are standalone generic headings
   - Core Concepts
   - Examples/Definitions/Exercises/Quiz/Practice/Review/Recap
   - Part 1/2, Unit 1, Module 1, Lesson 1, Chapter 1
   - Playful titles: fun, magic, adventure, journey, quest
4) No overlap: each subtopic must cover a distinct slice of the topic. If two subtopics sound similar, merge them.
5) Coverage: together, the 3–5 subtopics must cover the WHOLE topic (no missing major parts, no extra unrelated content).
6) Titles must be 2–6 words, specific and curriculum-like.
7) estimatedMins MUST be one of: 30, 45, 60, 75, 90.

CURRICULUM-SPECIFIC EXAMPLES:
- VCE Math Methods "Calculus: Differentiation" → "Limits and Continuity", "Derivative Rules", "Chain and Product Rules", "Applications of Derivatives"
- AP Physics "Mechanics" → "Kinematics Equations", "Newton's Laws", "Work and Energy", "Momentum and Collisions"
- A-Level Chemistry "Organic Chemistry" → "Alkanes and Alkenes", "Reaction Mechanisms", "Alcohols and Carbonyls", "Polymers"

Return ONLY a JSON object with this shape:
{
  "subtopics": [
    { "name": "…", "description": "…", "estimatedMins": 60 }
  ]
}
No markdown. No extra keys. No explanations.
`;

        const generateOnce = async (prompt: string) => {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are a curriculum designer. Output valid JSON only." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.6,
                response_format: { type: "json_object" }
            });
            const content = completion.choices[0].message.content || "{}";
            return JSON.parse(content);
        };

        let parsed: unknown;
        let subtopics: RawSubtopic[] = [];
        const attempt = async (prompt: string) => {
            parsed = await generateOnce(prompt);
            subtopics = sanitizeSubtopics(parsed);
            if (subtopics.length === 0) {
                subtopics = [
                    { name: `${topicName} Structures`, description: `Major structures and forms within ${topicName}`, estimatedMins: 60 },
                    { name: `${topicName} Methods`, description: `Methods and techniques used in ${topicName}`, estimatedMins: 60 },
                    { name: `${topicName} Interpretation`, description: `Interpret and communicate results in ${topicName}`, estimatedMins: 60 },
                ];
            }
        };

	        try {
	            await attempt(basePrompt);
	            const v1 = validateSubtopics(subtopics);
	            if (!v1.ok) {
	                console.warn('Subtopic generation validation failed (attempt 1)', {
	                    subject: subjectName,
	                    topic: topicName,
	                    reasons: v1.reasons,
	                    sampleTitles: subtopics.slice(0, 5).map(s => s.name).filter(Boolean),
	                });
	                const retryPrompt = `${basePrompt}

Your previous output violated these rules:
${v1.reasons.map(r => `- ${r}`).join('\n')}

Regenerate from scratch with the SAME JSON schema.
- Keep EXACTLY 3–5 consolidated lesson chunks.
- Remove generic template headings and micro-lesson titles.
- Remove playful wording.
- Remove overlap/near-duplicates.`;

	                await attempt(retryPrompt);
	                const v2 = validateSubtopics(subtopics);
	                if (!v2.ok) {
	                    console.warn('Subtopic generation validation failed (attempt 2)', {
	                        subject: subjectName,
	                        topic: topicName,
	                        reasons: v2.reasons,
	                        sampleTitles: subtopics.slice(0, 5).map(s => s.name).filter(Boolean),
	                    });
	                    return NextResponse.json({ error: `Generated subtopics failed validation: ${v2.reasons.join(', ')}` }, { status: 500 });
	                }
	            }
	        } catch (e) {
            console.error("Subtopics generation failed:", e);
            return NextResponse.json({ error: 'Failed to generate subtopics' }, { status: 500 });
        }

        // 3. Create Subtopics in DB
        const createdTopics = [];
        const parentTopic = await prisma.subjectTopic.findUnique({ where: { id: topicId }, select: { subjectId: true } });
        if (!parentTopic?.subjectId) {
            return NextResponse.json({ error: 'Parent topic not found' }, { status: 404 });
        }

        const usedSlugs = new Set<string>();
        for (let i = 0; i < subtopics.length; i++) {
            const st = subtopics[i];
            const name = st.name || `Subtopic ${i + 1}`;
            const baseSlug = `${slugify(topicName)}-${slugify(name)}`.substring(0, 45);
            let finalSlug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
            while (usedSlugs.has(finalSlug)) {
                finalSlug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
            }
            usedSlugs.add(finalSlug);

            const created = await prisma.subjectTopic.create({
                data: {
                    subjectId: parentTopic.subjectId,
                    parentId: topicId,
                    name: name.substring(0, 100), // Enforce limit just in case
                    slug: finalSlug,
                    description: st.description || "",
                    order: i + 1,
                    estimatedMins: ALLOWED_MINUTES.includes(st.estimatedMins || 0) ? st.estimatedMins! : 60,
                    level: 1 // Subtopic level
                }
            });
            createdTopics.push(created);
        }

        return NextResponse.json({ success: true, subtopics: createdTopics });

    } catch (error) {
        console.error('Subtopic generation failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
