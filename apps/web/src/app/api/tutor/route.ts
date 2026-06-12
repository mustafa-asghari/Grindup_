import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkCSRF } from '@/lib/csrf';
import { logSecurityEvent } from '@/lib/logging';
import { headers } from 'next/headers';
import { openai } from '@/lib/openai';

function cosineSimilarity(vecA: number[], vecB: number[]) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';

    // CSRF Protection
    const csrfValid = await checkCSRF();
    if (!csrfValid) {
        logSecurityEvent({ type: 'csrf_failure', userId: session.user.id, ip, route: '/api/tutor', status: 403 });
        return NextResponse.json({ error: 'Forbidden: CSRF check failed' }, { status: 403 });
    }

    // Rate Limiting
    const rateLimit = await checkRateLimit(session.user.id, 'tutor_chat', undefined, ip);
    if (!rateLimit.allowed) {
        logSecurityEvent({ type: 'rate_limit', userId: session.user.id, ip, route: '/api/tutor', status: 429 });
        return NextResponse.json({ 
            error: 'Too many requests. Please wait a moment.',
            resetAt: rateLimit.resetAt
        }, { status: 429 });
    }

    try {
        const { subjectId, query, history, contextData } = await req.json();

        if (!query || !subjectId) {
            return NextResponse.json({ error: 'Missing query or subjectId' }, { status: 400 });
        }

        // Input Truncation
        const safeQuery = query.slice(0, 1000);

        // 1. Generate Embedding for Query
        const embeddingRes = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: safeQuery,
        });
        const queryVector = embeddingRes.data[0].embedding;

        // 2. Retrieve Vectors for Subject (Textbook Content)
        let ragContext = '';
        try {
            const chunks = await prisma.subjectVectors.findMany({
                where: { subjectId },
            });

            // 3. Rank Chunks
            const scored = chunks
                .filter(c => Array.isArray(c.embedding) && c.embedding.length > 0)
                .map(c => ({
                    content: c.content,
                    score: cosineSimilarity(c.embedding, queryVector)
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 3); // Reduced to top 3 to leave room for subtopic context

            ragContext = scored.map(s => s.content).join('\n\n');
        } catch (ragError) {
            console.warn('RAG Retrieval failed (proceeding without textbook context):', ragError);
        }

        // Combined Context
        const combinedContext = `
${contextData ? `=== CURRENT LESSON & QUIZ (PRIORITY) ===\n${contextData}\n=====================================` : ''}

=== TEXTBOOK REFERENCE ===
${ragContext}
=========================
`;

        // 4. Chat Completion with STRICT source-only system prompt
        const systemPrompt = `
You are Professor Shadow, a precise and helpful AI tutor.
You are helping a student with content from THEIR IMPORTED MATERIALS ONLY.

CRITICAL RULES:
1. ONLY teach content that appears in the "TEXTBOOK REFERENCE" or "CURRENT LESSON & QUIZ" sections below.
2. If asked something NOT in the provided context, respond: "I can only teach from your imported materials. This topic isn't covered in your document. Would you like to explore what is covered?"
3. ALWAYS cite your source: "According to your imported material...", "Your document states that...", "From your PDF/notes..."
4. When referencing specific content, quote it directly when helpful.
5. Do NOT make up information or add extra details beyond what's in the source.
6. If the student asks about a quiz question, explain using ONLY the provided context.

OUTPUT FORMAT (must follow):
- Return Markdown only. No preambles, no small talk, no emojis.
- Use headings (##) and short paragraphs.
- Use LaTeX for math: inline $...$, display $$...$$.
- When listing problems, use numbered list items.
- If the user asks to format practice questions/answers, output exactly:
  ## Practice
  1. ...
  2. ...
  3. ...

  ## Answers
  1. ...
  2. ...
  3. ...
- First sentence must include a source line such as: "According to your imported materials, ..."

${ragContext ? `
=== YOUR IMPORTED MATERIALS (TEXTBOOK REFERENCE) ===
${ragContext}
====================================================` : '⚠️ No textbook content was imported for this subject.'}

${contextData ? `
=== CURRENT LESSON & QUIZ CONTEXT ===
${contextData}
=====================================` : ''}
        `;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
            { role: 'user', content: safeQuery }
        ];

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages as any,
            max_tokens: 500, // Limit output cost
        });

        const answer = completion.choices[0].message.content || "I'm not sure about that.";

        logSecurityEvent({
            type: 'ai_usage',
            userId: session.user.id,
            ip,
            route: '/api/tutor',
            status: 200,
            details: { promptSize: safeQuery.length, completionSize: answer.length }
        });

        // 5. Generate Voice (TTS)
        // User requested fast voice. 'alloy' or 'shimmer' or 'nova'. 'onyx' is deep. 
        // Let's use 'nova' for a generic pleasant voice or 'fable'.
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "nova",
            input: answer.slice(0, 4096), // Increased limit to allow full responses
            // Creating full audio might be slow. Let's do full but maybe trim if huge.
            // Actually answering concise is better.
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        const audioBase64 = buffer.toString('base64');

        return NextResponse.json({
            answer,
            audio: audioBase64
        });

    } catch (error: any) {
        logSecurityEvent({ type: 'ai_usage', userId: session.user.id, ip, route: '/api/tutor', status: 500, details: { error: error.message } });
        console.error('Tutor API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
