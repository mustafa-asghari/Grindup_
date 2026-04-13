import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
}

interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
    submission: { windowMs: 60 * 1000, maxRequests: 5 },        // 5 per minute
    hint_request: { windowMs: 5 * 60 * 1000, maxRequests: 10 }, // 10 per 5 minutes
    tutor_chat: { windowMs: 5 * 60 * 1000, maxRequests: 20 },   // 20 per 5 minutes
    report: { windowMs: 60 * 60 * 1000, maxRequests: 5 },       // 5 per hour
};

/**
 * Check and update rate limit for a user action
 */
export async function checkRateLimit(
    userId: string,
    action: string,
    config?: RateLimitConfig,
    ip?: string
): Promise<RateLimitResult> {
    const finalConfig = config || DEFAULT_CONFIGS[action] || {
        windowMs: 60 * 1000,
        maxRequests: 10,
    };

    const windowStart = new Date(Date.now() - finalConfig.windowMs);

    // 1. Check User Limit
    const userCount = await prisma.rateLimitLogs.count({
        where: {
            userId: userId,
            action,
            windowStart: { gte: windowStart },
        },
    });

    if (userCount >= finalConfig.maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: new Date(Date.now() + finalConfig.windowMs),
        };
    }

    // 2. Check IP Limit (if provided) - Secondary backup
    // We treat IP limit same as user limit for simplicity, or we could have a separate stricter config
    if (ip) {
        const ipKey = `ip:${ip}`;
        const ipCount = await prisma.rateLimitLogs.count({
            where: {
                userId: ipKey, // Storing IP in userId column with prefix
                action,
                windowStart: { gte: windowStart },
            },
        });

        if (ipCount >= finalConfig.maxRequests * 2) { // Allow 2x limit for IP (shared Wifi case)
            return {
                allowed: false,
                remaining: 0,
                resetAt: new Date(Date.now() + finalConfig.windowMs),
            };
        }
    }

    // Allow and Log
    await prisma.rateLimitLogs.create({
        data: {
            id: uuidv4(),
            userId: userId,
            action,
            count: 1,
            windowStart: new Date(),
        },
    });

    if (ip) {
        await prisma.rateLimitLogs.create({
            data: {
                id: uuidv4(),
                userId: `ip:${ip}`,
                action,
                count: 1,
                windowStart: new Date(),
            },
        });
    }

    return {
        allowed: true,
        remaining: Math.max(0, finalConfig.maxRequests - userCount - 1),
        resetAt: new Date(Date.now() + finalConfig.windowMs),
    };
}

/**
 * Check daily run quota for code submissions
 */
export async function checkDailyQuota(userId: string): Promise<{
    allowed: boolean;
    used: number;
    limit: number;
}> {
    // Get user's quota settings
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { dailyRunQuota: true, runsToday: true },
    });

    if (!user) {
        return { allowed: false, used: 0, limit: 0 };
    }

    const allowed = user.runsToday < user.dailyRunQuota;

    if (allowed) {
        // Increment runsToday
        await prisma.user.update({
            where: { id: userId },
            data: { runsToday: { increment: 1 } },
        });
    }

    return {
        allowed,
        used: user.runsToday + (allowed ? 1 : 0),
        limit: user.dailyRunQuota,
    };
}

/**
 * Reset daily quotas (called by cron at midnight)
 */
export async function resetDailyQuotas(): Promise<number> {
    const result = await prisma.user.updateMany({
        where: { runsToday: { gt: 0 } },
        data: { runsToday: 0 },
    });

    return result.count;
}

/**
 * Clean up old rate limit logs (older than 24 hours)
 */
export async function cleanupRateLimitLogs(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await prisma.rateLimitLogs.deleteMany({
        where: { windowStart: { lt: cutoff } },
    });

    return result.count;
}

