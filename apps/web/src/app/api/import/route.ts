import { NextResponse } from 'next/server';
import { createRequire } from 'module';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ExerciseType } from '@prisma/client';
import OpenAI from 'openai';
import { initImportSourcesTable, clickhouse } from '@/lib/clickhouse';
import crypto from 'crypto';
import { Readable } from 'stream';
import { Buffer } from 'buffer';
import { YoutubeTranscript } from 'youtube-transcript';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Extract YouTube video ID from various URL formats
function extractYoutubeVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/ // Just the video ID
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// Fetch YouTube video metadata as fallback when transcript is unavailable
async function fetchYoutubeMetadata(videoId: string): Promise<{ title: string; description: string; channel: string; tags: string[] } | null> {
    try {
        // First try YouTube Data API if API key is available
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (apiKey) {
            try {
                const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
                const res = await fetch(apiUrl);
                if (res.ok) {
                    const data = await res.json();
                    if (data.items && data.items.length > 0) {
                        const snippet = data.items[0].snippet;
                        return {
                            title: snippet.title || 'YouTube Video',
                            description: snippet.description || '',
                            channel: snippet.channelTitle || '',
                            tags: snippet.tags || []
                        };
                    }
                }
            } catch (e) {
                console.warn('YouTube Data API failed, falling back to oEmbed:', e);
            }
        }

        // Fallback to oEmbed (limited info but no API key needed)
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const res = await fetch(oembedUrl);
        if (res.ok) {
            const data = await res.json();
            return {
                title: data.title || 'YouTube Video',
                description: '', // oEmbed doesn't provide description
                channel: data.author_name || '',
                tags: []
            };
        }

        return null;
    } catch (error) {
        console.error('Failed to fetch YouTube metadata:', error);
        return null;
    }
}

// Fetch YouTube transcript with metadata fallback
async function fetchYoutubeTranscript(url: string): Promise<{ transcript: string; title: string; isMetadataOnly: boolean } | null> {
    try {
        const videoId = extractYoutubeVideoId(url);
        if (!videoId) {
            console.error('Could not extract video ID from URL:', url);
            return null;
        }

        console.log('Fetching transcript for video ID:', videoId);

        // Try to fetch transcript first
        let transcriptText = '';
        let hasTranscript = false;

        try {
            const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
            if (transcriptItems && transcriptItems.length > 0) {
                transcriptText = transcriptItems
                    .map(item => item.text)
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                hasTranscript = true;
                console.log('Transcript fetched successfully. Length:', transcriptText.length);
            }
        } catch (transcriptError) {
            console.warn('Transcript not available, will try metadata fallback:', transcriptError);
        }

        // Get video metadata
        const metadata = await fetchYoutubeMetadata(videoId);

        if (!metadata) {
            console.error('Could not fetch any video information');
            return null;
        }

        if (hasTranscript && transcriptText.length > 100) {
            // We have a good transcript
            return {
                transcript: transcriptText,
                title: metadata.title,
                isMetadataOnly: false
            };
        }

        // Fallback: Create content from metadata
        console.log('Using metadata fallback for video:', metadata.title);

        let fallbackContent = `Video Title: ${metadata.title}\n`;
        if (metadata.channel) {
            fallbackContent += `Channel: ${metadata.channel}\n`;
        }
        if (metadata.description) {
            fallbackContent += `\nDescription:\n${metadata.description}\n`;
        }
        if (metadata.tags && metadata.tags.length > 0) {
            fallbackContent += `\nTopics/Tags: ${metadata.tags.join(', ')}\n`;
        }

        return {
            transcript: fallbackContent,
            title: metadata.title,
            isMetadataOnly: true
        };
    } catch (error) {
        console.error('Failed to fetch YouTube content:', error);
        return null;
    }
}

// Imports moved inside function to prevent build/runtime errors

