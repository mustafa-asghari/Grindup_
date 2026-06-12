import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SubjectsLibraryClient } from '@/components/subjects/subjects-library-client';

export const metadata = {
    title: 'Subjects | GrindUp',
    description: 'Browse and enroll in subjects to start your learning journey',
};

export default async function SubjectsPage() {
    const session = await auth();
    const userId = session?.user?.id;

    // Fetch all active subjects with enrollment counts
    const subjects = await prisma.subject.findMany({
        where: { isActive: true },
        orderBy: [
            { category: 'asc' },
            { name: 'asc' },
        ],
        include: {
            _count: {
                select: {
                    userSubjects: true,
                    exercises: true,
                    topics: true,
                },
            },
        },
    });

    // If user is logged in, get their enrolled subjects and stats
    let enrolledSubjectIds: string[] = [];
    let userStats = { streak: 0, xp: 0, level: 1 };
    let displayName = '';
    let displayInitial = '';

    if (userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                userSubjects: {
                    select: { subjectId: true }
                }
            }
        });

        if (user) {
            enrolledSubjectIds = user.userSubjects.map(e => e.subjectId);
            userStats = {
                streak: user.currentStreak,
                xp: user.xp,
                level: user.level
            };
            displayName = user.name || 'User';
            displayInitial = user.name?.[0]?.toUpperCase() || 'U';
        }
    }

    // Transform for client
    const subjectsData = subjects.map(subject => ({
        id: subject.id,
        name: subject.name,
        slug: subject.slug,
        description: subject.description,
        icon: subject.icon,
        color: subject.color,
        category: subject.category,
        estimatedHours: subject.estimatedHours,
        difficultyLevel: subject.difficultyLevel,
        enrollmentCount: subject._count.userSubjects,
        exerciseCount: subject._count.exercises,
        topicCount: subject._count.topics,
        isEnrolled: enrolledSubjectIds.includes(subject.id),
    }));

    // Group by category
    const categories = [
        { value: 'stem', label: 'STEM', description: 'Math, Physics, Chemistry, Biology' },
        { value: 'technology', label: 'Technology', description: 'Programming, DevOps, Cloud, Data Science' },
        { value: 'professional', label: 'Professional', description: 'Law, Medicine, Business, Certifications' },
        { value: 'humanities', label: 'Humanities', description: 'History, Philosophy, Literature' },
        { value: 'languages', label: 'Languages', description: 'English, Spanish, French, Mandarin' },
        { value: 'creative', label: 'Creative', description: 'Art, Music, Design, Writing' },
        { value: 'lifestyle', label: 'Lifestyle', description: 'Health, Fitness, Personal Development' },
    ];

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <SubjectsLibraryClient
                subjects={subjectsData}
                categories={categories}
                isLoggedIn={!!session}
                userStats={userStats}
                displayName={displayName}
                displayInitial={displayInitial}
            />
        </div>
    );
}
