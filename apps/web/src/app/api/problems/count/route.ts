import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const count = await prisma.problem.count();
        return NextResponse.json({ count });
    } catch (error) {
        console.error('Error getting problem count:', error);
        return NextResponse.json({ count: 0 });
    }
}
