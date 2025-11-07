import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifyToken } from '~/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Calculate expiration time in milliseconds
    const expirationTime = decoded.exp ? decoded.exp * 1000 : null;
    const currentTime = Date.now();
    const timeUntilExpiration = expirationTime ? expirationTime - currentTime : null;

    return NextResponse.json({ 
      success: true, 
      username: decoded.username,
      authenticated: true,
      expirationTime,
      timeUntilExpiration
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
