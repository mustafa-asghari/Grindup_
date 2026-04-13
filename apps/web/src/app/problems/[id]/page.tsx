import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ProblemWorkspace } from '@/components/editor/problem-workspace';

export const dynamic = 'force-dynamic';

type ProblemPageParams = {
    params: Promise<{ id: string }>;
};

export default async function ProblemPage({ params }: ProblemPageParams) {
    const session = await auth();
    const { id } = await params;

    // Fetch User Stats
    let userStats = { streak: 0, xp: 0 };
    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { currentStreak: true, xp: true }
        });
        if (user) {
            userStats = { streak: user.currentStreak, xp: user.xp };
        }
    }

    // Fetch the problem from the database
    // For this demo, we'll look for "Two Sum" specifically if ID is '1', 
    // otherwise we try to look up by UUID.
    let problem;

    if (id === '1') {
        problem = await prisma.problem.findFirst({
            where: { title: 'Two Sum' },
            include: {
                testCases: {
                    orderBy: { order: 'asc' }
                },
                topics: {
                    include: {
                        topic: true
                    }
                },
                hintLadders: {
                    orderBy: { level: 'asc' }
                }
            }
        });
    } else {
        problem = await prisma.problem.findUnique({
            where: { id },
            include: {
                testCases: {
                    orderBy: { order: 'asc' }
                },
                topics: {
                    include: {
                        topic: true
                    }
                },
                hintLadders: {
                    orderBy: { level: 'asc' }
                }
            }
        });
    }

    if (!problem) {
        return (
            <div className="h-screen flex items-center justify-center bg-black text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">Problem Not Found</h1>
                    <p className="text-gray-500">Could not find problem with ID: {id}</p>
                </div>
            </div>
        );
    }

    return <ProblemWorkspace problem={problem} userStats={userStats} />;
}
