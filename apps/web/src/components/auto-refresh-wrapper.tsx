'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AutoRefreshWrapperProps {
    children: React.ReactNode;
    intervalMs?: number;
    enabled?: boolean;
}

/**
 * Wraps children with auto-refresh functionality.
 * When enabled, will refresh the page data at the specified interval.
 */
export function AutoRefreshWrapper({
    children,
    intervalMs = 10000,
    enabled = true
}: AutoRefreshWrapperProps) {
    const router = useRouter();
    const [lastRefresh, setLastRefresh] = useState(Date.now());

    useEffect(() => {
        if (!enabled) return;

        const interval = setInterval(() => {
            router.refresh();
            setLastRefresh(Date.now());
        }, intervalMs);

        return () => clearInterval(interval);
    }, [enabled, intervalMs, router]);

    return <>{children}</>;
}
