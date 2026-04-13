import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { SettingsForm } from '@/components/settings/settings-form';

export default async function SettingsPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            name: true,
            username: true,
            email: true,
        }
    });

    if (!user) {
        redirect('/login');
    }

    return (
        <div className="container mx-auto py-10 px-4 max-w-2xl">
            <h1 className="text-3xl font-bold text-white mb-8">Settings</h1>
            <SettingsForm user={user} />
        </div>
    );
}
