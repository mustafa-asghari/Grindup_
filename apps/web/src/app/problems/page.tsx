import { auth } from '@/lib/auth';
import { SyncProblemsButton } from '@/components/sync-problems-button';
import { SearchBar } from '@/components/search-bar';
import { ProblemsListClient } from '@/components/problems-list-client';
import { clickhouse } from '@/lib/clickhouse';
import { getEmbedding } from '@/lib/openai';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/layout/app-shell';

export const dynamic = 'force-dynamic';

export default async function ProblemsPage(props: { searchParams: Promise<{ q?: string }> }) {
    const searchParams = await props.searchParams;
    const q = searchParams?.q;
    const session = await auth();
    let userStats = { xp: 0, streak: 0, level: 1 };

    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { xp: true, currentStreak: true, level: true, name: true }
        });
        if (user) {
            userStats = { xp: user.xp, streak: user.currentStreak, level: user.level };
        }
    }

    // Vector Search
    let problemIds: string[] | null = null;
    if (q) {
        try {
            console.log(`Searching for: ${q}`);
            const emb = await getEmbedding(q);
            const res = await clickhouse.query({
                query: `SELECT id FROM problems_vec ORDER BY L2Distance(embedding, {emb:Array(Float32)}) ASC LIMIT 20`,
                query_params: { emb },
                format: 'JSONEachRow'
            });
            const rows: any[] = await res.json();
            problemIds = rows.map((r: any) => r.id);
            console.log(`Found ${problemIds?.length} matches.`);
        } catch (e) {
            console.error("Vector search failed:", e);
            problemIds = [];
        }
    }

    // Fetch problems from the database
    const problems = await prisma.problem.findMany({
        where: problemIds ? { id: { in: problemIds } } : undefined,
        orderBy: {
            createdAt: 'asc',
        },
    });

    // Fetch topics for each problem separately
    const problemsWithTopics = await Promise.all(
        problems.map(async (problem) => {
            const problemTopics = await prisma.problemTopic.findMany({
                where: { problemId: problem.id },
                include: { topic: true },
            });
            return {
                id: problem.id,
                title: problem.title,
                difficulty: problem.difficulty,
                topicNames: problemTopics.map((pt) => pt.topic.name),
            };
        })
    );

    // Remove duplicates by title
    const uniqueProblems = problemsWithTopics.filter(
        (problem, index, self) => index === self.findIndex((p) => p.title === problem.title)
    );

    return (
        <AppShell
            isLoggedIn={!!session}
            userStats={userStats}
            displayName={session?.user?.name || 'User'}
            displayInitial={session?.user?.name?.[0]?.toUpperCase() || 'U'}
        >
            <div className="flex flex-col gap-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Problems</h1>
                        <p className="text-muted-foreground">Practice coding problems across various topics and difficulty levels</p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <SearchBar />
                        <SyncProblemsButton />
                    </div>
                </div>

                {/* Problems List - Client component with auto-refresh */}
                <ProblemsListClient initialProblems={uniqueProblems} />
            </div>
        </AppShell>
    );
}
