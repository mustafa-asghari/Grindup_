'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';

export default function ForceSignOut() {
    useEffect(() => {
        signOut({ callbackUrl: '/login' });
    }, []);

    return (
        <div className="flex items-center justify-center min-h-screen bg-black text-white">
            <p>Signing out...</p>
        </div>
    );
}
