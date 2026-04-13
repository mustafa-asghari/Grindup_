'use client';

import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ImportsPage() {
    const { data, error, isLoading } = useSWR('/api/import/list', fetcher);

    return (
        <div className="min-h-screen bg-black text-white px-6 py-10">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">My Imports</h1>
                        <p className="text-gray-400 mt-2">Sources you imported and the subjects created from them.</p>
                    </div>
                    <Link href="/import" className="text-sm text-blue-400 hover:text-blue-300">+ New import</Link>
                </div>

                {error && <div className="text-red-400 text-sm">Failed to load imports</div>}
                {isLoading && <div className="text-gray-400">Loading...</div>}

                <div className="space-y-4">
                    {data?.imports?.length === 0 && <div className="text-gray-500 text-sm">No imports yet.</div>}
                    {data?.imports?.map((item: any) => (
                        <div key={item.id} className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4 flex justify-between items-center">
                            <div>
                                <div className="text-sm text-gray-400">{item.source_type} • {new Date(item.created_at).toLocaleString()}</div>
                                <div className="text-lg font-semibold text-white">{item.subject_name}</div>
                                {item.subject_slug && (
                                    <Link href={`/subjects/${item.subject_slug}`} className="text-blue-400 text-sm hover:text-blue-300">View subject</Link>
                                )}
                            </div>
                            {item.source_url && <div className="text-xs text-gray-500 break-all max-w-xs text-right">{item.source_url}</div>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
