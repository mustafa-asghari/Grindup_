import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initImportSourcesTable, clickhouse } from '@/lib/clickhouse';
import { prisma } from '@/lib/db';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        await initImportSourcesTable();
        const result = await clickhouse.query({
            query: `
                SELECT id, user_id, subject_name, source_type, source_url, created_at
                FROM import_sources
                WHERE user_id = {user_id:String}
                ORDER BY created_at DESC
                LIMIT 50
            `,
            query_params: { user_id: session.user.id },
            format: 'JSONEachRow'
        });
        const rows = await result.json() as any[];

        // Try to map slugs from Postgres
        const subjects = await prisma.subject.findMany({
            where: { name: { in: rows.map(r => r.subject_name) } },
            select: { name: true, slug: true }
        });
        const slugMap: Record<string, string> = {};
        subjects.forEach(s => slugMap[s.name] = s.slug);

        return NextResponse.json({
            imports: rows.map(r => ({
                ...r,
                subject_slug: slugMap[r.subject_name] || null
            }))
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
