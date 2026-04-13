
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Award, Download, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GraduationCertificate } from '@/components/learning/graduation-certificate';

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default async function CertificatePage({ params }: PageProps) {
    const { slug } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        redirect('/login');
    }

    const subject = await prisma.subject.findUnique({
        where: { slug }
    });

    if (!subject) redirect('/subjects');

    // Verify completion
    // Check progress or assume user found button because they finished
    // For realism, we should check subject progress > 90%
    const progress = await prisma.userSubject.findFirst({
        where: { userId: session.user.id, subjectId: subject.id }
    });

    if (!progress || progress.progressPercent < 90) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center p-8 bg-black text-white">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mb-6" />
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400 mb-4">
                    Not Eligible Yet
                </h1>
                <p className="text-gray-400 max-w-md text-lg">
                    You must complete at least 90% of the subject to earn a certificate. Keep pushing!
                </p>
                <div className="mt-8">
                    <Link
                        href={`/subjects/${subject.slug}`}
                        className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-medium transition-colors"
                    >
                        Return to Subject
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <GraduationCertificate
                userName={session.user.name || 'Code Master'}
                subjectName={subject.name}
                completionDate={new Date().toLocaleDateString()}
                certificateId={`CERT-${session.user.id.substring(0, 4).toUpperCase()}-${subject.slug.substring(0, 3).toUpperCase()}-${Date.now().toString().substring(8)}`}
                totalHours={progress.totalTimeSpent ? Math.round(progress.totalTimeSpent / 60) : 0}
                exercisesCompleted={progress.exercisesCompleted}
                averageScore={progress.xpEarned > 5000 ? 95 : progress.xpEarned > 3000 ? 85 : 75}
                ranking={95} // Calculate this for real if possible
                specialAchievements={[
                    'Early Bird',
                    'Code Warrior',
                ]}
            />
        </div>
    );
}
