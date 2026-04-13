import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { ExerciseType } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { openai } from '@/lib/openai';

// Helper to generate slug from name
function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Map category strings to enum values
const categoryMapping: Record<string, string> = {
    'stem': 'stem',
    'math': 'stem',
    'science': 'stem',
    'physics': 'stem',
    'chemistry': 'stem',
    'biology': 'stem',
    'technology': 'technology',
    'programming': 'technology',
    'coding': 'technology',
    'computer': 'technology',
    'software': 'technology',
    'professional': 'professional',
    'law': 'professional',
    'medicine': 'professional',
    'business': 'professional',
    'finance': 'professional',
    'humanities': 'humanities',
    'history': 'humanities',
    'philosophy': 'humanities',
    'literature': 'humanities',
    'languages': 'languages',
    'language': 'languages',
    'english': 'languages',
    'spanish': 'languages',
    'creative': 'creative',
    'art': 'creative',
    'music': 'creative',
    'design': 'creative',
    'lifestyle': 'lifestyle',
    'health': 'lifestyle',
    'fitness': 'lifestyle',
    'personal': 'lifestyle',
};

function detectCategory(name: string, description: string): string {
    const combined = `${name} ${description}`.toLowerCase();
    for (const [keyword, category] of Object.entries(categoryMapping)) {
        if (combined.includes(keyword)) {
            return category;
        }
    }
    return 'stem'; // Default
}

// Generic template/micro headings we want to block, without rejecting legitimate domain titles like
// "Fundamentals of Accounting" or "Application Programming Interfaces".
const GENERIC_HEADING_EXACT = new Set([
    'introduction',
    'intro',
    'overview',
    'review',
    'summary',
    'conclusion',
    'practice',
    'core concepts',
    'core concept',
    'applications',
    'application',
    // Only banned as standalone headings (allowed when paired with domain terms).
    'fundamentals',
    'foundations',
    'basics',
    'advanced',
]);

const GENERIC_HEADING_PREFIX_PATTERNS: RegExp[] = [
    /^(introduction|intro)\b/i,
    /^overview\b/i,
    // Narrow "review/summary/conclusion" bans to typical template phrasing.
    /^review\b(?:\s+of\b|$)/i,
    /^summary\b(?:\s+of\b|$)/i,
    /^conclusion\b(?:\s+of\b|$)/i,
    /^core\s+concepts?\b/i,
    // Ban "Applications of/in X" but allow domain terms like "Application Programming Interfaces".
    /^applications?\s+(of|in)\b/i,
    // Ban "Practice" when it's clearly a learning-template heading (but allow domain phrases like "Practice Management").
    /^practice\b(?:\s+(problems?|questions?|exercises?|quizzes?|quiz)\b|$)/i,
];

const MICRO_TOPIC_PATTERNS: RegExp[] = [
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

// Generic "next-level" indicators; applied conservatively when academic level isn't explicitly advanced.
const NEXT_LEVEL_KEYWORDS_CONSERVATIVE = [
    'eigenvalue',
    'eigenvector',
    'laplace transform',
    'fourier transform',
    'multivariable',
    'partial derivative',
    'tensor',
    'differential equations',
    'differential equation',
] as const;

// Web search function using Serper API
async function searchCurriculum(subjectName: string): Promise<string | null> {
    const serperApiKey = process.env.SERPER_API_KEY;
    if (!serperApiKey) {
        console.log('SERPER_API_KEY not configured, skipping web search');
        return null;
    }

    try {
        // Search for official syllabus/curriculum information
        const searchQueries = [
            `"${subjectName}" official syllabus curriculum topics units`,
            `"${subjectName}" study design course outline`,
        ];

        const results: string[] = [];

        for (const query of searchQueries) {
            const response = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'X-API-KEY': serperApiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: query,
                    num: 5,
                }),
            });

            if (!response.ok) {
                console.warn('Serper search failed:', response.status);
                continue;
            }

            const data = await response.json();

            // Extract relevant information from search results
            if (data.organic) {
                for (const result of data.organic.slice(0, 3)) {
                    const snippet = `Source: ${result.title}\n${result.snippet || ''}\nURL: ${result.link}`;
                    results.push(snippet);
                }
            }

            // Also check knowledge graph if available
            if (data.knowledgeGraph?.description) {
                results.push(`Knowledge: ${data.knowledgeGraph.description}`);
            }
        }

        if (results.length > 0) {
            return results.join('\n\n---\n\n');
        }
    } catch (error) {
        console.error('Web search failed:', error);
    }

    return null;
}

