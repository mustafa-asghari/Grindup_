export function logSecurityEvent(event: {
    type: 'ai_usage' | 'rate_limit' | 'auth_failure' | 'csrf_failure';
    userId?: string;
    ip?: string;
    route: string;
    details?: Record<string, any>;
    status: number;
}) {
    // In production, send to observability tool (e.g. Datadog, CloudWatch)
    // For now, structured JSON to stdout
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        ...event
    }));
}
