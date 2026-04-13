import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { messages, subjectId, topicId } = await request.json();

        // Get the last user message for embedding
        const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
        const query = lastUserMessage?.content || '';

        // Fetch RAG content from imported materials
        let ragContext = '';
        if (subjectId && query) {
            try {
                // Generate embedding for the query
                const embeddingRes = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: query,
                });
                const queryVector = embeddingRes.data[0].embedding;

                // Retrieve vectors for this subject
                const chunks = await prisma.subjectVectors.findMany({
                    where: { subjectId },
                });

                // Rank chunks by similarity
                const scored = chunks
                    .filter((c: any) => Array.isArray(c.embedding) && c.embedding.length > 0)
                    .map((c: any) => ({
                        content: c.content,
                        score: cosineSimilarity(c.embedding, queryVector)
                    }))
                    .sort((a: any, b: any) => b.score - a.score)
                    .slice(0, 5); // Top 5 most relevant chunks

                ragContext = scored.map((s: any) => s.content).join('\n\n---\n\n');
            } catch (ragError) {
                console.warn('RAG Retrieval failed:', ragError);
            }
        }

        // Fetch subject and topic info
        let subjectName = '';
        let topicName = '';
        let topicContent = '';

        if (subjectId) {
            const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
            if (subject) subjectName = subject.name;
        }

        if (topicId) {
            const topic = await prisma.subjectTopic.findUnique({ where: { id: topicId } });
            if (topic) {
                topicName = topic.name;
                topicContent = topic.content || '';
            }
        }

        // Build strict source-only system prompt
        const systemPrompt = `You are Professor Shadow, an intelligent AI Tutor for "${subjectName}".
You are helping a student with content from THEIR IMPORTED MATERIALS ONLY.
${topicName ? `Current topic: ${topicName}` : ''}

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY teach content that appears in "YOUR IMPORTED MATERIALS" section below.
2. If asked about something NOT in the provided materials, say: "That topic isn't covered in your imported document. I can only teach from your materials. Would you like to explore what IS covered?"
3. ALWAYS cite your source: "According to your document...", "Your imported material states...", "From your PDF/notes: '...'"
4. Quote the relevant parts of the document when explaining concepts.
5. Do NOT make up information, examples, or details not present in the source.
6. For quiz questions, only explain using the provided content.
7. If RAG content is empty, tell the user no materials were imported for this subject.
8. MATH FORMATTING - CRITICAL:
   - Use display math ($$ ... $$) for ALL formal equations.
   - Put every math block on its own line.
   - Separate math from text with blank lines.
   - NEVER mix math with text on the same line.

Be encouraging, helpful, and concise. Use a friendly cat-themed personality.

=== YOUR IMPORTED MATERIALS ===
${topicContent ? `📄 Current Topic Content:\n${topicContent}\n\n` : ''}
${ragContext ? `📚 Additional Related Content:\n${ragContext}` : ''}
${!topicContent && !ragContext ? '⚠️ No content has been imported for this subject yet. The student should import a PDF, video, or notes first.' : ''}
===============================`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages
            ],
            stream: false,
        });

        const reply = completion.choices[0].message.content;

        return NextResponse.json({ reply });

    } catch (error) {
        console.error('AI Tutor Error:', error);
        return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
    }
}

