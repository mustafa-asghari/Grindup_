import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// Seed some sample LeetCode problems for testing
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if problems already exist
        const existingCount = await prisma.problem.count();
        if (existingCount > 0) {
            return NextResponse.json({
                message: `Database already has ${existingCount} problems. No seeding needed.`
            });
        }

        // Popular LeetCode problems to seed
        const sampleProblems = [
            { title: 'Two Sum', difficulty: 'easy', description: 'Find two numbers that add up to a target.' },
            { title: 'Reverse Linked List', difficulty: 'easy', description: 'Reverse a singly linked list.' },
            { title: 'Valid Parentheses', difficulty: 'easy', description: 'Determine if parentheses are valid.' },
            { title: 'Climbing Stairs', difficulty: 'easy', description: 'How many ways to climb n stairs.' },
            { title: 'Maximum Subarray', difficulty: 'medium', description: 'Find the contiguous subarray with the largest sum.' },
            { title: 'Coin Change', difficulty: 'medium', description: 'Minimum coins needed to make amount.' },
            { title: 'LRU Cache', difficulty: 'medium', description: 'Implement an LRU cache.' },
            { title: 'Word Break', difficulty: 'medium', description: 'Can string be segmented into dictionary words.' },
            { title: 'Merge K Sorted Lists', difficulty: 'hard', description: 'Merge k sorted linked lists.' },
            { title: 'Trapping Rain Water', difficulty: 'hard', description: 'Calculate trapped rainwater.' },
        ];

        const created = [];
        for (const prob of sampleProblems) {
            const problem = await prisma.problem.create({
                data: {
                    id: crypto.randomUUID(),
                    title: prob.title,
                    description: prob.description,
                    difficulty: prob.difficulty as any,
                    status: 'active',
                    timeLimitMs: 2000,
                    memoryLimitKb: 256000,
                    createdAt: new Date()
                }
            });
            created.push(problem);
        }

        return NextResponse.json({
            success: true,
            message: `Seeded ${created.length} problems`,
            problems: created
        });
    } catch (error) {
        console.error('Seed problems error:', error);
        return NextResponse.json({ error: 'Failed to seed problems' }, { status: 500 });
    }
}
