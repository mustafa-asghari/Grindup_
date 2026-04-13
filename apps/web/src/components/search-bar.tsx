'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

export function SearchBar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [term, setTerm] = useState(searchParams.get('q') || '');

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (term.trim()) {
            router.push(`/problems?q=${encodeURIComponent(term)}`);
        } else {
            router.push('/problems');
        }
    };

    return (
        <form onSubmit={handleSearch} className="relative w-full max-w-md mr-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search problems..."
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
        </form>
    );
}
