import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AiTutorClient } from '@/components/subjects/ai-tutor-client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
    params: { slug: string };
}

export default async function SubjectTutorPage({ params }: PageProps) {
    const { slug } = params;
    await auth();

    const subject = await prisma.subject.findUnique({
        where: { slug },
        include: {
            topics: { select: { id: true, name: true } }
        }
    });

    if (!subject) {
        redirect('/subjects');
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8">
            <Link
                href={`/subjects/${slug}`}
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>

            <div className="max-w-4xl mx-auto">
                <AiTutorClient
                    subjectId={subject.id}
                    subjectName={subject.name}
                />
            </div>
        </div>
    );
}