// Intelligent curriculum research using AI
async function researchCurriculum(subjectName: string, description: string | undefined): Promise<{
    standardSystem: string;
    yearLevel: string;
    officialTopics: string[];
    confidence: 'high' | 'medium' | 'low';
    searchResults?: string;
} | null> {
    // First, try web search for real curriculum data
    const searchResults = await searchCurriculum(subjectName);

    const researchPrompt = `You are a curriculum research expert. Analyze this subject and identify its EXACT curriculum/syllabus structure.

Subject: "${subjectName}"
${description ? `Context: ${description}` : ''}

${searchResults ? `WEB SEARCH RESULTS (use this information!):\n${searchResults}\n` : ''}

TASK: Identify the official curriculum this subject belongs to and its EXACT topic structure.

RESEARCH PROCESS:
1. Determine which educational system this subject belongs to:
   - VCE (Victoria, Australia): Math Methods, Specialist Maths, Further Maths, Physics, Chemistry, etc.
   - AP (USA): AP Calculus AB/BC, AP Physics 1/2/C, AP Chemistry, AP Biology, etc.
   - IB Diploma: Mathematics AA/AI HL/SL, Physics HL/SL, Sciences, etc.
   - A-Level (UK): Mathematics, Further Maths, Physics, Chemistry, Biology, etc.
   - HSC (NSW, Australia): Mathematics Advanced/Extension, Physics, Chemistry, etc.
   - NCEA (New Zealand): Level 1/2/3 subjects
   - University courses: Identify the typical curriculum
   - Professional certifications: Identify standard modules

2. Find the OFFICIAL topic structure from that curriculum's study design/syllabus.

3. Return the exact topics as they appear in the official syllabus (not generic textbook chapters).

CRITICAL RULES:
- If you recognize this as a specific curriculum subject (e.g., "Math Methods" = VCE Mathematical Methods), use the OFFICIAL syllabus topics.
- Do NOT generate generic topics like "Introduction", "Basics", "Advanced Topics".
- Do NOT generate generic math topics like "Functions and Graphs", "Algebraic Techniques" when a specific curriculum structure exists.
- The topics should match what a student would see in their actual course outline.

Return ONLY a JSON object:
{
    "standardSystem": "exact curriculum name (e.g., 'VCE', 'AP', 'IB DP', 'A-Level')",
    "yearLevel": "year/grade level",
    "officialTopics": ["Topic 1 from syllabus", "Topic 2 from syllabus", ...],
    "confidence": "high" | "medium" | "low",
    "reasoning": "brief explanation of how you identified this curriculum"
}`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are a curriculum expert who knows official syllabi from VCE, AP, IB, A-Level, HSC, NCEA, and university systems worldwide. You identify subjects and return their EXACT official topic structures. Always output valid JSON.'
                },
                { role: 'user', content: researchPrompt }
            ],
            temperature: 0.2, // Low temperature for accuracy
            max_tokens: 1500,
            response_format: { type: 'json_object' },
        });

        const content = completion.choices[0]?.message?.content || '{}';
        const result = JSON.parse(content);

        if (result.officialTopics && Array.isArray(result.officialTopics) && result.officialTopics.length >= 3) {
            return {
                standardSystem: result.standardSystem || 'Unknown',
                yearLevel: result.yearLevel || 'Unknown',
                officialTopics: result.officialTopics,
                confidence: result.confidence || 'medium',
                searchResults: searchResults || undefined,
            };
        }
    } catch (error) {
        console.error('Curriculum research failed:', error);
    }

    return null;
}

