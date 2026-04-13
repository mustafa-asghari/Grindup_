'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Check, AlertCircle } from 'lucide-react';

// Store sync status globally so it persists across navigation
let globalSyncInProgress = false;
let globalSyncStartTime: number | null = null;

export function SyncProblemsButton() {
    const [isSyncing, setIsSyncing] = useState(globalSyncInProgress);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>(globalSyncInProgress ? 'syncing' : 'idle');
    const [problemCount, setProblemCount] = useState(0);
    const router = useRouter();

    // Check sync status periodically and refresh if syncing
    useEffect(() => {
        if (!isSyncing) return;

        const interval = setInterval(async () => {
            try {
                // Fetch current problem count to show progress
                const res = await fetch('/api/problems/count');
                if (res.ok) {
                    const data = await res.json();
                    setProblemCount(data.count || 0);
                }
            } catch (e) {
                // Ignore errors
            }

            // Auto-refresh the page every 10 seconds while syncing
            router.refresh();
        }, 10000);

        return () => clearInterval(interval);
    }, [isSyncing, router]);

    const handleSync = async () => {
        if (isSyncing) return;

        setIsSyncing(true);
        setSyncStatus('syncing');
        globalSyncInProgress = true;
        globalSyncStartTime = Date.now();

        // Fire-and-forget: Start the sync and don't wait for it
        fetch('/api/problems/scrape', { method: 'POST' })
            .then(async (res) => {
                const data = await res.json();
                if (res.ok) {
                    setSyncStatus('success');
                    setProblemCount(data.count || 0);
                    router.refresh();
                } else {
                    setSyncStatus('error');
                    console.error('Sync failed:', data.error);
                }
            })
            .catch((e) => {
                setSyncStatus('error');
                console.error('Sync error:', e);
            })
            .finally(() => {
                setIsSyncing(false);
                globalSyncInProgress = false;
                globalSyncStartTime = null;
            });
    };

    return (
        <div className="flex items-center gap-2">
            {isSyncing && (
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-pulse">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                    <span>Syncing... ({problemCount} problems)</span>
                </div>
            )}

            {syncStatus === 'success' && !isSyncing && (
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <Check className="w-3.5 h-3.5" />
                    <span>Synced {problemCount} problems</span>
                </div>
            )}

            {syncStatus === 'error' && !isSyncing && (
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Sync failed</span>
                </div>
            )}

            <button
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg hover:text-white hover:border-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync LeetCode'}
            </button>
        </div>
    );
}
