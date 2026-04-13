import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { openai } from '@/lib/openai';
import { auth } from '@/lib/auth';

const FALLBACK_TRACK = 'coding';

const fallbackQuestions: Record<string, { prompt: string; topic: string; max: number }[]> = {
    coding: [
        { prompt: 'Arrays: find two-sum in O(n)', topic: 'Array', max: 10 },
        { prompt: 'Hash maps: detect duplicates', topic: 'Hash Table', max: 10 },
        { prompt: 'Linked lists: reverse a list', topic: 'Linked List', max: 10 },
        { prompt: 'Binary tree: level order traversal', topic: 'Tree', max: 10 },
        { prompt: 'DP: coin change minimum coins', topic: 'Dynamic Programming', max: 10 },
        { prompt: 'Graphs: detect cycle in directed graph', topic: 'Graph', max: 10 },
    ],
    law: [
        { prompt: 'Contracts: elements of formation (offer/acceptance/consideration)', topic: 'Contracts', max: 10 },
        { prompt: 'Torts: negligence elements and defenses', topic: 'Torts', max: 10 },
        { prompt: 'Criminal: mens rea + actus reus basics', topic: 'Criminal Law', max: 10 },
        { prompt: 'Con Law: levels of scrutiny application', topic: 'Constitutional Law', max: 10 },
        { prompt: 'Evidence: hearsay exceptions overview', topic: 'Evidence', max: 10 },
        { prompt: 'Property: adverse possession elements', topic: 'Property', max: 10 },
    ],
    general: [
        { prompt: 'Ability to identify key concepts in new material', topic: 'Comprehension', max: 10 },
        { prompt: 'Consistency in daily study habits', topic: 'Discipline', max: 10 },
        { prompt: 'Understanding of foundational vocabulary', topic: 'Vocabulary', max: 10 },
        { prompt: 'Ability to apply learned concepts to problems', topic: 'Application', max: 10 },
        { prompt: 'Confidence in retaining information long-term', topic: 'Retention', max: 10 },
        { prompt: 'Skill in summarizing complex topics simply', topic: 'Synthesis', max: 10 },
    ],
};

function buildPrompt(track: string) {
    return `Generate 6 specific concepts or skills for a ${track} student to rate their confidence on (0-10).
Do NOT ask open-ended questions like "Describe", "Summarize", or "Explain".
Focus on specific, key topics necessary for mastery.
Format each prompt as a clear concept or capability.
Examples: "Understanding of Big O Notation", "Ability to implement Hash Maps", "Knowledge of Contract Formation".
Output strictly JSON array: [{ "prompt": "...", "topic": "...", "max": 10 }].
Ensure prompts describe the START of a learning path (fundamentals) to intermediate concepts.`;
}

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get('subjectId');
    const track = searchParams.get('track') || FALLBACK_TRACK;
    const goal = searchParams.get('goal') || '';

    let specificTopics: { id: string, name: string }[] = [];

    // If subjectId provided, fetch real topics to ensure alignment
    if (subjectId) {
        specificTopics = await (prisma as any).subjectTopic.findMany({
            where: { subjectId, parentId: null }, // distinct root topics
            take: 6,
            select: { id: true, name: true }
        });
    }

    // Try existing questions for track (skip if we have specific topics to cover)
    // DISABLED: We want to generate questions based on the specific GOAL, not just the track.
    // Existing DB questions might be generic or irrelevant to the specific user goal.
    /*
    if (!subjectId && (prisma as any).diagnosticQuestions) {
        const existing = await (prisma as any).diagnosticQuestions.findMany({
            where: { track },
            orderBy: { createdAt: 'desc' },
            take: 6,
        });

        if (existing.length >= 3) {
            return NextResponse.json({ questions: existing });
        }
    }
    */

    let cleaned: { track: string; prompt: string; topicName: string; topicId?: string; maxScore: number }[] = [];

    const prompt = subjectId && specificTopics.length > 0
        ? `Generate one self-assessment confidence statement (0-10) for EACH of these specific topics: ${specificTopics.map(t => t.name).join(', ')}.
           Format: "Rate your confidence in [Topic Name]...".
           Output JSON array of objects with keys: "prompt", "topic" (must match input names exactly), "max" (10).`
        : buildPrompt(goal || track);

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You generate concise diagnostic assessment items.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
        });

        const raw = completion.choices[0]?.message?.content || '[]';
        // Remove markdown code blocks if present (e.g. ```json ... ```)
        const jsonString = raw.replace(/^```json\s*|\s*```$/g, '').trim();

        let parsed: { prompt: string; topic: string; max: number }[] = [];
        try {
            parsed = JSON.parse(jsonString);
        } catch (e) {
            console.error('Failed to parse AI response:', raw, e);
            parsed = [];
        }

        // Check if parsing worked, if not try regex or fallback
        if (!Array.isArray(parsed)) parsed = [];

        cleaned = parsed
            .filter(q => q.prompt)
            .slice(0, 6)
            .map(q => {
                // If we have specific topics, find the matching ID
                const matchingTopic = specificTopics.find(st => st.name.toLowerCase() === q.topic?.toLowerCase());

                return {
                    track,
                    prompt: q.prompt.slice(0, 180),
                    topicName: q.topic?.slice(0, 80) || 'General',
                    topicId: matchingTopic?.id, // attach ID !!
                    maxScore: q.max && Number.isFinite(q.max) ? q.max : 10,
                };
            });
    } catch (e) {
        console.error('AI Generation failed:', e);
        cleaned = [];
    }

    // Fallback logic if AI failed (use generic fallbacks even if subjectId was present to avoid empty state)
    if (cleaned.length === 0) {
        const fallback = fallbackQuestions[track] || fallbackQuestions['general'];
        cleaned = fallback.map((q, idx) => {
            // Try to map fallback to a real topic if names coincidentally match? Unlikely but safe.
            const matchingTopic = specificTopics.find(st => st.name.toLowerCase() === q.topic.toLowerCase());
            return {
                track,
                prompt: q.prompt.slice(0, 180),
                topicName: q.topic.slice(0, 80),
                topicId: matchingTopic?.id,
                maxScore: q.max,
            };
        }).slice(0, 6);
    }

    // Save to DB only if generic
    if (cleaned.length > 0 && !subjectId && (prisma as any).diagnosticQuestions) {
        try {
            await (prisma as any).diagnosticQuestions.createMany({
                data: cleaned.map(c => ({
                    track: c.track,
                    prompt: c.prompt,
                    topicName: c.topicName,
                    maxScore: c.maxScore,
                    createdByAi: true,
                })),
            });
        } catch (err) {
            console.error('Failed to save diagnostic questions:', err);
        }
    }

    return NextResponse.json({ questions: cleaned });
}
