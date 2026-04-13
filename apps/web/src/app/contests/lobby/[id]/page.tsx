
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { LobbyView } from '@/components/contests/lobby-view';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function LobbyPage({ params }: PageProps) {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        redirect(`/login?callbackUrl=/contests/lobby/${id}`);
    }

    const lobby = await prisma.contestLobby.findUnique({
        where: { id },
        include: {
            participants: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            image: true,
                        }
                    }
                }
            }
        }
    });

    if (!lobby) {
        notFound();
    }

    // Check if user is a participant
    const isParticipant = lobby.participants.some(p => p.userId === session?.user?.id);
    if (!isParticipant) {
        // Redirect to main contest page if not part of it (LobbyHub handles joining)
        // Alternatively, we could show a "Join" screen here.
        // For now, redirect to hub is safer as it has the list and join logic.
        // Actually, users might share the link.
        // Ideally, we show a preview/join screen here.
        // But let's assume for now they must join via Hub.
        // Or better: Let LobbyView handle "Not joined" state if we want deep linking?
        // But currently LobbyView assumes "initialLobby" has full data.
        // I will redirect to /contests for now with a query param?
        // Let's redirect to /contests so they can find it in the list (or implement join page later).
        // Wait, if I share a link, I want to join.
        // Since LobbyHub is on /contests, redirecting there is fine.
        redirect('/contests');
    }

    const formattedLobby = {
        ...lobby,
        participants: lobby.participants.map(p => ({
            userId: p.userId,
            username: p.user.name || 'User',
            role: p.role,
            joinedAt: p.joinedAt.toISOString(),
        })),
        startedAt: lobby.startedAt?.toISOString(),
        endedAt: lobby.endedAt?.toISOString(),
    };

    return (
        <LobbyView
            initialLobby={formattedLobby}
            currentUserId={session.user.id}
            currentUser={{
                name: session.user.name,
                email: session.user.email,
                image: session.user.image
            }}
        />
    );
}
