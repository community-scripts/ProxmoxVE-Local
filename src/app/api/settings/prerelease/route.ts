import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { enabled } = await request.json();

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Enabled value must be a boolean' },
        { status: 400 }
      );
    }

    const envPath = path.join(process.cwd(), '.env');

    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    const regex = /^ALLOW_PRERELEASE=.*$/m;
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `ALLOW_PRERELEASE=${enabled}`);
    } else {
      envContent += (envContent.endsWith('\n') ? '' : '\n') + `ALLOW_PRERELEASE=${enabled}\n`;
    }

    fs.writeFileSync(envPath, envContent);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving prerelease setting:', error);
    return NextResponse.json({ error: 'Failed to save prerelease setting' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const envPath = path.join(process.cwd(), '.env');

    if (!fs.existsSync(envPath)) {
      return NextResponse.json({ enabled: false });
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = /^ALLOW_PRERELEASE=(.*)$/m.exec(envContent);
    const enabled = match ? match[1]?.trim() === 'true' : false;

    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('Error reading prerelease setting:', error);
    return NextResponse.json({ enabled: false });
  }
}
