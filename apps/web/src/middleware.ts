import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Middleware disabled (no routes matched) to avoid dev hot-reload churn.
export function middleware(_req: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: [],
};
