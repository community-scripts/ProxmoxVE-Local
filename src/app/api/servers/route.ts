import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../server/database-prisma';
import type { CreateServerData } from '../../../types/server';
import { withApiLogging } from '../../../server/logging/withApiLogging';

export const GET = withApiLogging(async function GET() {
  try {
    const db = getDatabase();
    const servers = await db.getAllServers();
    return NextResponse.json(servers);
  } catch {
    // Error handled by withApiLogging
    return NextResponse.json(
      { error: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
}, { redactBody: true });

export const POST = withApiLogging(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color, key_generated, ssh_key_path }: CreateServerData = body;

    // Validate required fields
    if (!name || !ip || !user) {
      return NextResponse.json(
        { error: 'Missing required fields: name, ip, and user are required' },
        { status: 400 }
      );
    }

    // Coerce and validate SSH port
    const port = ssh_port !== undefined ? parseInt(String(ssh_port), 10) : 22;
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      return NextResponse.json(
        { error: 'SSH port must be between 1 and 65535' },
        { status: 400 }
      );
    }

    // Validate authentication based on auth_type
    const authType = auth_type ?? 'password';
    
    if (authType === 'password') {
      if (!password?.trim()) {
        return NextResponse.json(
          { error: 'Password is required for password authentication' },
          { status: 400 }
        );
      }
    }
    
    if (authType === 'key') {
      if (!ssh_key?.trim()) {
        return NextResponse.json(
          { error: 'SSH key is required for key authentication' },
          { status: 400 }
        );
      }
    }


    const db = getDatabase();
    const result = await db.createServer({ 
      name, 
      ip, 
      user, 
      password, 
      auth_type: authType,
      ssh_key,
      ssh_key_passphrase,
      ssh_port: port,
      color,
      key_generated: key_generated ?? false,
      ssh_key_path
    });
    
    return NextResponse.json(
      { 
        message: 'Server created successfully',
        id: result.id 
      },
      { status: 201 }
    );
  } catch {
    // Error handled by withApiLogging
    // Handle unique constraint violation
    if (Error instanceof Error && Error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'A server with this name already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create server' },
      { status: 500 }
    );
  }
}, { redactBody: true });

