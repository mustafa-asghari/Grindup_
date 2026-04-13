'use client';

import { useEffect, useState } from 'react';
import { Coffee, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export function WellbeingMonitor() {
    const [showBreakPrompt, setShowBreakPrompt] = useState(false);

    useEffect(() => {
        // Monitor session duration
        // Show prompt after 45 minutes
        const timer = setTimeout(() => {
            setShowBreakPrompt(true);
        }, 1000 * 60 * 45);

        return () => clearTimeout(timer);
    }, []);

    if (!showBreakPrompt) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-8 right-8 z-50 max-w-sm"
            >
                <div className="bg-gray-800/90 backdrop-blur border border-blue-500/30 p-6 rounded-2xl shadow-2xl flex items-start gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-xl">
                        <Coffee className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-1">Time for a break?</h4>
                        <p className="text-sm text-gray-400 mb-3">
                            You've been studying for a while. Short breaks improve retention and focus.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowBreakPrompt(false)}
                                className="text-sm font-medium text-white hover:text-blue-400 transition-colors"
                            >
                                I'm good
                            </button>
                            <button
                                onClick={() => setShowBreakPrompt(false)}
                                className="text-sm font-medium px-3 py-1.5 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
                            >
                                Take 5 mins
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowBreakPrompt(false)}
                        className="text-gray-500 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
