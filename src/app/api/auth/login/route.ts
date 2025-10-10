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

    const token = generateToken(username);

    const response = NextResponse.json({ 
      success: true, 
      message: 'Login successful',
      username 
    });

    // Set httpOnly cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
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
