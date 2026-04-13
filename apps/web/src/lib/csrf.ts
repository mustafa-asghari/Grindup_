import { headers } from 'next/headers';

export async function checkCSRF() {
    const headersList = await headers();
    const origin = headersList.get('origin');
    const referer = headersList.get('referer');
    const host = headersList.get('host');

    // Define allowed origins
    const ALLOWED_ORIGINS = new Set<string>();
    
    // Add production URL
    if (process.env.NEXT_PUBLIC_APP_URL) {
        try {
            ALLOWED_ORIGINS.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
        } catch {}
    }

    // Add localhost for dev
    if (process.env.NODE_ENV !== 'production') {
        ALLOWED_ORIGINS.add('http://localhost:3000');
        if (host) {
            ALLOWED_ORIGINS.add(`http://${host}`);
        }
    }

    // Strict Mode: Require at least one header
    if (!origin && !referer) {
        return false;
    }

    // 1. Check Origin (Primary)
    if (origin) {
        // "null" origin is often used by attackers or sandboxed iframes - reject unless explicitly allowed (unlikely for API)
        if (origin === 'null') return false;
        
        if (!ALLOWED_ORIGINS.has(origin)) {
            // Also check if it matches the current host dynamically (for previews/deployments)
            // But be careful: 'host' header can be spoofed in some proxies, though Next.js usually handles trusted proxy.
            // Safe fallback: if origin matches `https://${host}` or `http://${host}`
            const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
            if (origin !== `${protocol}://${host}`) {
                return false;
            }
        }
    }

    // 2. Fallback to Referer (if Origin missing)
    if (!origin && referer) {
        try {
            const refererOrigin = new URL(referer).origin;
            if (!ALLOWED_ORIGINS.has(refererOrigin)) {
                const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
                if (refererOrigin !== `${protocol}://${host}`) {
                    return false;
                }
            }
        } catch {
            return false;
        }
    }

    return true;
}
