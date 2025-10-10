import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../server/database';
import type { CreateServerData } from '../../../types/server';

export async function GET() {
  try {
    const db = getDatabase();
    const servers = db.getAllServers();
    return NextResponse.json(servers);
  } catch (error) {
    console.error('Error fetching servers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port }: CreateServerData = body;

    // Validate required fields
    if (!name || !ip || !user) {
      return NextResponse.json(
        { error: 'Missing required fields: name, ip, and user are required' },
        { status: 400 }
      );
    }

    // Validate SSH port
    if (ssh_port !== undefined && (ssh_port < 1 || ssh_port > 65535)) {
      return NextResponse.json(
        { error: 'SSH port must be between 1 and 65535' },
        { status: 400 }
      );
    }

    // Validate authentication based on auth_type
    const authType = auth_type || 'password';
    
    if (authType === 'password' || authType === 'both') {
      if (!password?.trim()) {
        return NextResponse.json(
          { error: 'Password is required for password authentication' },
          { status: 400 }
        );
      }
    }
    
    if (authType === 'key' || authType === 'both') {
      if (!ssh_key?.trim()) {
        return NextResponse.json(
          { error: 'SSH key is required for key authentication' },
          { status: 400 }
        );
      }
    }

    // Check if at least one authentication method is provided
    if (authType === 'both') {
      if (!password?.trim() && !ssh_key?.trim()) {
        return NextResponse.json(
          { error: 'At least one authentication method (password or SSH key) is required' },
          { status: 400 }
        );
      }
    }

    const db = getDatabase();
    const result = db.createServer({ 
      name, 
      ip, 
      user, 
      password, 
      auth_type: authType,
      ssh_key,
      ssh_key_passphrase,
      ssh_port: ssh_port || 22
    });
    
    return NextResponse.json(
      { 
        message: 'Server created successfully',
        id: result.lastInsertRowid 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating server:', error);
    
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
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
}

