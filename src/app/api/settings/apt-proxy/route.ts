import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');

function readEnvVar(name: string): string {
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = new RegExp(`^${name}=(.*)$`, 'm').exec(content);
    return match?.[1]?.trim() ?? '';
  } catch {
    return '';
  }
}

function writeEnvVar(name: string, value: string) {
  let content = '';
  try {
    content = fs.readFileSync(envPath, 'utf8');
  } catch {
    // File doesn't exist yet
  }

  const regex = new RegExp(`^${name}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${name}=${value}`);
  } else {
    content = content.trimEnd() + `\n${name}=${value}\n`;
  }
  fs.writeFileSync(envPath, content);
}

export async function GET() {
  const enabled = readEnvVar('APT_CACHER_ENABLED') === 'yes';
  const ip = readEnvVar('APT_CACHER_IP');
  return NextResponse.json({ enabled, ip });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { enabled?: boolean; ip?: string };

  if (typeof body.enabled === 'boolean') {
    writeEnvVar('APT_CACHER_ENABLED', body.enabled ? 'yes' : 'no');
  }
  if (typeof body.ip === 'string') {
    writeEnvVar('APT_CACHER_IP', body.ip);
  }

  return NextResponse.json({ success: true });
}
