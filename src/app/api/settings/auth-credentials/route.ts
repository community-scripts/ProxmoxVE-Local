import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthConfig, updateAuthCredentials, updateAuthEnabled } from '~/lib/auth';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const authConfig = getAuthConfig();
    
    return NextResponse.json({
      username: authConfig.username,
      enabled: authConfig.enabled,
      hasCredentials: authConfig.hasCredentials,
      setupCompleted: authConfig.setupCompleted,
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

    if (enabled) {
      // When enabling, just update the flag
      updateAuthEnabled(enabled);
    } else {
      // When disabling, clear all credentials and set flag to false
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      // Remove AUTH_USERNAME and AUTH_PASSWORD_HASH
      envContent = envContent.replace(/^AUTH_USERNAME=.*$/m, '');
      envContent = envContent.replace(/^AUTH_PASSWORD_HASH=.*$/m, '');
      
      // Update or add AUTH_ENABLED
      const enabledRegex = /^AUTH_ENABLED=.*$/m;
      if (enabledRegex.test(envContent)) {
        envContent = envContent.replace(enabledRegex, 'AUTH_ENABLED=false');
      } else {
        envContent += (envContent.endsWith('\n') ? '' : '\n') + 'AUTH_ENABLED=false\n';
      }

      // Clean up empty lines
      envContent = envContent.replace(/\n\n+/g, '\n');
      
      fs.writeFileSync(envPath, envContent);
    }

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
