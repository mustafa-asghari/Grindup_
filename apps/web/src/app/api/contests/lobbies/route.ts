import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lobbies = await prisma.contestLobby.findMany({
        where: {
            isActive: true,
            participants: { some: {} }
        },
        include: {
            participants: {
                include: { user: { select: { id: true, username: true, name: true, image: true } } }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
        lobbies: lobbies.map(l => ({
            id: l.id,
            title: l.title,
            visibility: l.visibility,
            mode: l.mode,
            targetValue: l.targetValue,
            status: l.status,
            durationMinutes: l.durationMinutes,
            startedAt: l.startedAt?.toISOString(),
            endedAt: l.endedAt?.toISOString(),
            createdById: l.createdById,
            participantCount: l.participants.length,
            participants: l.participants.map(p => ({
                id: p.id,
                userId: p.userId,
                role: p.role,
                username: p.user.username || p.user.name || 'Anonymous',
                image: p.user.image || null,
            }))
        }))
    });
}

type LobbyAction =
    | { action: 'create'; title: string; visibility: 'PUBLIC' | 'PRIVATE'; password?: string; mode?: 'LEETCODE_RACE' | 'STUDY_TIME' | 'EXERCISE_COUNT' | 'XP_RACE' | 'CUSTOM'; targetValue?: number; durationMinutes?: number }
    | { action: 'join'; lobbyId: string; password?: string }
    | { action: 'leave'; lobbyId: string }
    | { action: 'kick'; lobbyId: string; targetUserId: string }
    | { action: 'start'; lobbyId: string }
    | { action: 'delete'; lobbyId: string };

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as LobbyAction;
    const userId = session.user.id;

    if (body.action === 'create') {
        if (!body.title || !body.visibility) {
            return NextResponse.json({ error: 'Missing title or visibility' }, { status: 400 });
        }
        const mode = body.mode ?? 'CUSTOM';
        const allowedModes = new Set(['LEETCODE_RACE', 'STUDY_TIME', 'EXERCISE_COUNT', 'XP_RACE', 'CUSTOM']);
        if (!allowedModes.has(mode)) {
            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
        }
        const passwordHash = body.visibility === 'PRIVATE' && body.password
            ? await bcrypt.hash(body.password, 10)
            : null;
        const clampedTarget = body.targetValue ? Math.min(Number(body.targetValue), 10000) : null;
        const durInput = Number(body.durationMinutes);
        const duration = !isNaN(durInput) && durInput > 0 ? Math.min(Math.floor(durInput), 1440) : null;

        const lobby = await prisma.contestLobby.create({
            data: {
                id: randomUUID(),
                title: body.title.slice(0, 80),
                createdById: userId,
                visibility: body.visibility,
                passwordHash,
                mode,
                targetValue: clampedTarget,
                durationMinutes: duration,
                participants: {
                    create: {
                        id: randomUUID(),
                        userId,
                        role: 'HOST',
                    }
                }
            },
            include: {
                participants: {
                    include: { user: { select: { id: true, username: true, name: true, image: true } } }
                }
            }
        });

        return NextResponse.json({ lobby });
    }

    if (body.action === 'join') {
        const lobby = await prisma.contestLobby.findUnique({
            where: { id: body.lobbyId, isActive: true },
            include: { participants: true }
        });
        if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });

        if (lobby.visibility === 'PRIVATE') {
            if (!body.password || !lobby.passwordHash || !(await bcrypt.compare(body.password, lobby.passwordHash))) {
                return NextResponse.json({ error: 'Invalid password' }, { status: 403 });
            }
        }

        const alreadyJoined = lobby.participants.some(p => p.userId === userId);
        if (alreadyJoined) {
            return NextResponse.json({ success: true });
        }
        // If lobby is started, maybe restrict joining? User said "users can leave ... admin can finish ... before it started". Doesn't say can't join after start.
        // Usually contests allow late join or not. I'll allow it for now.

        await prisma.contestLobbyParticipant.create({
            data: {
                id: randomUUID(),
                lobbyId: lobby.id,
                userId,
                role: 'MEMBER',
            }
        });
        return NextResponse.json({ success: true });
    }

    if (body.action === 'leave') {
        await prisma.contestLobbyParticipant.deleteMany({
            where: { lobbyId: body.lobbyId, userId }
        });
        // If host leaves, we might want to check if lobby becomes empty or assign new host.
        // For simplicity: if empty, delete lobby?
        // Let's stick to minimal changes requested.
        return NextResponse.json({ success: true });
    }

    if (body.action === 'kick') {
        const lobby = await prisma.contestLobby.findUnique({
            where: { id: body.lobbyId },
            include: { participants: true }
        });
        if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
        const me = lobby.participants.find(p => p.userId === userId);
        if (!me || me.role !== 'HOST') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        await prisma.contestLobbyParticipant.deleteMany({
            where: { lobbyId: body.lobbyId, userId: body.targetUserId }
        });
        return NextResponse.json({ success: true });
    }

    if (body.action === 'start') {
        const lobby = await prisma.contestLobby.findUnique({
            where: { id: body.lobbyId },
            include: { participants: true }
        });
        if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });

        const me = lobby.participants.find(p => p.userId === userId);
        if (!me || me.role !== 'HOST') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        if (lobby.status !== 'WAITING') return NextResponse.json({ error: 'Already started' }, { status: 400 });

        const now = new Date();
        const updateData: any = {
            status: 'STARTED',
            startedAt: now,
        };

        if (lobby.durationMinutes) {
            updateData.endedAt = new Date(now.getTime() + lobby.durationMinutes * 60000);
        }

        const updated = await prisma.contestLobby.update({
            where: { id: body.lobbyId },
            data: updateData
        });

        return NextResponse.json({ success: true, lobby: updated });
    }

    if (body.action === 'delete') {
        const lobby = await prisma.contestLobby.findUnique({
            where: { id: body.lobbyId },
            include: { participants: true }
        });
        if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });

        const me = lobby.participants.find(p => p.userId === userId);
        if (!me || me.role !== 'HOST') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        if (lobby.status === 'STARTED') {
            return NextResponse.json({ error: 'Cannot delete started lobby' }, { status: 400 });
        }

        await prisma.contestLobby.delete({
            where: { id: body.lobbyId }
        });

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
