import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function checkAndAwardBadges(userId: string) {
    const newBadges: string[] = [];

    // 1. Fetch User Stats
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            userBadges: { include: { badges: true } },
            _count: { select: { exerciseAttempts: true } }
        }
    });

    if (!user) return [];

    const existingBadgeNames = new Set(user.userBadges.map(ub => ub.badges.name));
    const totalExercises = user._count.exerciseAttempts;

    // Badge Definitions
    const badgesToAward: { name: string, description: string, icon: string }[] = [];

    // Rule: First Exercise
    if (totalExercises >= 1 && !existingBadgeNames.has('First Steps')) {
        badgesToAward.push({
            name: 'First Steps',
            description: 'Completed your first exercise',
            icon: '👣'
        });
    }

    // Rule: 10 Exercises
    if (totalExercises >= 10 && !existingBadgeNames.has('Decathlete')) {
        badgesToAward.push({
            name: 'Decathlete',
            description: 'Completed 10 exercises',
            icon: '🏅'
        });
    }

    // Rule: Night Owl (Study between 11PM and 4AM)
    const hour = new Date().getHours();
    if ((hour >= 23 || hour < 4) && !existingBadgeNames.has('Night Owl')) {
        badgesToAward.push({
            name: 'Night Owl',
            description: 'Studied late into the night',
            icon: '🦉'
        });
    }

    // Award Badges
    for (const b of badgesToAward) {
        // Find or Create Badge Definition
        let badge = await prisma.badges.findFirst({ where: { name: b.name } });
        if (!badge) {
            badge = await prisma.badges.create({
                data: {
                    id: uuidv4(),
                    name: b.name,
                    description: b.description,
                    iconUrl: b.icon
                }
            });
        }

        // Award to User
        await prisma.userBadges.create({
            data: {
                userId,
                badgeId: badge.id
            }
        });

        newBadges.push(b.name);
    }

    return newBadges;
}