// Try multiple methods to extract text from PDF
async function extractPdfText(buffer: Buffer): Promise<{ text: string; method: string } | null> {
    // Method 1: Try pdf-parse first (works for text-based PDFs)
    try {
        const require = createRequire(import.meta.url);
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        const text = data.text?.trim() || '';

        if (text.length >= 100) {
            console.log('PDF text extracted via pdf-parse. Length:', text.length);
            return { text, method: 'pdf-parse' };
        }
        console.log('pdf-parse returned minimal text:', text.length, '- trying OCR...');
    } catch (e) {
        console.warn('pdf-parse failed:', e);
    }

    // Method 2: Convert PDF to images and use GPT-4 Vision for OCR
    try {
        console.log('Converting PDF to images for OCR...');
        const { pdfToPng } = await import('pdf-to-png-converter');

        // Convert PDF pages to PNG images (limit to first 5 pages)
        // pdfToPng expects ArrayBufferLike
        const pngPages = await pdfToPng(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), {
            disableFontFace: true,
            useSystemFonts: true,
            viewportScale: 2.0, // Higher quality
            pagesToProcess: [1, 2, 3, 4, 5], // First 5 pages
        });

        if (!pngPages || pngPages.length === 0) {
            console.warn('pdf-to-png-converter returned no pages');
            return null;
        }

        console.log(`Converted ${pngPages.length} PDF pages to images, sending to GPT-4 Vision...`);

        // Prepare images for Vision API (filter out pages without content)
        const imageContents = pngPages
            .filter(page => page.content)
            .map(page => ({
                type: 'image_url' as const,
                image_url: {
                    url: `data:image/png;base64,${Buffer.from(page.content!).toString('base64')}`,
                    detail: 'high' as const
                }
            }));

        // Send to GPT-4 Vision for OCR
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `These are ${pngPages.length} pages from a scanned document. Please extract ALL the text content accurately.

Instructions:
- Extract every piece of visible text from all pages
- Maintain structure (headings, bullet points, numbered lists)
- Maintain structure (headings, bullet points, numbered lists)
- MATH FORMATTING:
  - Use display math ($$ ... $$) for ALL formulas and equations.
  - Put every formula on its own line.
  - Add blank lines before and after every formula.
  - Never mix math matching typical inline text.
- For tables, format them readably
- Be thorough and complete

Extract the text from all pages:`
                        },
                        ...imageContents
                    ]
                }
            ],
            max_tokens: 16000, // Increased for multi-page documents
        });

        const extractedText = response.choices[0]?.message?.content?.trim();
        if (extractedText && extractedText.length > 50) {
            console.log('GPT-4 Vision OCR successful. Length:', extractedText.length);
            return { text: extractedText, method: 'vision-ocr' };
        }

        console.warn('GPT-4 Vision returned insufficient text');
    } catch (e: any) {
        console.error('PDF to image conversion failed:', e?.message || e);
    }

    // Method 3: Use OpenAI File Upload API (same as ChatGPT)
    try {
        console.log('Trying OpenAI File Upload API for PDF...');

        // Upload the file to OpenAI - convert Buffer to proper format
        const blob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
        const file = new File([blob], 'document.pdf', { type: 'application/pdf' });
        const uploadedFile = await openai.files.create({
            file: file,
            purpose: 'assistants',
        });

        console.log('File uploaded to OpenAI:', uploadedFile.id);

        // Use the Responses API with file_search to extract content
        // Note: We'll use a simple completion with the file context
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `I've uploaded a PDF document. Please extract ALL the text content from it accurately.

Instructions:
- Extract every piece of visible text 
- Maintain structure (headings, bullet points, numbered lists)
- Maintain structure (headings, bullet points, numbered lists)
- MATH FORMATTING:
  - Use display math ($$ ... $$) for ALL formulas and equations.
  - Put every formula on its own line.
  - Add blank lines before and after every formula.
- For tables, format them readably
- Be thorough and complete

Extract the full text content:`
                        },
                        {
                            type: 'file',
                            file: {
                                file_id: uploadedFile.id,
                            }
                        } as any
                    ]
                }
            ],
            max_tokens: 16000,
        });

        // Clean up the uploaded file
        try {
            await openai.files.delete(uploadedFile.id);
        } catch (deleteError) {
            console.warn('Failed to delete uploaded file:', deleteError);
        }

        const extractedText = response.choices[0]?.message?.content?.trim();
        if (extractedText && extractedText.length > 50) {
            console.log('OpenAI File API OCR successful. Length:', extractedText.length);
            return { text: extractedText, method: 'openai-file-api' };
        }

        console.warn('OpenAI File API returned insufficient text');
    } catch (e: any) {
        console.error('OpenAI File API failed:', e?.message || e);
    }

    return null;
}

