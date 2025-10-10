import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateAuthCredentials, getAuthConfig } from '~/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password, enabled } = await request.json() as { username: string; password?: string; enabled?: boolean };

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters long' },
        { status: 400 }
      );
    }

    // Only require password if authentication is enabled
    if (enabled !== false && (!password || password.length < 6)) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if credentials already exist
    const authConfig = getAuthConfig();
    if (authConfig.hasCredentials) {
      return NextResponse.json(
        { error: 'Authentication is already configured' },
        { status: 400 }
      );
    }

    await updateAuthCredentials(username, password, enabled ?? true);

    return NextResponse.json({ 
      success: true, 
      message: 'Authentication setup completed successfully' 
    });
  } catch (error) {
    console.error('Error during setup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
