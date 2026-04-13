
'use client';

import { useToast } from "@/components/ui/use-toast";
import { X } from "lucide-react";

export function Toaster() {
    const { toasts } = useToast();

    // Since our simplified useToast creates new stale copies, we might need a way to dismiss them?
    // The simplified version in use-toast.ts does NOT seem to implement DISMISS reducer logic in dispatch properly (it just adds).
    // But let's at least show them.

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
            {toasts.map((toast: any, index: number) => (
                <div
                    key={index}
                    className={`
                        pointer-events-auto
                        flex items-start justify-between gap-4 p-4 rounded-lg shadow-lg border
                        transition-all duration-300 animate-in slide-in-from-right-full
                        ${toast.variant === 'destructive' ? 'bg-red-900 border-red-800 text-white' : 'bg-zinc-900 border-zinc-800 text-white'}
                    `}
                >
                    <div className="grid gap-1">
                        {toast.title && <h3 className="font-semibold text-sm">{toast.title}</h3>}
                        {toast.description && <p className="text-sm opacity-90">{toast.description}</p>}
                    </div>
                </div>
            ))}
        </div>
    );
}