async function fileToText(file: File): Promise<string> {
    console.log('=== fileToText called ===');
    console.log('File name:', file.name);
    console.log('File size:', file.size, 'bytes');
    console.log('File type:', file.type);

    const buffer = Buffer.from(await file.arrayBuffer());
    console.log('Buffer created, length:', buffer.byteLength);

    // Limit size to ~10MB
    if (buffer.byteLength > 10 * 1024 * 1024) {
        throw new Error('File too large (max 10MB)');
    }

    // Check if PDF by magic bytes
    const isPdf = buffer.toString('utf8', 0, 4) === '%PDF';
    console.log('Is PDF:', isPdf);

    if (isPdf) {
        console.log('Starting PDF extraction...');
        const result = await extractPdfText(buffer);
        if (result) {
            console.log('PDF extraction successful via', result.method, '- length:', result.text.length);
            return result.text;
        }

        // All methods failed
        console.error('=== All PDF extraction methods failed ===');
        return null as any;
    }

    // Check if image by magic bytes or file type
    const isImage = file.type.startsWith('image/') ||
        ['.png', '.jpg', '.jpeg', '.webp', '.gif'].some(ext => file.name.toLowerCase().endsWith(ext));

    if (isImage) {
        console.log('Starting image OCR extraction...');
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
                                text: `Extract ALL the text content from this image accurately.

Instructions:
- Extract every piece of visible text
- Maintain structure (headings, bullet points, numbered lists)
- Maintain structure (headings, bullet points, numbered lists)
- MATH FORMATTING:
  - Use display math ($$ ... $$) for all equations.
  - Ensure blank lines around math blocks.
- For tables, format them readably
- Be thorough and complete

Extract the text:`
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
                max_tokens: 8000,
            });

            const extractedText = response.choices[0]?.message?.content?.trim();
            if (extractedText && extractedText.length > 20) {
                console.log('Image OCR successful. Length:', extractedText.length);
                return extractedText;
            }
            console.warn('GPT-4 Vision returned insufficient text from image');
            return null as any;
        } catch (e: any) {
            console.error('Image OCR failed:', e?.message || e);
            return null as any;
        }
    }

    // Try to decode as utf-8; for binaries (doc/ppt) we still check
    const text = buffer.toString('utf8');
    const isBinary = text.replace(/[^\x20-\x7E\n\r\t]/g, '').length / text.length < 0.85;
    console.log('Is binary:', isBinary);

    if (isBinary) {
        console.log('File detected as binary, returning null');
        return null as any;
    }

    console.log('File decoded as text, length:', text.length);
    return text;
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const contentType = request.headers.get('content-type') || '';
        let subjectName = '';
        let sourceType = '';
        let youtubeUrl = '';
        let notesText = '';
        let fileText: string | null = '';
        let fileName = '';
        let replaceExisting = false;

        if (contentType.includes('multipart/form-data')) {
            const form = await request.formData();
            subjectName = (form.get('subjectName') as string) || '';
            sourceType = (form.get('sourceType') as string) || '';
            youtubeUrl = (form.get('youtubeUrl') as string) || '';
            notesText = (form.get('notesText') as string) || '';
            replaceExisting = form.get('replace') === 'true';
            const file = form.get('file');
            if (file && file instanceof File) {
                fileName = file.name;
                fileText = await fileToText(file);
            }
        } else {
            // ... (JSON body handling - usually no file here)
            const body = await request.json();
            subjectName = body.subjectName || '';
            sourceType = body.sourceType || '';
            youtubeUrl = body.youtubeUrl || '';
            notesText = body.notesText || '';
            replaceExisting = body.replace === true;
        }

        const finalName = subjectName && subjectName.trim().length >= 2 ? subjectName.trim() : '';

        // VALIDATION
        if (subjectName && subjectName.trim().length < 2) {
            return NextResponse.json({ error: 'Subject name too short' }, { status: 400 });
        }
        if (!['youtube', 'notes', 'file'].includes(sourceType)) {
            return NextResponse.json({ error: 'Invalid source type' }, { status: 400 });
        }
        if (sourceType === 'youtube' && !youtubeUrl) {
            return NextResponse.json({ error: 'YouTube URL required' }, { status: 400 });
        }
        if (sourceType === 'notes' && (!notesText || notesText.trim().length < 20)) {
            return NextResponse.json({ error: 'Notes text too short' }, { status: 400 });
        }

        // Strict file check: If fileText is null/empty, we FAIL.
        if (sourceType === 'file') {
            if (fileText === null || fileText === undefined) {
                console.error('File text extraction failed completely');
                return NextResponse.json({
                    error: 'Could not extract text from file.',
                    details: 'We tried both text extraction and OCR (GPT-4 Vision) but couldn\'t read this file. This may be a corrupted PDF, heavily encrypted, or an unusual format. Please try: (1) Open the PDF in Preview, export as a new PDF, and upload again, or (2) Copy-paste the content into the Notes tab.'
                }, { status: 400 });
            }
            if (fileText.length < 50) {
                console.warn('File text is very short but proceeding anyway. Length:', fileText.length);
            }
        }

        // Use provided name or a temporary seed
        let baseName = finalName || (fileName ? fileName.split('.')[0] : 'learning-subject');

        // For YouTube, fetch the transcript
        let youtubeTranscript = '';
        let youtubeTitle = '';
        let youtubeIsMetadataOnly = false;
        if (sourceType === 'youtube' && youtubeUrl) {
            console.log('Fetching YouTube transcript for:', youtubeUrl);
            const result = await fetchYoutubeTranscript(youtubeUrl);
            if (result) {
                youtubeTranscript = result.transcript;
                youtubeTitle = result.title;
                youtubeIsMetadataOnly = result.isMetadataOnly;
                // Use video title as base name if no subject name provided
                if (!finalName && youtubeTitle) {
                    baseName = youtubeTitle;
                }
            } else {
                return NextResponse.json({
                    error: 'Could not fetch YouTube video information.',
                    details: 'The video may be private, unavailable, or region-restricted. Please try a different video or use the Notes tab to paste the content manually.'
                }, { status: 400 });
            }
        }

        let slug = slugify(baseName);
        const existing = await prisma.subject.findFirst({
            where: { slug }
        });
        if (existing) {
            slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
        }

        // Truncate content 
        let contentForAi = '';
        let isMetadataOnly = false;

        if (sourceType === 'youtube') {
            // Use the actual transcript instead of just the URL
            contentForAi = youtubeTranscript.substring(0, 100000);
            isMetadataOnly = youtubeIsMetadataOnly;
        } else if (sourceType === 'notes') {
            contentForAi = notesText.substring(0, 100000); // Increased limit to ~100k chars (approx 25k tokens) to capture full document context
        } else if (sourceType === 'file' && fileText) {
            contentForAi = fileText.substring(0, 100000); // Increased limit to ~100k chars
        }

        console.log('--- AI INPUT DEBUG ---');
        console.log('Source Type:', sourceType);
        console.log('Is Metadata Only:', isMetadataOnly);
        console.log('Extracted Text Preview:', contentForAi.substring(0, 200) + '...');
        console.log('----------------------');

        const sourceSummary = `Type: ${sourceType}${youtubeTitle ? `\nVideo Title: ${youtubeTitle}` : ''}${isMetadataOnly ? '\n(Note: Full transcript unavailable, using video metadata)' : ''}\nContent: ${contentForAi}`;

        // VALIDATION: Check if content is educational
        console.log('Validating content quality...');
        const validationPrompt = `Evaluate if the following content is suitable for generating a valid educational learning module (flashcards, quizzes, study notes).

Content Type: ${sourceType}
Content Preview: ${contentForAi.slice(0, 1000)}

Instructions:
Your goal is to accept ANY content that *could possibly* be educational, while filtering out obvious junk.
BE LENIENT. Many educational videos have vague titles like "session 1", "Q&A", "Update", or "Intro".
Do NOT reject content just because it is sparse or short.

ONLY REJECT if you are certain it is:
1. Pure entertainment (e.g. music videos, movie trailers, gaming highlights, memes).
2. Personal private administrative documents (e.g. bank statements, invoices, receipts).
3. Complete spam or gibberish.

If it might be educational (even 1% chance), allow it.

Return JSON:
{
  "isEducational": boolean,
  "reason": "Short explanation for user"
}
`;

        const validationCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a content moderator for an educational platform." },
                { role: "user", content: validationPrompt }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const validationResult = JSON.parse(validationCompletion.choices[0].message.content || '{"isEducational":true}');

        if (!validationResult.isEducational) {
            console.log('Content rejected:', validationResult.reason);
            return NextResponse.json({
                error: 'Content rejected',
                details: validationResult.reason || 'The provided content does not appear to be suitable for generating structured learning materials. Please try a different source.'
            }, { status: 400 });
        }

        // Adjust prompt based on whether we have full transcript or just metadata
        const metadataNote = isMetadataOnly
            ? `\nIMPORTANT: The full video transcript was not available. We only have the video metadata. 
               1. Summarize the video's likely educational value based on the title/description.
               2. Do NOT hallucinate specific transcript details, but structure the course based on standard curriculum for this topic.
               3. Explicitly mention in the description that this content is based on metadata.`
            : '';

        const prompt = `
You are an expert curriculum designer. 
Analyze the source content deeply. Create a subject plan that STRICTLY reflects the specific topics, chapters, or concepts found in the text.
Do NOT create a generic curriculum based on the title. Use the actual content details.
${metadataNote}
Source:
${sourceSummary}

Return ONLY valid JSON with:
{
  "name": "Subject name from content",
  "description": "Brief description",
  "category": "stem",
  "difficultyLevel": "beginner",
  "estimatedHours": 40,
  "topics": [
    { 
      "name": "Topic name from content", 
      "description": "...", 
      "order": 1, 
      "estimatedMins": 30,
      "contentStart": "First 15 words marking start of this section",
      "contentEnd": "Last 15 words marking end of this section"
    }
  ]
}
Create 3-8 topics based on actual content structure. Use exact section names.
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a content parser. Extract the actual structure from the content. Return strict JSON only. Do NOT generate new content." },
                { role: "user", content: prompt }
            ],
            temperature: 0.4,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content || '{}';
        let plan: any;
        try {
            plan = JSON.parse(content);
        } catch {
            return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
        }

        const aiName = plan.name?.toString().slice(0, 120);
        // Prioritize user-provided name over AI-generated name
        let subjectDisplayName = finalName || aiName || `Imported Subject ${Math.random().toString(36).slice(2, 6)}`;
        const description = plan.description?.slice(0, 240) || `Learning ${subjectDisplayName}`;
        const category = plan.category || 'stem';
        const difficulty = plan.difficultyLevel || 'beginner';
        const estimatedHours = Math.min(Math.max(Number(plan.estimatedHours) || 40, 10), 200);
        const topics = Array.isArray(plan.topics) ? plan.topics.slice(0, 12) : [];

        // Check for duplicate name (unique constraint)
        const existingByName = await prisma.subject.findUnique({
            where: { name: subjectDisplayName }
        });

        if (existingByName && !replaceExisting) {
            // Return conflict with options instead of auto-renaming
            return NextResponse.json({
                conflict: true,
                existingSubject: {
                    id: existingByName.id,
                    name: existingByName.name,
                    slug: existingByName.slug,
                },
                message: `A subject named "${subjectDisplayName}" already exists.`,
            }, { status: 409 });
        }

        // If replace flag is true, delete the existing subject
        if (existingByName && replaceExisting) {
            console.log(`Replacing existing subject: ${existingByName.id}`);
            await prisma.subject.delete({ where: { id: existingByName.id } });
            console.log(`Deleted existing subject (cascade will remove related data)`);
        }

        // Regenerate slug if AI supplied a better name
        slug = slugify(subjectDisplayName);
        const existingAi = await prisma.subject.findFirst({
            where: { slug }
        });
        if (existingAi) {
            slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
        }

        // Prepare the full source content to store
        let fullSourceContent = '';
        if (sourceType === 'youtube') {
            fullSourceContent = youtubeTranscript || '';
        } else if (sourceType === 'file') {
            fullSourceContent = fileText || '';
        } else if (sourceType === 'notes') {
            fullSourceContent = notesText || '';
        }

        // Fix exerciseTypes to match Enum
        const subject = await prisma.subject.create({
            data: {
                id: crypto.randomUUID(),
                name: subjectDisplayName,
                slug,
                description,
                category,
                difficultyLevel: difficulty,
                estimatedHours,
                exerciseTypes: [ExerciseType.mcq], // Matches enum value
                isActive: true,
            }
        });

        for (let i = 0; i < topics.length; i++) {
            const t = topics[i];
            const tName = t.name?.toString().slice(0, 100) || `Topic ${i + 1}`;
            // Use random suffix to guarantee uniqueness within subject scope
            const tSlug = `${slugify(tName).slice(0, 30)}-${crypto.randomUUID().slice(0, 8)}`;

            // Extract the specific section for this topic from the full content
            let topicContent = '';
            const fullText = fileText || youtubeTranscript || notesText || '';

            if (sourceType === 'youtube' && youtubeIsMetadataOnly) {
                // SPECIAL CASE: No transcript available. Generate a high-quality summary based on the topic name and video context.
                console.log(`Generating synthetic summary for topic (metadata only): ${tName}`);
                try {
                    const summaryPrompt = `The user is importing a YouTube video titled "${youtubeTitle}" but no transcript was available. 
