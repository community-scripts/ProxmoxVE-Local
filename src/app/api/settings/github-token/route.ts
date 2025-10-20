import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { withApiLogging } from '../../../../server/logging/withApiLogging';

export const POST = withApiLogging(async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token is required and must be a string' },
        { status: 400 }
      );
    }

    // Path to the .env file
    const envPath = path.join(process.cwd(), '.env');
    
    // Read existing .env file
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Check if GITHUB_TOKEN already exists
    const githubTokenRegex = /^GITHUB_TOKEN=.*$/m;
    const githubTokenMatch = githubTokenRegex.exec(envContent);
    
    if (githubTokenMatch) {
      // Replace existing GITHUB_TOKEN
      envContent = envContent.replace(githubTokenRegex, `GITHUB_TOKEN=${token}`);
    } else {
      // Add new GITHUB_TOKEN
      envContent += (envContent.endsWith('\n') ? '' : '\n') + `GITHUB_TOKEN=${token}\n`;
    }

    // Write back to .env file
    fs.writeFileSync(envPath, envContent);

    return NextResponse.json({ success: true, message: 'GitHub token saved successfully' });
  } catch {
    // Error handled by withApiLogging
    return NextResponse.json(
      { error: 'Failed to save GitHub token' },
      { status: 500 }
    );
  }
}, { redactBody: true });

export const GET = withApiLogging(async function GET() {
  try {
    // Path to the .env file
    const envPath = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ token: null });
    }

    // Read .env file and extract GITHUB_TOKEN
    const envContent = fs.readFileSync(envPath, 'utf8');
    const githubTokenRegex = /^GITHUB_TOKEN=(.*)$/m;
    const githubTokenMatch = githubTokenRegex.exec(envContent);
    
    const token = githubTokenMatch ? githubTokenMatch[1] : null;
    
    return NextResponse.json({ token });
  } catch {
    // Error handled by withApiLogging
    return NextResponse.json(
      { error: 'Failed to read GitHub token' },
      { status: 500 }
    );
  }
}, { redactBody: true });
