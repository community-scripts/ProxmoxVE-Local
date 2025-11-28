import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { comparePassword, generateToken, getAuthConfig } from '~/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json() as { username: string; password: string };

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const authConfig = getAuthConfig();

    if (!authConfig.hasCredentials) {
      return NextResponse.json(
        { error: 'Authentication not configured' },
        { status: 400 }
      );
    }

    if (username !== authConfig.username) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isValidPassword = await comparePassword(password, authConfig.passwordHash!);
    
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const sessionDurationDays = authConfig.sessionDurationDays;
    const token = generateToken(username, sessionDurationDays);

    const response = NextResponse.json({ 
      success: true, 
      message: 'Login successful',
      username 
    });

    // Determine if request is over HTTPS
    const isSecure = request.url.startsWith('https://');

    // Set httpOnly cookie with configured duration
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: isSecure, // Only secure if actually over HTTPS
      sameSite: 'lax', // Use lax for cross-origin navigation support
      maxAge: sessionDurationDays * 24 * 60 * 60, // Use configured duration
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