const TITLE_STOPWORDS = new Set([
    'and', 'or', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'with', 'on', 'at', 'by', 'from',
]);

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

function isAdvancedScope(standardSystem?: unknown, yearLevelOrStage?: unknown): boolean | null {
    const s = `${standardSystem ?? ''} ${yearLevelOrStage ?? ''}`.toLowerCase().trim();
    if (!s) return null;
    if (/(university|undergrad|undergraduate|bachelor|college|year\s*[1-4]|freshman|sophomore|junior|senior)/i.test(s)) return true;
    if (/(cert|certificate|certification|professional|industry|bootcamp)/i.test(s)) return true;
    return false;
}

function isGenericHeading(normalized: string, tokens: string[]): boolean {
    // Exact match ban (template headings)
    if (GENERIC_HEADING_EXACT.has(normalized)) return true;

    // Prefix bans for common learning-template phrasing
    for (const re of GENERIC_HEADING_PREFIX_PATTERNS) {
        if (re.test(normalized)) return true;
    }

    // Ban "Foundations/Fundamentals/Basics/Advanced" only when they don't meaningfully include domain terms.
    // E.g., allow "Fundamentals of Accounting" but ban standalone "Fundamentals".
    const first = tokens[0] || '';
    if (['fundamentals', 'foundations', 'basics', 'advanced'].includes(first)) {
        // If there is at least one other meaningful token, treat as domain-specific and allow.
        if (tokens.length >= 2) return false;
        return true;
    }

    return false;
}

function validateGeneratedTopics(input: {
    topics: unknown;
    standardSystem?: unknown;
    yearLevelOrStage?: unknown;
    subjectName?: string;
}): { ok: true } | { ok: false; reasons: string[] } {
    const reasons: string[] = [];
    const topics = Array.isArray(input.topics) ? input.topics : [];

    if (topics.length < 3 || topics.length > 30) {
        reasons.push(`topics_count_out_of_range:${topics.length}`);
    }

    const seen = new Set<string>();
    const tokenized: Array<{ tokens: string[]; name: string }> = [];
    for (const t of topics) {
        const rawName = (t as any)?.name;
        const name = typeof rawName === 'string' ? rawName : '';
        const normalized = normalizeTitle(name);
        const tokens = tokenizeTitle(name);

        if (!normalized) {
            reasons.push('topic_missing_name');
            continue;
        }

        if (tokens.some(tok => PLAYFUL_TITLE_TOKENS.has(tok))) {
            reasons.push('playful_topic_title');
        }

        // Reject nested outlines for "topics" (those belong in subtopics).
        if (Array.isArray((t as any)?.subtopics) || Array.isArray((t as any)?.topics) || Array.isArray((t as any)?.children)) {
            reasons.push('nested_topics_not_allowed');
        }

        if (isGenericHeading(normalized, tokens)) {
            reasons.push('generic_template_heading');
        }

        for (const re of MICRO_TOPIC_PATTERNS) {
            if (re.test(name)) {
                reasons.push('micro_topic_title');
                break;
            }
        }

        if (seen.has(normalized)) reasons.push('duplicate_topic_title');
        seen.add(normalized);
        tokenized.push({ tokens, name });
    }

    // Overlap heuristic: token similarity between topic titles
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
                reasons.push('overlapping_topic_titles');
                break;
            }
        }
        if (reasons.includes('overlapping_topic_titles')) break;
    }

    const advancedScope = isAdvancedScope(input.standardSystem, input.yearLevelOrStage);
    if (advancedScope !== true) {
        for (const t of topics) {
            const rawName = (t as any)?.name;
            const name = typeof rawName === 'string' ? rawName : '';
            const normalized = normalizeTitle(name);
            for (const keyword of NEXT_LEVEL_KEYWORDS_CONSERVATIVE) {
                if (normalized.includes(keyword)) {
                    reasons.push(`scope_creep_keyword:${keyword}`);
                    break;
                }
            }
        }
    }

    return reasons.length ? { ok: false, reasons } : { ok: true };
}

