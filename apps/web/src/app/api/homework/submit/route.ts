import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import OpenAI from 'openai';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Extract text from uploaded file
async function extractTextFromFile(file: File): Promise<{ text: string | null; fileType: string }> {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    // Determine file type
    let fileType = 'unknown';
    if (fileName.endsWith('.pdf')) fileType = 'pdf';
    else if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].some(ext => fileName.endsWith(ext))) fileType = 'image';
    else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) fileType = 'txt';
    else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) fileType = 'doc';

    // For images, use GPT-4 Vision
    if (fileType === 'image' || file.type.startsWith('image/')) {
        try {
            const base64Image = buffer.toString('base64');
            const mimeType = file.type || 'image/png';

            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Extract ALL the text and content from this homework submission image. Include any handwritten text, printed text, diagrams descriptions, and mathematical expressions.'
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Image}`,
                                    detail: 'high'
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 4000,
            });

            return {
                text: response.choices[0]?.message?.content?.trim() || null,
                fileType: 'image'
            };
        } catch (e) {
            console.error('Image OCR failed:', e);
            return { text: null, fileType: 'image' };
        }
    }

    // For PDFs
    if (fileType === 'pdf') {
        try {
            const { createRequire } = await import('module');
            const require = createRequire(import.meta.url);
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            const text = data.text?.trim() || '';
            if (text.length > 50) {
                return { text, fileType: 'pdf' };
            }

            // If pdf-parse returns little text, try Vision OCR
            console.log('PDF has minimal text, trying Vision OCR...');
            const { pdfToPng } = await import('pdf-to-png-converter');
            const pngPages = await pdfToPng(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), {
                disableFontFace: true,
                useSystemFonts: true,
                viewportScale: 2.0,
                pagesToProcess: [1, 2, 3],
            });

            if (pngPages && pngPages.length > 0) {
                const imageContents = pngPages
                    .filter(page => page.content)
                    .map(page => ({
                        type: 'image_url' as const,
                        image_url: {
                            url: `data:image/png;base64,${Buffer.from(page.content!).toString('base64')}`,
                            detail: 'high' as const
                        }
                    }));

                const response = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: 'Extract ALL the text and content from these homework submission pages. Include any handwritten text, printed text, and mathematical expressions.'
                                },
                                ...imageContents
                            ]
                        }
                    ],
                    max_tokens: 8000,
                });

                return {
                    text: response.choices[0]?.message?.content?.trim() || null,
                    fileType: 'pdf'
                };
            }

            return { text: text || null, fileType: 'pdf' };
        } catch (e) {
            console.error('PDF extraction failed:', e);
            return { text: null, fileType: 'pdf' };
        }
    }

    // For text files
    if (fileType === 'txt') {
        return {
            text: buffer.toString('utf8'),
            fileType: 'txt'
        };
    }

    // For doc files, try to read as text
    try {
        const text = buffer.toString('utf8');
        const isBinary = text.replace(/[^\x20-\x7E\n\r\t]/g, '').length / text.length < 0.85;
        if (!isBinary) {
            return { text, fileType };
        }
    } catch (e) {
        // Ignore
    }

    return { text: null, fileType };
}

// Grade homework submission with AI
async function gradeSubmission(
    content: string,
    homeworkTitle: string,
    homeworkDescription: string | null
): Promise<{ feedback: string; score: number }> {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content: `You are a helpful and encouraging teacher providing feedback on student homework submissions. 
Provide constructive feedback that:
1. Highlights what the student did well
2. Points out areas for improvement with specific suggestions
3. Encourages continued learning

Always be supportive and educational. Rate the submission on a scale of 0-100.`
            },
            {
                role: 'user',
                content: `Please grade this homework submission:

**Assignment:** ${homeworkTitle}
${homeworkDescription ? `**Description:** ${homeworkDescription}` : ''}

**Student Submission:**
${content}

Provide your feedback in the following format:
1. Overall Assessment (1-2 sentences)
2. Strengths (bullet points)
3. Areas for Improvement (bullet points with suggestions)
4. Score: [0-100]
5. Encouraging closing message`
            }
        ],
        temperature: 0.7,
    });

    const feedback = response.choices[0]?.message?.content?.trim() || 'Unable to generate feedback.';

    // Extract score from feedback
    let score = 70; // Default score
    const scoreMatch = feedback.match(/Score:\s*(\d+)/i);
    if (scoreMatch) {
        score = Math.min(100, Math.max(0, parseInt(scoreMatch[1])));
    }

    return { feedback, score };
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const contentType = request.headers.get('content-type') || '';

        let homeworkId = '';
        let textContent = '';
        let file: File | null = null;

        if (contentType.includes('multipart/form-data')) {
            const form = await request.formData();
            homeworkId = (form.get('homeworkId') as string) || '';
            textContent = (form.get('textContent') as string) || '';
            const fileData = form.get('file');
            if (fileData && fileData instanceof File) {
                file = fileData;
            }
        } else {
            const body = await request.json();
            homeworkId = body.homeworkId || '';
            textContent = body.textContent || '';
        }

        if (!homeworkId) {
            return NextResponse.json({ error: 'Homework ID required' }, { status: 400 });
        }

        // Verify homework exists and belongs to user
        const homework = await prisma.homeworkAssignment.findFirst({
            where: {
                id: homeworkId,
                userId: session.user.id,
            },
        });

        if (!homework) {
            return NextResponse.json({ error: 'Homework not found' }, { status: 404 });
        }

        // Determine submission type and extract content
        let submissionType = 'text';
        let extractedContent = textContent;
        let fileName = null;
        let fileType = null;

        if (file) {
            submissionType = 'file';
            fileName = file.name;

            const result = await extractTextFromFile(file);
            fileType = result.fileType;
            if (result.text) {
                extractedContent = result.text;
            } else {
                return NextResponse.json({
                    error: 'Could not extract content from file',
                    details: 'Please try uploading a different file format (PDF, image, or text file).'
                }, { status: 400 });
            }
        }

        if (!extractedContent || extractedContent.trim().length < 10) {
            return NextResponse.json({
                error: 'Submission content too short',
                details: 'Please provide more content for your submission.'
            }, { status: 400 });
        }

        // Grade the submission with AI
        const { feedback, score } = await gradeSubmission(
            extractedContent,
            homework.title,
            homework.description
        );

        // Save submission
        // Save submission
        const submission = await prisma.homeworkSubmissions.create({
            data: {
                id: uuidv4(),
                homeworkId: homeworkId,
                userId: session.user.id,
                submissionType: submissionType,
                fileName: fileName,
                fileType: fileType,
                content: extractedContent.substring(0, 50000), // Limit stored content
                aiFeedback: feedback,
                aiScore: score,
                isGraded: true,
                gradedAt: new Date(),
            },
        });

        // Mark homework as completed if score is passing (>=50)
        if (score >= 50 && !homework.completedAt) {
            const now = new Date();
            const dueDate = new Date(homework.dueDate);
            const isLate = dueDate < now;
            const daysLate = isLate
                ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                : 0;
            const latePenalty = Math.min(50, daysLate * 5);
            const effectiveXp = Math.floor((homework.xpReward || 0) * (1 - latePenalty / 100));

            await prisma.homeworkAssignment.update({
                where: { id: homeworkId },
                data: {
                    completedAt: now,
                    lateDays: daysLate,
                    effectiveXpEarned: effectiveXp,
                },
            });

            // Award XP
            if (effectiveXp > 0) {
                await prisma.user.update({
                    where: { id: session.user.id },
                    data: { xp: { increment: effectiveXp } },
                });
            }
        }

        return NextResponse.json({
            success: true,
            submission: {
                id: submission.id,
                score,
                feedback,
                isGraded: true,
            },
        });
    } catch (error: any) {
        console.error('Homework submission error:', error);
        return NextResponse.json({
            error: 'Failed to submit homework',
            details: error.message || String(error)
        }, { status: 500 });
    }
}

// Get submissions for a homework
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const homeworkId = url.searchParams.get('homeworkId');

        if (!homeworkId) {
            return NextResponse.json({ error: 'Homework ID required' }, { status: 400 });
        }

        const submissions = await prisma.homeworkSubmissions.findMany({
            where: {
                homeworkId: homeworkId,
                userId: session.user.id,
            },
            orderBy: { submittedAt: 'desc' },
        });

        return NextResponse.json({ submissions });
    } catch (error) {
        console.error('Fetch submissions error:', error);
        return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
    }
}
