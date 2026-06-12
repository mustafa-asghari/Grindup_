import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

interface SubmissionJobData {
    userId: string;
    problemId: string;
    code: string;
    language: string;
    priority?: number;
}

interface SubmissionResult {
    status: 'accepted' | 'wrong_answer' | 'tle' | 'mle' | 'error';
    runtime_ms?: number;
    memory_kb?: number;
    test_results?: Prisma.InputJsonValue;
    error_message?: string;
}

type ClaimedSubmissionJob = {
    id: string;
    userId: string;
    problemId: string;
    code: string;
    language: string;
};

/**
 * Queue a submission for processing
 */
export async function queueSubmission(data: SubmissionJobData): Promise<string> {
    const job = await prisma.submissionJobs.create({
        data: {
            id: uuidv4(),
            userId: data.userId,
            problemId: data.problemId,
            code: data.code,
            language: data.language,
            priority: data.priority || 5,
            status: 'queued',
        },
    });

    return job.id;
}

/**
 * Get the next job to process (FIFO with priority)
 */
export async function getNextJob(): Promise<{
    id: string;
    userId: string;
    problemId: string;
    code: string;
    language: string;
} | null> {
    const [job] = await prisma.$queryRaw<ClaimedSubmissionJob[]>`
        UPDATE submission_jobs
        SET
            status = 'processing',
            started_at = NOW(),
            attempts = attempts + 1
        WHERE id = (
            SELECT id
            FROM submission_jobs
            WHERE status = 'queued'
                AND attempts < max_attempts
            ORDER BY priority ASC, queued_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        RETURNING
            id,
            user_id AS "userId",
            problem_id AS "problemId",
            code,
            language
    `;

    return job ?? null;
}

/**
 * Complete a job with results
 */
export async function completeJob(jobId: string, result: SubmissionResult): Promise<void> {
    await prisma.submissionJobs.update({
        where: { id: jobId },
        data: {
            status: 'completed',
            result: result as unknown as Prisma.InputJsonValue,
            completedAt: new Date(),
        },
    });
}

/**
 * Mark a job as failed
 */
export async function failJob(jobId: string, errorMessage: string): Promise<void> {
    const job = await prisma.submissionJobs.findUnique({
        where: { id: jobId },
    });

    if (!job) return;

    if (job.attempts >= job.maxAttempts) {
        // Permanently failed
        await prisma.submissionJobs.update({
            where: { id: jobId },
            data: {
                status: 'failed',
                errorMessage: errorMessage,
                completedAt: new Date(),
            },
        });
    } else {
        // Mark for retry
        await prisma.submissionJobs.update({
            where: { id: jobId },
            data: {
                status: 'retrying',
                errorMessage: errorMessage,
            },
        });
    }
}

/**
 * Get job status and result
 */
export async function getJobStatus(jobId: string): Promise<{
    status: string;
    result?: Prisma.JsonValue;
    errorMessage?: string;
    position?: number;
} | null> {
    const job = await prisma.submissionJobs.findUnique({
        where: { id: jobId },
    });

    if (!job) return null;

    let position: number | undefined;
    if (job.status === 'queued') {
        // Count how many jobs are ahead in queue
        position = await prisma.submissionJobs.count({
            where: {
                status: 'queued',
                OR: [
                    { priority: { lt: job.priority } },
                    {
                        priority: job.priority,
                        queuedAt: { lt: job.queuedAt },
                    },
                ],
            },
        });
    }

    return {
        status: job.status,
        result: job.result,
        errorMessage: job.errorMessage || undefined,
        position,
    };
}

/**
 * Retry failed/stuck jobs (called by cron)
 */
export async function retryStuckJobs(): Promise<number> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Reset jobs that have been processing too long
    const result = await prisma.submissionJobs.updateMany({
        where: {
            status: 'processing',
            startedAt: { lt: fiveMinutesAgo },
            attempts: { lt: 3 },
        },
        data: {
            status: 'retrying',
        },
    });

    // Move retrying jobs back to queued
    await prisma.submissionJobs.updateMany({
        where: { status: 'retrying' },
        data: { status: 'queued' },
    });

    return result.count;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    avgWaitTimeMs: number;
}> {
    const [queued, processing, completed, failed, recentCompleted] = await Promise.all([
        prisma.submissionJobs.count({ where: { status: 'queued' } }),
        prisma.submissionJobs.count({ where: { status: 'processing' } }),
        prisma.submissionJobs.count({ where: { status: 'completed' } }),
        prisma.submissionJobs.count({ where: { status: 'failed' } }),
        prisma.submissionJobs.findMany({
            where: {
                status: 'completed',
                completedAt: { not: null },
                startedAt: { not: null },
            },
            select: {
                queuedAt: true,
                startedAt: true,
            },
            take: 100,
            orderBy: { completedAt: 'desc' },
        }),
    ]);

    // Calculate average wait time
    let avgWaitTimeMs = 0;
    if (recentCompleted.length > 0) {
        const totalWait = recentCompleted.reduce((sum, job) => {
            if (job.startedAt) {
                return sum + (new Date(job.startedAt).getTime() - new Date(job.queuedAt).getTime());
            }
            return sum;
        }, 0);
        avgWaitTimeMs = totalWait / recentCompleted.length;
    }

    return { queued, processing, completed, failed, avgWaitTimeMs };
}
