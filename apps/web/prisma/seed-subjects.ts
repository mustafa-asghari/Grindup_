import { PrismaClient, SubjectCategory, ExerciseType, Difficulty } from '@prisma/client';

const prisma = new PrismaClient();

const subjects = [
    // TECHNOLOGY
    {
        name: 'Data Structures & Algorithms',
        slug: 'data-structures-algorithms',
        description: 'Master fundamental data structures and algorithms for technical interviews and competitive programming.',
        icon: '🧮',
        color: '#3b82f6',
        category: 'technology' as SubjectCategory,
        exerciseTypes: ['coding', 'mcq'] as ExerciseType[],
        estimatedHours: 120,
        difficultyLevel: 'intermediate',
        topics: [
            { name: 'Arrays & Strings', slug: 'arrays-strings', order: 1 },
            { name: 'Linked Lists', slug: 'linked-lists', order: 2 },
            { name: 'Stacks & Queues', slug: 'stacks-queues', order: 3 },
            { name: 'Trees & Graphs', slug: 'trees-graphs', order: 4 },
            { name: 'Dynamic Programming', slug: 'dynamic-programming', order: 5 },
            { name: 'Sorting & Searching', slug: 'sorting-searching', order: 6 },
        ],
    },
    {
        name: 'Python Programming',
        slug: 'python-programming',
        description: 'Learn Python from basics to advanced concepts including OOP, web development, and data science fundamentals.',
        icon: '🐍',
        color: '#22c55e',
        category: 'technology' as SubjectCategory,
        exerciseTypes: ['coding', 'mcq', 'fill_blank'] as ExerciseType[],
        estimatedHours: 80,
        difficultyLevel: 'beginner',
        topics: [
            { name: 'Python Basics', slug: 'python-basics', order: 1 },
            { name: 'Data Types', slug: 'data-types', order: 2 },
            { name: 'Control Flow', slug: 'control-flow', order: 3 },
            { name: 'Functions', slug: 'functions', order: 4 },
            { name: 'OOP in Python', slug: 'oop-python', order: 5 },
            { name: 'File Handling', slug: 'file-handling', order: 6 },
        ],
    },
    {
        name: 'System Design',
        slug: 'system-design',
        description: 'Learn how to design large-scale distributed systems. Essential for senior engineering interviews.',
        icon: '🏗️',
        color: '#8b5cf6',
        category: 'technology' as SubjectCategory,
        exerciseTypes: ['essay', 'mcq'] as ExerciseType[],
        estimatedHours: 60,
        difficultyLevel: 'advanced',
        topics: [
            { name: 'Fundamentals', slug: 'fundamentals', order: 1 },
            { name: 'Databases', slug: 'databases', order: 2 },
            { name: 'Caching', slug: 'caching', order: 3 },
            { name: 'Load Balancing', slug: 'load-balancing', order: 4 },
            { name: 'Microservices', slug: 'microservices', order: 5 },
        ],
    },

    // STEM
    {
        name: 'Calculus I',
        slug: 'calculus-1',
        description: 'Master limits, derivatives, and integrals. Foundation for advanced mathematics and physics.',
        icon: '📐',
        color: '#06b6d4',
        category: 'stem' as SubjectCategory,
        exerciseTypes: ['mcq', 'fill_blank'] as ExerciseType[],
        estimatedHours: 90,
        difficultyLevel: 'intermediate',
        topics: [
            { name: 'Limits', slug: 'limits', order: 1 },
            { name: 'Derivatives', slug: 'derivatives', order: 2 },
            { name: 'Applications of Derivatives', slug: 'applications-derivatives', order: 3 },
            { name: 'Integrals', slug: 'integrals', order: 4 },
            { name: 'Applications of Integrals', slug: 'applications-integrals', order: 5 },
        ],
    },
    {
        name: 'Physics Fundamentals',
        slug: 'physics-fundamentals',
        description: 'Classical mechanics, thermodynamics, and electromagnetism explained with real-world examples.',
        icon: '⚡',
        color: '#f59e0b',
        category: 'stem' as SubjectCategory,
        exerciseTypes: ['mcq', 'fill_blank', 'true_false'] as ExerciseType[],
        estimatedHours: 100,
        difficultyLevel: 'intermediate',
        topics: [
            { name: 'Mechanics', slug: 'mechanics', order: 1 },
            { name: 'Thermodynamics', slug: 'thermodynamics', order: 2 },
            { name: 'Waves & Optics', slug: 'waves-optics', order: 3 },
            { name: 'Electromagnetism', slug: 'electromagnetism', order: 4 },
        ],
    },

    // PROFESSIONAL
    {
        name: 'Medical Terminology',
        slug: 'medical-terminology',
        description: 'Learn the language of medicine. Essential for healthcare professionals and students.',
        icon: '🏥',
        color: '#ef4444',
        category: 'professional' as SubjectCategory,
        exerciseTypes: ['flashcard', 'mcq', 'matching'] as ExerciseType[],
        estimatedHours: 40,
        difficultyLevel: 'beginner',
        topics: [
            { name: 'Word Roots', slug: 'word-roots', order: 1 },
            { name: 'Prefixes & Suffixes', slug: 'prefixes-suffixes', order: 2 },
            { name: 'Body Systems', slug: 'body-systems', order: 3 },
            { name: 'Medical Procedures', slug: 'medical-procedures', order: 4 },
            { name: 'Pharmacology Terms', slug: 'pharmacology-terms', order: 5 },
        ],
    },
    {
        name: 'Constitutional Law',
        slug: 'constitutional-law',
        description: 'Study the fundamental principles of constitutional law and landmark Supreme Court cases.',
        icon: '⚖️',
        color: '#64748b',
        category: 'professional' as SubjectCategory,
        exerciseTypes: ['essay', 'mcq', 'true_false'] as ExerciseType[],
        estimatedHours: 70,
        difficultyLevel: 'advanced',
        topics: [
            { name: 'Constitutional Framework', slug: 'constitutional-framework', order: 1 },
            { name: 'Separation of Powers', slug: 'separation-of-powers', order: 2 },
            { name: 'Bill of Rights', slug: 'bill-of-rights', order: 3 },
            { name: 'Equal Protection', slug: 'equal-protection', order: 4 },
            { name: 'Landmark Cases', slug: 'landmark-cases', order: 5 },
        ],
    },

    // LANGUAGES
    {
        name: 'Spanish for Beginners',
        slug: 'spanish-beginners',
        description: 'Start your Spanish journey with essential vocabulary, grammar, and conversation skills.',
        icon: '🇪🇸',
        color: '#ec4899',
        category: 'languages' as SubjectCategory,
        exerciseTypes: ['flashcard', 'mcq', 'fill_blank', 'audio', 'matching'] as ExerciseType[],
        estimatedHours: 50,
        difficultyLevel: 'beginner',
        topics: [
            { name: 'Basic Vocabulary', slug: 'basic-vocabulary', order: 1 },
            { name: 'Common Phrases', slug: 'common-phrases', order: 2 },
            { name: 'Present Tense', slug: 'present-tense', order: 3 },
            { name: 'Numbers & Time', slug: 'numbers-time', order: 4 },
            { name: 'Food & Shopping', slug: 'food-shopping', order: 5 },
        ],
    },

    // CREATIVE
    {
        name: 'Music Theory Basics',
        slug: 'music-theory-basics',
        description: 'Understand scales, chords, rhythm, and composition fundamentals.',
        icon: '🎵',
        color: '#a855f7',
        category: 'creative' as SubjectCategory,
        exerciseTypes: ['mcq', 'matching', 'audio'] as ExerciseType[],
        estimatedHours: 30,
        difficultyLevel: 'beginner',
        topics: [
            { name: 'Notes & Scales', slug: 'notes-scales', order: 1 },
            { name: 'Rhythm & Time', slug: 'rhythm-time', order: 2 },
            { name: 'Chords', slug: 'chords', order: 3 },
            { name: 'Intervals', slug: 'intervals', order: 4 },
            { name: 'Reading Music', slug: 'reading-music', order: 5 },
        ],
    },

    // LIFESTYLE
    {
        name: 'Personal Finance 101',
        slug: 'personal-finance-101',
        description: 'Master budgeting, investing, and building wealth for financial independence.',
        icon: '💰',
        color: '#10b981',
        category: 'lifestyle' as SubjectCategory,
        exerciseTypes: ['mcq', 'true_false', 'fill_blank'] as ExerciseType[],
        estimatedHours: 25,
        difficultyLevel: 'beginner',
        topics: [
            { name: 'Budgeting', slug: 'budgeting', order: 1 },
            { name: 'Saving Strategies', slug: 'saving-strategies', order: 2 },
            { name: 'Investing Basics', slug: 'investing-basics', order: 3 },
            { name: 'Debt Management', slug: 'debt-management', order: 4 },
            { name: 'Retirement Planning', slug: 'retirement-planning', order: 5 },
        ],
    },
];

async function seedSubjects() {
    console.log('🌱 Seeding subjects...');

    for (const subjectData of subjects) {
        const { topics, ...subjectFields } = subjectData;

        // Upsert subject
        const subject = await prisma.subject.upsert({
            where: { slug: subjectFields.slug },
            update: subjectFields,
            create: subjectFields,
        });

        console.log(`  ✓ ${subject.name}`);

        // Create topics
        for (const topicData of topics) {
            await prisma.subjectTopic.upsert({
                where: {
                    subjectId_slug: {
                        subjectId: subject.id,
                        slug: topicData.slug,
                    },
                },
                update: topicData,
                create: {
                    ...topicData,
                    subjectId: subject.id,
                },
            });
        }

        console.log(`    → ${topics.length} topics`);
    }

    console.log('\n✅ Subjects seeded successfully!');
}

seedSubjects()
    .catch((e) => {
        console.error('Error seeding subjects:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
