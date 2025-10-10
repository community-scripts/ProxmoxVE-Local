import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthConfig, updateAuthCredentials, updateAuthEnabled } from '~/lib/auth';

export async function GET() {
  try {
    const authConfig = getAuthConfig();
    
    return NextResponse.json({
      username: authConfig.username,
      enabled: authConfig.enabled,
      hasCredentials: authConfig.hasCredentials,
    });
  } catch (error) {
    console.error('Error reading auth credentials:', error);
    return NextResponse.json(
      { error: 'Failed to read auth configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, enabled } = await request.json() as { username: string; password: string; enabled?: boolean };

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters long' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    await updateAuthCredentials(username, password, enabled ?? false);

    return NextResponse.json({ 
      success: true, 
      message: 'Authentication credentials updated successfully' 
    });
  } catch (error) {
    console.error('Error updating auth credentials:', error);
    return NextResponse.json(
      { error: 'Failed to update auth credentials' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { enabled } = await request.json() as { enabled: boolean };

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Enabled flag must be a boolean' },
        { status: 400 }
      );
    }

    updateAuthEnabled(enabled);

    return NextResponse.json({ 
      success: true, 
      message: `Authentication ${enabled ? 'enabled' : 'disabled'} successfully` 
    });
  } catch (error) {
    console.error('Error updating auth enabled status:', error);
    return NextResponse.json(
      { error: 'Failed to update auth status' },
      { status: 500 }
    );
  }
}
