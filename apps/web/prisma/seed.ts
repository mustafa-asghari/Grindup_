
import { PrismaClient, Difficulty, CardType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // 1. Create Subjects
    const biology = await prisma.subject.upsert({
        where: { slug: 'biology-101' },
        update: {},
        create: {
            name: 'Biology 101',
            slug: 'biology-101',
            description: 'Introduction to cellular biology and genetics.',
            category: 'stem',
            icon: 'dna',
            color: '#22c55e',
            difficultyLevel: 'beginner',
            isActive: true,
            estimatedHours: 20
        }
    });

    const webDev = await prisma.subject.upsert({
        where: { slug: 'web-dev-basics' },
        update: {},
        create: {
            name: 'Web Dev Basics',
            slug: 'web-dev-basics',
            description: 'Learn HTML, CSS, and basic JavaScript.',
            category: 'technology',
            icon: 'code',
            color: '#3b82f6',
            difficultyLevel: 'beginner',
            isActive: true,
            estimatedHours: 30
        }
    });

    // 2. Create Topics for Biology
    const cellTopic = await prisma.subjectTopic.create({
        data: {
            subjectId: biology.id,
            name: 'Cell Structure',
            slug: 'cell-structure',
            description: 'Understanding the parts of a cell.',
            order: 1,
        }
    });

    const geneticsTopic = await prisma.subjectTopic.create({
        data: {
            subjectId: biology.id,
            name: 'Genetics',
            slug: 'genetics',
            description: 'DNA, RNA, and inheritance.',
            order: 2
        }
    });

    // 3. Create Exercises for Cell Structure
    // MCQ
    await prisma.exercise.create({
        data: {
            id: uuidv4(),
            updatedAt: new Date(),
            subjectId: biology.id,
            topicId: cellTopic.id,
            title: 'Powerhouse of the Cell',
            type: 'mcq',
            difficulty: 'easy',
            points: 10,
            content: {
                question: 'Which organelle is known as the powerhouse of the cell?',
                options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi Apparatus'],
                correctAnswers: [1],
                explanation: 'Mitochondria generate most of the chemical energy needed to power the cell.'
            }
        }
    });

    // Flashcards
    await prisma.exercise.create({
        data: {
            id: uuidv4(),
            updatedAt: new Date(),
            subjectId: biology.id,
            topicId: cellTopic.id,
            title: 'Cell Membranes',
            type: 'flashcard',
            difficulty: 'medium',
            points: 5,
            content: {
                front: 'What is the primary function of the cell membrane?',
                back: 'To protect the cell and control the movement of substances in and out.'
            }
        }
    });

    await prisma.exercise.create({
        data: {
            id: uuidv4(),
            updatedAt: new Date(),
            subjectId: biology.id,
            topicId: cellTopic.id,
            title: 'Nucleus Function',
            type: 'flashcard',
            difficulty: 'easy',
            points: 5,
            content: {
                front: 'What does the nucleus contain?',
                back: 'The cell\'s genetic material (DNA).'
            }
        }
    });

    // 4. Create Contest
    const contest = await prisma.contest.create({
        data: {
            id: uuidv4(),
            title: 'Weekly Sprint #42',
            startsAt: new Date(Date.now() - 1000 * 60 * 60), // Started 1 hour ago
            endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // Ends in 1 day
            isRated: true,
            // No problems linked yet as Problem model is separate, but Contest exists
        }
    });

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
