import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthConfig, verifyToken } from '~/lib/auth';

/**
 * Enforces API authentication only when auth is configured and enabled.
 * Returns a NextResponse when unauthorized, otherwise null.
 */
export function requireApiAuth(request: NextRequest): NextResponse | null {
    const authConfig = getAuthConfig();

    // Keep existing behavior when auth is not enabled/configured.
    if (!authConfig.enabled || !authConfig.setupCompleted) {
        return null;
    }

    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return NextResponse.json(
            { error: 'Invalid or expired token' },
            { status: 401 }
        );
    }

    return null;
}
