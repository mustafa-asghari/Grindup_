import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { openai } from '@/lib/openai';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_MULTIPART_BODY_BYTES = MAX_UPLOAD_BYTES + 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 50000;
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
type AllowedHomeworkFileType = 'pdf' | 'image' | 'txt';

class UploadValidationError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'UploadValidationError';
        this.status = status;
    }
}

function getFileExtension(fileName: string): string {
    const index = fileName.lastIndexOf('.');
    return index >= 0 ? fileName.slice(index).toLowerCase() : '';
}

function fileTypeFromExtension(fileName: string): AllowedHomeworkFileType | null {
    const extension = getFileExtension(fileName);
    if (extension === '.pdf') return 'pdf';
    if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
    if (extension === '.txt' || extension === '.md') return 'txt';
    return null;
}

function fileTypeFromMime(fileType: string): AllowedHomeworkFileType | null {
    const mime = fileType.split(';', 1)[0].trim().toLowerCase();
    if (mime === 'application/pdf') return 'pdf';
    if (['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime)) return 'image';
    if (['text/plain', 'text/markdown', 'text/x-markdown', 'application/x-markdown'].includes(mime)) return 'txt';
    return null;
}

function getUploadValidationError(file: File): UploadValidationError | null {
    if (file.size > MAX_UPLOAD_BYTES) {
        return new UploadValidationError('File too large (max 10MB)', 413);
    }

    const extensionType = fileTypeFromExtension(file.name);
    if (!extensionType) {
        return new UploadValidationError('Unsupported file type. Upload a PDF, PNG/JPG/WebP/GIF image, TXT, or MD file.', 400);
    }

    const mime = file.type.split(';', 1)[0].trim().toLowerCase();
    if (mime && mime !== 'application/octet-stream') {
        const mimeType = fileTypeFromMime(mime);
        if (!mimeType || mimeType !== extensionType) {
            return new UploadValidationError('Unsupported file type. File extension and MIME type must match a supported PDF, image, TXT, or MD upload.', 400);
        }
    }

    return null;
}

function getMultipartBodyValidationError(headers: Headers): UploadValidationError | null {
    const contentLength = headers.get('content-length');
    if (!contentLength) return null;

    const parsedLength = Number(contentLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) return null;

    if (parsedLength > MAX_MULTIPART_BODY_BYTES) {
        return new UploadValidationError('Multipart body too large (max 11MB)', 413);
    }

    return null;
}

function validateUploadFile(file: File): AllowedHomeworkFileType {
    const validationError = getUploadValidationError(file);
    if (validationError) throw validationError;
    return fileTypeFromExtension(file.name) as AllowedHomeworkFileType;
}

function imageMimeType(file: File): string {
    const mime = file.type.split(';', 1)[0].trim().toLowerCase();
    if (fileTypeFromMime(mime) === 'image') return mime;

    const extension = getFileExtension(file.name);
    if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
    if (extension === '.webp') return 'image/webp';
    if (extension === '.gif') return 'image/gif';
    return 'image/png';
}

function capExtractedText(text: string): string {
    return text.slice(0, MAX_EXTRACTED_TEXT_CHARS);
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

// Extract text from uploaded file
async function extractTextFromFile(file: File): Promise<{ text: string | null; fileType: string }> {
    const fileType = validateUploadFile(file);
    const buffer = Buffer.from(await file.arrayBuffer());

    // For images, use GPT-4 Vision
    if (fileType === 'image') {
        try {
            const base64Image = buffer.toString('base64');
            const mimeType = imageMimeType(file);

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

            const extractedText = response.choices[0]?.message?.content?.trim();
            return {
                text: extractedText ? capExtractedText(extractedText) : null,
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
            if (buffer.toString('utf8', 0, 4) !== '%PDF') {
                return { text: null, fileType: 'pdf' };
            }

            const { createRequire } = await import('module');
            const require = createRequire(import.meta.url);
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            const text = data.text?.trim() || '';
            if (text.length > 50) {
                return { text: capExtractedText(text), fileType: 'pdf' };
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

                const extractedText = response.choices[0]?.message?.content?.trim();
                return {
                    text: extractedText ? capExtractedText(extractedText) : null,
                    fileType: 'pdf'
                };
            }

            return { text: text ? capExtractedText(text) : null, fileType: 'pdf' };
        } catch (e) {
            console.error('PDF extraction failed:', e);
            return { text: null, fileType: 'pdf' };
        }
    }

    // For text files
    if (fileType === 'txt') {
        return {
            text: capExtractedText(buffer.toString('utf8')),
            fileType: 'txt'
        };
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
            const bodyValidationError = getMultipartBodyValidationError(request.headers);
            if (bodyValidationError) {
                return NextResponse.json({ error: bodyValidationError.message }, { status: bodyValidationError.status });
            }

            const form = await request.formData();
            homeworkId = (form.get('homeworkId') as string) || '';
            textContent = (form.get('textContent') as string) || '';
            const fileData = form.get('file');
            if (fileData && fileData instanceof File) {
                const validationError = getUploadValidationError(fileData);
                if (validationError) {
                    return NextResponse.json({ error: validationError.message }, { status: validationError.status });
                }
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
                extractedContent = capExtractedText(result.text);
            } else {
                return NextResponse.json({
                    error: 'Could not extract content from file',
                    details: 'Please try uploading a PDF, image, text, or Markdown file.'
                }, { status: 400 });
            }
        }

        extractedContent = capExtractedText(extractedContent);

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
    } catch (error) {
        console.error('Homework submission error:', error);
        if (error instanceof UploadValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        return NextResponse.json({
            error: 'Failed to submit homework',
            details: getErrorMessage(error)
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
