'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid with dark theme
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#fff',
        primaryBorderColor: '#60a5fa',
        lineColor: '#6b7280',
        secondaryColor: '#1f2937',
        tertiaryColor: '#111827',
        background: '#0a0a0a',
        mainBkg: '#1f2937',
        nodeBorder: '#3b82f6',
        clusterBkg: '#1f2937',
        clusterBorder: '#374151',
        titleColor: '#fff',
        edgeLabelBackground: '#1f2937',
    },
    flowchart: {
        htmlLabels: true,
        curve: 'basis',
    },
    securityLevel: 'loose',
});

interface MermaidProps {
    chart: string;
    className?: string;
    fallbackLabel?: string;
}

function buildFallbackChart(label?: string): string {
    const safeLabel = (label || 'Topic')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const shortLabel = safeLabel ? safeLabel.split(' ').slice(0, 3).join(' ') : 'Topic';
    return `flowchart TD
    A[${shortLabel}] --> B[Core Idea]
    B --> C[Mechanism]
    C --> D[Outcome]
    B --> E[Constraint]`;
}

export function Mermaid({ chart, className = '', fallbackLabel }: MermaidProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

        const renderChart = async () => {
            if (!chart || !containerRef.current) return;

            setSvg('');
            setError(null);

            const cleanedChart = chart.replace(/\u00A0/g, ' ').trim();
            const fallbackChart = buildFallbackChart(fallbackLabel);
            const renderId = () => `mermaid-${Math.random().toString(36).slice(2, 9)}`;

            const tryRender = async (source: string) => {
                const { svg: renderedSvg } = await mermaid.render(renderId(), source);
                if (!isActive) return;
                setSvg(renderedSvg);
                setError(null);
            };

            try {
                await Promise.race([
                    tryRender(cleanedChart),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('render_timeout')), 2500)),
                ]);
            } catch (err) {
                console.error('Mermaid rendering error:', err);
                try {
                    await tryRender(fallbackChart);
                } catch (fallbackErr) {
                    console.error('Mermaid fallback rendering error:', fallbackErr);
                    if (isActive) {
                        setError('Failed to render diagram');
                    }
                }
            }
        };

        renderChart();

        return () => {
            isActive = false;
        };
    }, [chart, fallbackLabel]);

    return (
        <div ref={containerRef} className={`${className} overflow-hidden`}>
            {error ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                    {error}
                </div>
            ) : !svg ? (
                <div className="p-4 bg-gray-800/50 rounded-xl animate-pulse">
                    <div className="h-32 bg-gray-700/50 rounded" />
                </div>
            ) : (
                <div
                    className="mermaid-container p-3 bg-gray-900/50 rounded-xl border border-gray-800 overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            )}
        </div>
    );
}