They have outlined a topic named "${tName}".

Write a detailed, factual educational summary (300-500 words) for this topic.
- Explain the key concepts usually covered in "${tName}" within the context of "${youtubeTitle}".
- Use standard, accurate educational definitions.
- Use standard, accurate educational definitions.
- Format with clear paragraphs and bullet points.
- MATH FORMATTING:
  - Use display math ($$ ... $$) for ALL formulas/equations.
  - Put them on their own lines, centered.
  - Add blank lines before and after every math block.
  - NEVER mix math with text on the same line.
- Do NOT make up specific anecdotes from the video, but cover the subject matter comprehensively.

Output the summary:`;

                    const summaryRes = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: 'You are an expert tutor. Provide comprehensive educational summaries.' },
                            { role: 'user', content: summaryPrompt }
                        ],
                        temperature: 0.5,
                        max_tokens: 800
                    });

                    topicContent = summaryRes.choices[0].message.content?.trim() || '';
                } catch (err) {
                    console.error('Failed to generate summary:', err);
                    topicContent = fullText; // Fallback
                }

            } else if (fullText && fullText.length > 200) {
                // Use AI to intelligently split content by topic
                try {
                    console.log(`Extracting section for topic: ${tName}`);
                    const sectionPrompt = `Extract ONLY the section relevant to "${tName}" from the following content. 