function sanitizeExerciseTypes(types: any): ExerciseType[] {
    const allowed = new Set(Object.values(ExerciseType));
    if (!Array.isArray(types)) return [ExerciseType.mcq];

    const normalized = types
        .map((t: any) => String(t || '').toLowerCase().trim())
        .filter(Boolean);

    const deduped = Array.from(new Set(normalized));
    const mapped = deduped
        .map((t) => {
            if (t === 'true/false' || t === 'true-false') return ExerciseType.true_false;
            if (allowed.has(t as ExerciseType)) return t as ExerciseType;
            return null;
        })
        .filter(Boolean) as ExerciseType[];

    return mapped.length > 0 ? mapped : [ExerciseType.mcq];
}

type RawTopic = {
    name?: string;
    slug?: string;
    description?: string;
    order?: number;
    estimatedMins?: number;
    estimated_minutes?: number;
    subtopics?: RawTopic[];
    topics?: RawTopic[];
    children?: RawTopic[];
};

function normalizeTopics(raw: any, subjectSlug: string): Array<{
    name: string;
    slug: string;
    description: string | null;
    order: number;
    estimatedMins: number;
    level: number;
}> {
    if (!Array.isArray(raw)) return [];

    const topics: Array<{
        name: string;
        slug: string;
        description: string | null;
        order?: number;
        estimatedMins?: number;
        level: number;
    }> = [];
    const usedSlugs = new Set<string>();

    const addTopic = (topic: RawTopic, depth: number) => {
        const name = (topic.name || '').toString().trim() || `Topic ${topics.length + 1}`;
        const baseSlug = (topic.slug || slugify(name)).slice(0, 60) || `topic-${topics.length + 1}`;
        let finalSlug = baseSlug;
        let suffix = 2;
        while (usedSlugs.has(finalSlug)) {
            finalSlug = `${baseSlug}-${suffix}`;
            suffix += 1;
        }
        usedSlugs.add(finalSlug);

        topics.push({
            name: name.slice(0, 100),
            slug: finalSlug,
            description: topic.description?.toString().slice(0, 400) || null,
            order: topic.order,
            estimatedMins: topic.estimatedMins ?? topic.estimated_minutes,
            level: depth,
        });

        const children = topic.subtopics || topic.topics || topic.children;
        if (Array.isArray(children)) {
            children.forEach(child => addTopic(child, depth + 1));
        }
    };

    raw.forEach((topic: RawTopic) => addTopic(topic, 0));

    return topics.map((t, index) => ({
        ...t,
        order: t.order ?? index + 1,
        estimatedMins: t.estimatedMins ?? 60,
        level: Number.isFinite(t.level) ? t.level : 0,
    }));
}

