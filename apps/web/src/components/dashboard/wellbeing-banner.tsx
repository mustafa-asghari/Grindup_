'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    X,
    TrendingDown,
    Coffee,
    Zap,
    Heart,
    BookOpen
} from 'lucide-react';

interface Alert {
    id: string;
    alert_type: string;
    severity: string;
    details: any;
    strategy_shift?: string;
    created_at: string;
}

interface WellbeingBannerProps {
    onDismiss?: (alertId: string) => void;
}

export function WellbeingBanner({ onDismiss }: WellbeingBannerProps) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const res = await fetch('/api/wellbeing');
                if (res.ok) {
                    const data = await res.json();
                    setAlerts(data);
                }
            } catch (error) {
                console.error('Failed to fetch wellbeing alerts:', error);
            }
        };

        fetchAlerts();
    }, []);

    const acknowledgeAlert = async (alertId: string) => {
        try {
            await fetch('/api/wellbeing', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertId }),
            });
            setAlerts(alerts.filter(a => a.id !== alertId));
            onDismiss?.(alertId);
        } catch (error) {
            console.error('Failed to acknowledge alert:', error);
        }
    };

    // Reset index if out of bounds (e.g. after dismissing an alert)
    useEffect(() => {
        if (currentIndex >= alerts.length) {
            setCurrentIndex(0);
        }
    }, [alerts.length, currentIndex]);

    if (alerts.length === 0) {
        return null;
    }

    const alert = alerts[currentIndex];

    // Safety check if alert is still undefined
    if (!alert) return null;

    const getAlertStyles = (type: string, severity: string) => {
        if (type === 'stagnation') {
            return severity === 'high'
                ? 'bg-red-500/10 border-red-500/30 text-red-200'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-200';
        }
        if (type === 'frustration_spike') {
            return 'bg-orange-500/10 border-orange-500/30 text-orange-200';
        }
        if (type === 'burnout_risk') {
            return 'bg-purple-500/10 border-purple-500/30 text-purple-200';
        }
        return 'bg-zinc-800 border-zinc-700 text-zinc-200';
    };

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'stagnation': return TrendingDown;
            case 'frustration_spike': return Zap;
            case 'burnout_risk': return Coffee;
            default: return AlertTriangle;
        }
    };

    const getAlertTitle = (type: string) => {
        switch (type) {
            case 'stagnation': return 'Progress Plateau Detected';
            case 'frustration_spike': return 'Struggling? Take a Break!';
            case 'burnout_risk': return "You're Working Hard!";
            default: return 'Learning Alert';
        }
    };

    const Icon = getAlertIcon(alert.alert_type);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`rounded-xl border p-4 mb-6 ${getAlertStyles(alert.alert_type, alert.severity)}`}
            >
                <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-white/5">
                        <Icon className="w-6 h-6" />
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold">
                                {getAlertTitle(alert.alert_type)}
                            </h4>
                            {alerts.length > 1 && (
                                <span className="text-xs opacity-60">
                                    {currentIndex + 1} of {alerts.length}
                                </span>
                            )}
                        </div>

                        {/* Alert-specific content */}
                        {alert.alert_type === 'stagnation' && alert.details && (
                            <p className="text-sm opacity-80 mb-2">
                                You haven't practiced <strong>{alert.details.topic}</strong> in a while.
                                Current mastery: {Math.round(alert.details.mastery)}%
                            </p>
                        )}

                        {alert.strategy_shift && (
                            <div className="flex items-start gap-2 mt-3 p-3 bg-white/5 rounded-lg">
                                <BookOpen className="w-4 h-4 mt-0.5 opacity-60" />
                                <div>
                                    <p className="text-xs font-medium opacity-60 mb-1">Suggested Action</p>
                                    <p className="text-sm">{alert.strategy_shift}</p>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-4">
                            <button
                                onClick={() => acknowledgeAlert(alert.id)}
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                            >
                                <Heart className="w-4 h-4 inline mr-1" />
                                Got it, thanks!
                            </button>

                            {alerts.length > 1 && (
                                <button
                                    onClick={() => setCurrentIndex((currentIndex + 1) % alerts.length)}
                                    className="px-3 py-1.5 text-sm opacity-60 hover:opacity-100 transition-opacity"
                                >
                                    Next alert →
                                </button>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="opacity-60 hover:opacity-100 transition-opacity"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