Return the exact text from that section, preserving all mathematical notation, formulas, and formatting.

MATH FORMATTING RULES (CRITICAL):
1. Use display math ($$ ... $$) for ALL formulas, equations, and expressions.
2. Put every math block on its OWN LINE.
3. Add a blank line BEFORE and AFTER every math block.
4. NEVER mix math with text on the same line.
5. If original content has inline math, convert it to display math on a new line.

CONTENT:
${fullText.slice(0, 15000)}

Return ONLY the relevant section text, nothing else.`;

                    const sectionResponse = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: 'You extract specific sections from educational content. Return only the extracted section text with proper LaTeX formatting.' },
                            { role: 'user', content: sectionPrompt }
                        ],
                        temperature: 0.3,
                        max_tokens: 3000
                    });

                    topicContent = sectionResponse.choices[0].message.content?.trim() || '';
                    console.log(`Extracted ${topicContent.length} chars for topic: ${tName}`);
                } catch (err) {
                    console.error(`Failed to extract section for ${tName}:`, err);
                    // Fallback: give it the full content
                    topicContent = fullText;
                }
            } else {
                topicContent = fullText;
            }

            const topicRecord = await prisma.subjectTopic.create({
                data: {
                    subjectId: subject.id,
                    name: tName,
                    slug: tSlug,
                    description: t.description?.toString().slice(0, 240) || '',
                    order: t.order || i + 1,
                    estimatedMins: t.estimatedMins || 45,
                    level: 0,
                    content: topicContent || null, // Store the actual content
                }
            });

            // Sections -> subtopics
            if (Array.isArray(t.sections)) {
                for (let sIdx = 0; sIdx < t.sections.length; sIdx++) {
                    const s = t.sections[sIdx];
                    const sName = s.name?.toString().slice(0, 100) || `Section ${sIdx + 1}`;
                    const sSlug = `${slugify(sName).slice(0, 30)}-${crypto.randomUUID().slice(0, 8)}`;

                    // For subtopics, we can either re-use the topic content or leave it null/lighter
                    // For now, let's leave subtopic content empty to avoid excessive API calls, 
                    // assuming the main topic content covers it.

                    const sectionRecord = await prisma.subjectTopic.create({
                        data: {
                            subjectId: subject.id,
                            parentId: topicRecord.id,
                            name: sName,
                            slug: sSlug,
                            description: s.description?.toString().slice(0, 240) || '',
                            order: s.order || sIdx + 1,
                            estimatedMins: s.estimatedMins || 30,
                            level: 1,
                        }
                    });

                    if (Array.isArray(s.subtopics)) {
                        for (let uIdx = 0; uIdx < s.subtopics.length; uIdx++) {
                            const u = s.subtopics[uIdx];
                            const uName = u.name?.toString().slice(0, 100) || `Subtopic ${uIdx + 1}`;
                            const uSlug = `${slugify(uName).slice(0, 30)}-${crypto.randomUUID().slice(0, 8)}`;

                            await prisma.subjectTopic.create({
                                data: {
                                    subjectId: subject.id,
                                    parentId: sectionRecord.id,
                                    name: uName,
                                    slug: uSlug,
                                    description: u.description?.toString().slice(0, 240) || '',
                                    order: u.order || uIdx + 1,
                                    estimatedMins: u.estimatedMins || 20,
                                    level: 2,
                                }
                            });
                        }
                    }
                }
            }
        }

        // Generate Exercises (MCQs and Flashcards) from topic content
        console.log('Generating exercises from imported content...');
        try {
            const allTopics = await prisma.subjectTopic.findMany({
                where: { subjectId: subject.id },
                select: { id: true, name: true, content: true }
            });

            for (const topic of allTopics) {
                if (!topic.content || topic.content.length < 100) continue; // Skip if no substantial content

                try {
                    // Generate MCQ and Flashcard exercises from this topic's content
                    const exercisePrompt = `Based on the following content, generate educational exercises:

CONTENT:
${topic.content.slice(0, 2000)} 

Generate exactly 5 exercises in this JSON format:
{
  "exercises": [
    {
      "type": "mcq",
      "question": "Question text",
      "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
      "correctAnswer": "A",
      "explanation": "Why this is correct"
    },
    {
      "type": "flashcard",
      "front": "Question or term",
      "back": "Answer or definition"
    }
  ]
}

Create 3 MCQs and 2 flashcards. Questions must be based ONLY on the content provided above.`;

                    const exerciseResponse = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: 'You are an expert educator creating exercises from study materials. Return only valid JSON.' },
                            { role: 'user', content: exercisePrompt }
                        ],
                        temperature: 0.7,
                        response_format: { type: 'json_object' }
                    });

                    const result = JSON.parse(exerciseResponse.choices[0].message.content || '{}');
                    const exercises = result.exercises || [];

                    for (const ex of exercises) {
                        if (ex.type === 'mcq' && ex.question && ex.options && ex.correctAnswer) {
                            await prisma.exercise.create({
                                data: {
                                    id: crypto.randomUUID(),
                                    subjectId: subject.id,
                                    topicId: topic.id,
                                    type: 'mcq',
                                    title: ex.question.slice(0, 100),
                                    difficulty: 'medium',
                                    content: {
                                        question: ex.question,
                                        options: ex.options,
                                        correctAnswer: ex.correctAnswer,
                                        correctAnswers: [ex.correctAnswer.charCodeAt(0) - 65], // Convert 'A' to 0, 'B' to 1, etc
                                        explanation: ex.explanation || ''
                                    },
                                    estimatedMins: 2,
                                    points: 10,
                                    isActive: true,
                                    updatedAt: new Date(),
                                }
                            });
                        } else if (ex.type === 'flashcard' && ex.front && ex.back) {
                            await prisma.exercise.create({
                                data: {
                                    id: crypto.randomUUID(),
                                    subjectId: subject.id,
                                    topicId: topic.id,
                                    type: 'flashcard',
                                    title: ex.front.slice(0, 100),
                                    difficulty: 'medium',
                                    content: {
                                        front: ex.front,
                                        back: ex.back
                                    },
                                    estimatedMins: 1,
                                    points: 5,
                                    isActive: true,
                                    updatedAt: new Date(),
                                }
                            });
                        }
                    }

                    console.log(`Generated ${exercises.length} exercises for topic: ${topic.name}`);
                } catch (exErr) {
                    console.error(`Failed to generate exercises for topic ${topic.name}:`, exErr);
                    // Continue with other topics
                }
            }

            console.log('Exercise generation completed.');
        } catch (error) {
            console.error('Failed to generate exercises:', error);
            // Don't fail the import, just log
        }

        // Generate Homework Assignments for topics with exercises
        console.log('Creating homework assignments...');
        try {
            const allTopics = await prisma.subjectTopic.findMany({
                where: { subjectId: subject.id },
                include: {
                    exercise: {
                        where: { isActive: true, type: 'mcq' }
                    }
                }
            });

            // Only create homework for topics that have MCQ exercises
            const topicsWithExercises = allTopics.filter((t: any) => t.exercise.length >= 3);

            for (const topic of topicsWithExercises) {
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 7); // Due in 7 days

                const homework = await prisma.homeworkAssignment.create({
                    data: {
                        id: crypto.randomUUID(),
                        userId: session.user.id,
                        subjectId: subject.id,
                        topicId: topic.id,
                        title: `${topic.name} - Practice Assignment`,
                        description: `Complete the exercises for ${topic.name}. This assignment includes quizzes and practice problems.`,
                        dueDate: dueDate,
                        assignmentType: 'practice',
                        estimatedMins: topic.exercise.length * 3, // ~3 mins per exercise
                        xpReward: topic.exercise.length * 10,
                    }
                });

                // Create reminder for 1 day before due date
                const reminderDate = new Date(dueDate);
                reminderDate.setDate(reminderDate.getDate() - 1);

                await prisma.homeworkReminders.create({
                    data: {
                        id: crypto.randomUUID(),
                        homeworkId: homework.id,
                        reminderType: 'due_soon',
                        scheduledFor: reminderDate,
                        sent: false
                    }
                });

                console.log(`Created homework for topic: ${topic.name}`);
            }

            console.log(`Created ${topicsWithExercises.length} homework assignments.`);
        } catch (error) {
            console.error('Failed to create homework assignments:', error);
            // Don't fail the import, just log
        }

        // RAG: Chunk and Embed Content
        try {
            console.log('Starting RAG embedding process...');
            // Use the appropriate source content for embeddings
            let fullText = '';
            if (sourceType === 'youtube') {
                fullText = youtubeTranscript || contentForAi;
            } else if (sourceType === 'file') {
                fullText = fileText || contentForAi;
            } else {
                fullText = notesText || contentForAi;
            }

            if (fullText && fullText.length > 100) {
                // Simple chunking strategy
                const chunkSize = 2000;
                const overlap = 200;
                const chunks: string[] = [];

                for (let i = 0; i < fullText.length; i += (chunkSize - overlap)) {
                    const chunk = fullText.slice(i, i + chunkSize);
                    if (chunk.length > 50) chunks.push(chunk);
                }

                console.log(`Generated ${chunks.length} chunks for embedding.`);

                // Process in batches of 10
                for (let i = 0; i < chunks.length; i += 10) {
                    const batch = chunks.slice(i, i + 10);
                    const embeddings = await Promise.all(
                        batch.map(async (chunk) => {
                            try {
                                const res = await openai.embeddings.create({
                                    model: 'text-embedding-3-small',
                                    input: chunk,
                                });
                                return { chunk, vector: res.data[0].embedding };
                            } catch (err) {
                                console.error('Embedding error for chunk:', err);
                                return null;
                            }
                        })
                    );

                    // Save to DB
                    for (const item of embeddings) {
                        if (item) {
                            await prisma.subjectVectors.create({
                                data: {
                                    subjectId: subject.id,
                                    content: item.chunk,
                                    embedding: item.vector
                                }
                            });
                        }
                    }
                }
                console.log('RAG embeddings stored successfully.');
            }
        } catch (error) {
            console.error('Failed to process RAG embeddings:', error);
            // Do not fail the request, just log
        }

        // Log to ClickHouse for audit (non-blocking)
        try {
            await initImportSourcesTable();
            await clickhouse.insert({
                table: 'import_sources',
                values: [{
                    id: crypto.randomUUID(),
                    user_id: session.user.id,
                    subject_name: subjectName,
                    source_type: sourceType,
                    source_url: youtubeUrl || '',
                    created_at: new Date().toISOString(),
                }],
                format: 'JSONEachRow'
            });
        } catch (e) {
            console.warn('ClickHouse log failed', e);
        }

        return NextResponse.json({ success: true, slug: subject.slug });
    } catch (error: any) {
        console.error('Import API Error:', error);
        return NextResponse.json({
            error: 'Import failed',
            details: error.message || String(error)
        }, { status: 500 });
    }
}