export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, description, topics: manualTopics } = await request.json();

        if (!name || name.trim().length < 2) {
            return NextResponse.json(
                { error: 'Subject name is required (min 2 characters)' },
                { status: 400 }
            );
        }

        const slug = slugify(name);

        // Check if subject already exists
        const existing = await (prisma as any).subject.findFirst({
            where: {
                OR: [
                    { slug },
                    { name: { equals: name, mode: 'insensitive' } },
                ],
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: 'A subject with this name already exists', existingSlug: existing.slug },
                { status: 409 }
            );
        }

        let aiResult: any = null;

        // Only use AI if manual topics are NOT provided or if we need metadata
        // If manual topics are provided, we might still want AI to generate metadata if missing (icon, color, category)
        // But the prompt should be different.

        if (!manualTopics || manualTopics.length === 0) {
            // Step 1: Intelligent curriculum research (with web search if available)
            console.log(`Researching curriculum for: ${name}`);
            const curriculumResearch = await researchCurriculum(name, description);

            if (curriculumResearch && curriculumResearch.confidence !== 'low' && curriculumResearch.officialTopics.length >= 3) {
                // Use researched curriculum topics
                console.log(`Found curriculum: ${curriculumResearch.standardSystem} (${curriculumResearch.confidence} confidence)`);
                const detectedCategory = detectCategory(name, description || '');

                // Generate metadata and topic descriptions using AI
                const metadataPrompt = `Generate metadata for the subject "${name}" which follows the ${curriculumResearch.standardSystem} curriculum.

Official topics from syllabus: ${curriculumResearch.officialTopics.join(', ')}

Return JSON with:
{
    "description": "compelling 1-2 sentence description (150 chars max)",
    "icon": "single emoji",
    "color": "hex color code",
    "difficultyLevel": "beginner" | "intermediate" | "advanced",
    "estimatedHours": number (20-150),
    "exerciseTypes": ["mcq", "flashcard", etc.],
    "topicDescriptions": {
        "Topic Name": "1-2 sentence description of what this topic covers"
    }
}`;

                let metadata: any = {};
                try {
                    const metaCompletion = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: 'Generate educational metadata. Output valid JSON only.' },
                            { role: 'user', content: metadataPrompt }
                        ],
                        temperature: 0.5,
                        max_tokens: 1000,
                        response_format: { type: 'json_object' },
                    });
                    metadata = JSON.parse(metaCompletion.choices[0]?.message?.content || '{}');
                } catch (e) {
                    console.warn('Metadata generation failed:', e);
                }

                aiResult = {
                    description: metadata.description || description || `Master ${name} with structured lessons following the ${curriculumResearch.standardSystem} syllabus.`,
                    icon: metadata.icon || (name.toLowerCase().includes('math') ? '📐' : name.toLowerCase().includes('physics') ? '⚛️' : name.toLowerCase().includes('chemistry') ? '🧪' : '📚'),
                    color: metadata.color || '#3b82f6',
                    category: detectedCategory,
                    difficultyLevel: metadata.difficultyLevel || 'intermediate',
                    estimatedHours: metadata.estimatedHours || 60,
                    exerciseTypes: metadata.exerciseTypes || ['mcq', 'flashcard', 'fill_blank'],
                    standardSystem: curriculumResearch.standardSystem,
                    yearLevelOrStage: curriculumResearch.yearLevel,
                    needsClarification: false,
                    clarifyingQuestions: [],
                    topics: curriculumResearch.officialTopics.map((topicName, i) => ({
                        name: topicName,
                        slug: slugify(topicName),
                        description: metadata.topicDescriptions?.[topicName] || `Study ${topicName} as part of ${name}`,
                        order: i + 1,
                        estimatedMins: Math.round((metadata.estimatedHours || 60) * 60 / curriculumResearch.officialTopics.length)
                    }))
                };
            } else {
                // Step 2: Full AI generation with research context (if available)
                const researchContext = curriculumResearch
                    ? `\nPRELIMINARY RESEARCH (use this context):\n- Possible curriculum: ${curriculumResearch.standardSystem}\n- Year level: ${curriculumResearch.yearLevel}\n- Suggested topics: ${curriculumResearch.officialTopics.join(', ')}\n${curriculumResearch.searchResults ? `\nWeb search results:\n${curriculumResearch.searchResults}` : ''}\n`
                    : '';

                const basePrompt = `
You are an expert curriculum designer with deep knowledge of educational standards worldwide. Output valid JSON only (no markdown, no extra text).

Goal: Generate an accurate, syllabus-style topic outline for: "${name}"${description ? ` (context: ${description})` : ''}.
${researchContext}
CURRICULUM AWARENESS (critical):
0) First, determine if this subject matches ANY known curriculum/syllabus:
   - VCE (Victoria, Australia): Math Methods, Specialist Maths, Further Maths, Physics, Chemistry, Biology, English
   - AP (USA): AP Calculus AB/BC, AP Physics 1/2/C, AP Chemistry, AP Biology, AP Statistics
   - IB Diploma: Mathematics AA/AI HL/SL, Physics HL/SL, Chemistry HL/SL
   - A-Level (UK): Mathematics, Further Maths, Physics, Chemistry, Biology
   - HSC (NSW, Australia): Mathematics Advanced/Extension, Physics, Chemistry
   - NCEA (New Zealand): Level 1/2/3 subjects

   If the subject matches a known curriculum, generate topics that EXACTLY match that curriculum's syllabus structure.
   Do NOT generate generic topics when a specific syllabus exists.

LEVEL CONSISTENCY (mandatory):
1) Identify ONE most likely standard/system AND ONE academic level/stage for this subject.
2) Do NOT choose a university scope unless the subject title strongly implies university-level study (e.g., "Linear Algebra", "Calculus I") or explicitly says "university".
3) ALL topics must stay within that ONE level. Do NOT mix levels.
4) If the subject is ambiguous, set "needsClarification": true and keep the outline conservative (no scope creep). Provide up to 3 "clarifyingQuestions".

SCOPE CONTROL (mandatory):
5) Use ONLY content clearly inside the chosen standardSystem/yearLevelOrStage.
6) Exclude adjacent/next-level topics unless the chosen scope is explicitly university.
7) Do NOT include prerequisite remediation unless essential to understand the standard syllabus.

STRUCTURE BAN (mandatory):
8) Topics must be syllabus-style topic buckets (domain headings), not MOOC sections.
9) BANNED section titles/patterns (must NOT appear as standalone template headings):
   - Introduction / Intro / Overview
   - Core Concepts
   - Applications (as a generic heading, e.g. "Applications of X")
   - Practice (as a generic heading, e.g. "Practice Problems")
   - Foundations / Fundamentals / Basics when they are standalone generic headings (allowed when paired with domain terms like "Fundamentals of Accounting")
   - Advanced / Review / Summary / Conclusion
   - Part 1/2, Unit 1, Module 1, Lesson 1, Chapter 1
   - Examples, Exercises, Quiz, Recap
   - Playful titles: fun, magic, adventure, journey, quest
   - Generic math headings like "Functions and Graphs", "Algebraic Techniques", "Calculus" when a specific curriculum breakdown exists

CONSOLIDATION (mandatory):
10) Generate as many topic as the subject needs no more no less (inclusive).
11) Each topic name must be 2–6 words and specific/curriculum-like.
12) Topics should reflect the ACTUAL syllabus structure of the identified curriculum, not generic textbook chapters.
13) No overlap between topics: if two topics are similar, merge them.
14) Topics should be as specific as possible.
15) Topics should be in a proper structure.
16) Topics should be in a proper order.
17) Topics should have a proper latex math formula.
18) if there is a math question or example or formula or any math content in the topic it should be in a proper spacing from the content of the topic.
19) never mix math content with non math content.
20) if there is a math question or example or formula or any math content move them into next line below the content (new line) of the topic move them in the middle of the topic.


SELF-CHECK (do silently before answering):
- Does this match a known curriculum? If yes, are topics syllabus-accurate? 
- No banned/generic titles 
- No overlap 
- Single academic level 
- No scope creep 
- make that your syllabus is complete 
- research about the topics to make sure that your syllabus is complete 
- do not miss any topic 

Output a JSON object with EXACTLY these keys:
{
  "description": string (<=150 chars),
  "icon": string,
  "color": string (hex),
  "category": one of [stem, technology, professional, humanities, languages, creative, lifestyle],
  "difficultyLevel": one of [beginner, intermediate, advanced],
  "estimatedHours": number (20-150),
  "exerciseTypes": array (strings from: coding, mcq, flashcard, fill_blank, essay, matching, ordering, diagram, audio, true_false),
  "standardSystem": string,
  "yearLevelOrStage": string,
  "needsClarification": boolean,
  "clarifyingQuestions": array (0-3 strings),
  "topics": array (3-30 items) of { "name": string, "slug": string, "description": string, "order": number, "estimatedMins": number }
}
`;

                const generateOnce = async (prompt: string) => {
                    const completion = await openai.chat.completions.create({
                        model: 'gpt-4o',
                        messages: [
                            { role: 'system', content: 'You are an expert curriculum designer. Stay inside a single academic level and output valid JSON only.' },
                            { role: 'user', content: prompt },
                        ],
                        temperature: 0.4,
                        max_tokens: 2000,
                        response_format: { type: 'json_object' },
                    });

                    const content = completion.choices[0]?.message?.content || '{}';
                    return JSON.parse(content);
                };

                try {
                    aiResult = await generateOnce(basePrompt);
                    const validation = validateGeneratedTopics({
                        topics: aiResult?.topics,
                        standardSystem: aiResult?.standardSystem,
                        yearLevelOrStage: aiResult?.yearLevelOrStage,
                        subjectName: name,
                    });

                    if (!validation.ok) {
                        console.warn('Topic generation validation failed (attempt 1)', {
                            subject: name,
                            reasons: validation.reasons,
                            sampleTitles: Array.isArray(aiResult?.topics)
                                ? aiResult.topics.slice(0, 8).map((t: any) => t?.name).filter(Boolean)
                                : [],
                        });
                        const retryPrompt = `${basePrompt}

Your previous output violated these rules:
${validation.reasons.map(r => `- ${r}`).join('\n')}

Regenerate from scratch with the SAME JSON schema.
- Keep ONE academic level only.
- Use 5–8 syllabus-style domain buckets.
- Remove generic template headings and micro-lesson titles.
- Remove overlap/near-duplicates.`;

                        aiResult = await generateOnce(retryPrompt);
                        const validation2 = validateGeneratedTopics({
                            topics: aiResult?.topics,
                            standardSystem: aiResult?.standardSystem,
                            yearLevelOrStage: aiResult?.yearLevelOrStage,
                            subjectName: name,
                        });

                        if (!validation2.ok) {
                            console.warn('Topic generation validation failed (attempt 2)', {
                                subject: name,
                                reasons: validation2.reasons,
                                sampleTitles: Array.isArray(aiResult?.topics)
                                    ? aiResult.topics.slice(0, 8).map((t: any) => t?.name).filter(Boolean)
                                    : [],
                            });
                            // Soft-fail into fallback topics so the UI never ends up with "nothing".
                            aiResult = null;
                        }
                    }
                } catch (aiError) {
                    console.error('AI generation failed:', aiError);
                    aiResult = null;
                }
            }
        }

        if (manualTopics && manualTopics.length > 0) { // Check manual topics
            // Manual mode - just generate metadata if possible
            const prompt = `Generate metadata for learning subject "${name}"${description ? ` with context: ${description}` : ''}.

Return a JSON object with:
1. "description": A compelling 1-2 sentence description of the subject (150 chars max)
2. "icon": A single emoji that represents this subject
3. "color": A hex color code that fits the subject theme (e.g., "#3b82f6")
4. "category": One of: stem, technology, professional, humanities, languages, creative, lifestyle
5. "difficultyLevel": One of: beginner, intermediate, advanced
6. "estimatedHours": Estimated total hours to complete (number between 20-150)
7. "exerciseTypes": Array of applicable types from: coding, mcq, flashcard, fill_blank, essay, matching, ordering, true_false, audio

Respond with ONLY valid JSON, no markdown or explanation.`;


            try {
                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You are an expert curriculum designer. Generate metadata.' },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.7,
                    max_tokens: 500,
                    response_format: { type: 'json_object' },
                });

                const rawContent = completion.choices[0]?.message?.content || '{}';
                aiResult = JSON.parse(rawContent);
            } catch (aiError) {
                console.error('AI metadata generation failed:', aiError);
            }
        }

        // Fallback if AI fails
        if (!aiResult) {
            const detectedCategory = detectCategory(name, description || '');
            aiResult = {
                description: description || `Learn ${name} with structured lessons and exercises.`,
                icon: '📚',
                color: '#3b82f6',
                category: detectedCategory,
                difficultyLevel: 'intermediate',
                estimatedHours: 40,
                exerciseTypes: ['mcq', 'flashcard', 'fill_blank'],
                topics: manualTopics || [
                    { name: 'Key Ideas and Language', slug: 'key-ideas-language', description: `Core terminology and ideas in ${name}`, order: 1, estimatedMins: 60 },
                    { name: 'Models and Representations', slug: 'models-representations', description: `Common models/representations used in ${name}`, order: 2, estimatedMins: 90 },
                    { name: 'Methods and Techniques', slug: 'methods-techniques', description: `Typical methods and techniques for ${name}`, order: 3, estimatedMins: 90 },
                    { name: 'Contextual Analysis', slug: 'contextual-analysis', description: `Analyze realistic contexts within ${name}`, order: 4, estimatedMins: 75 },
                    { name: 'Integrated Assessments', slug: 'integrated-assessments', description: `Integrated tasks aligned to ${name}`, order: 5, estimatedMins: 90 },
                ],
            };
        } else if (manualTopics && manualTopics.length > 0) {
            // If AI succeeded but we have manual topics, use manual topics
            aiResult.topics = manualTopics;
        }

        const exerciseTypes = sanitizeExerciseTypes(aiResult.exerciseTypes);
        let topics = normalizeTopics(aiResult.topics || manualTopics, slug);
        if (topics.length === 0) {
            topics = normalizeTopics([
                { name: 'Key Ideas and Language', description: `Core terminology and ideas in ${name}`, estimatedMins: 60 },
                { name: 'Models and Representations', description: `Common models/representations used in ${name}`, estimatedMins: 90 },
                { name: 'Methods and Techniques', description: `Typical methods and techniques for ${name}`, estimatedMins: 90 },
                { name: 'Contextual Analysis', description: `Analyze realistic contexts within ${name}`, estimatedMins: 75 },
                { name: 'Integrated Assessments', description: `Integrated tasks aligned to ${name}`, estimatedMins: 90 },
            ], slug);
        }

        // Create the subject
        const subject = await (prisma as any).subject.create({
            data: {
                name: name.trim(),
                slug,
                description: aiResult.description?.slice(0, 500) || null,
                icon: aiResult.icon || '📚',
                color: aiResult.color || '#3b82f6',
                category: aiResult.category || 'stem',
                difficultyLevel: aiResult.difficultyLevel || 'intermediate',
                estimatedHours: aiResult.estimatedHours || 40,
                exerciseTypes,
                isActive: true,
            },
        });

        // Create topics
        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            await (prisma as any).subjectTopic.create({
                data: {
                    subjectId: subject.id,
                    name: topic.name,
                    slug: topic.slug || slugify(topic.name),
                    description: topic.description || null,
                    order: topic.order || (i + 1),
                    estimatedMins: topic.estimatedMins || 60,
                    level: 0,
                },
            });
        }

        // Auto-enroll the creator
        await (prisma as any).userSubject.create({
            data: {
                userId: session.user.id,
                subjectId: subject.id,
                status: 'active',
            },
        });

        // Revalidate the subjects pages so the new subject shows up
        revalidatePath('/subjects');
        revalidatePath('/');

        return NextResponse.json({
            success: true,
            subject: {
                id: subject.id,
                name: subject.name,
                slug: subject.slug,
                description: subject.description,
                icon: subject.icon,
                color: subject.color,
                category: subject.category,
                topicsCreated: topics.length,
            },
        });
    } catch (error) {
        console.error('Error creating subject:', error);
        return NextResponse.json(
            { error: 'Failed to create subject' },
            { status: 500 }
        );
    }
}
