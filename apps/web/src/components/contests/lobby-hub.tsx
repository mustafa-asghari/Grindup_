'use client';

import { Shield, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LobbyCreator } from './lobby-creator';
import Link from 'next/link';

export function LobbyHub({ currentUserId }: { currentUserId: string }) {
    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Creation Form */}
                <div className="flex-1">
                    <LobbyCreator />
                </div>

                {/* Browse CTA */}
                <div className="flex-1 flex flex-col justify-center items-start p-8 bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl">
                    <div className="p-3 bg-blue-500/10 rounded-xl mb-6">
                        <Shield className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2 text-white">Find a Challenge</h3>
                    <p className="text-gray-400 mb-8 max-w-sm">
                        Browse active lobbies, join public matches, or find a private room to compete with friends.
                    </p>
                    <Link href="/contests/browse">
                        <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-lg px-8 py-6 h-auto">
                            Browse All Lobbies <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
