import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateAuthCredentials, getAuthConfig } from '~/lib/auth';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { username, password, enabled } = await request.json() as { username?: string; password?: string; enabled?: boolean };

    // If authentication is disabled, we don't need any credentials
    if (enabled === false) {
      // Just set AUTH_ENABLED to false without storing credentials
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      // Update or add AUTH_ENABLED
      const enabledRegex = /^AUTH_ENABLED=.*$/m;
      if (enabledRegex.test(envContent)) {
        envContent = envContent.replace(enabledRegex, 'AUTH_ENABLED=false');
      } else {
        envContent += (envContent.endsWith('\n') ? '' : '\n') + 'AUTH_ENABLED=false\n';
      }

      fs.writeFileSync(envPath, envContent);

      return NextResponse.json({ 
        success: true, 
        message: 'Authentication disabled successfully' 
      });
    }

    // If authentication is enabled, require username and password
    if (!username) {
      return NextResponse.json(
        { error: 'Username is required when authentication is enabled' },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters long' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
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
