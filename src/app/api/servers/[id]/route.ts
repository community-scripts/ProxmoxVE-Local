import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../server/database';
import type { CreateServerData } from '../../../../types/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid server ID' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const server = db.getServerById(id);
    
    if (!server) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(server);
  } catch (error) {
    console.error('Error fetching server:', error);
    return NextResponse.json(
      { error: 'Failed to fetch server' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid server ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, ip, user, password, auth_type, ssh_key, ssh_key_passphrase, ssh_port, color }: CreateServerData = body;

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
    const authType = auth_type ?? 'password';
    
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
    
    // Check if server exists
    const existingServer = db.getServerById(id);
    if (!existingServer) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      );
    }

    const result = db.updateServer(id, { 
      name, 
      ip, 
      user, 
      password, 
      auth_type: authType,
      ssh_key,
      ssh_key_passphrase,
      ssh_port: ssh_port ?? 22,
      color
    });
    
    return NextResponse.json(
      { 
        message: 'Server updated successfully',
        changes: result.changes 
      }
    );
  } catch (error) {
    console.error('Error updating server:', error);
    
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'A server with this name already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update server' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid server ID' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // Check if server exists
    const existingServer = db.getServerById(id);
    if (!existingServer) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      );
    }

    // Delete all installed scripts associated with this server
    db.deleteInstalledScriptsByServer(id);

    const result = db.deleteServer(id);
    
    return NextResponse.json(
      { 
        message: 'Server deleted successfully',
        changes: result.changes 
      }
    );
  } catch (error) {
    console.error('Error deleting server:', error);
    return NextResponse.json(
      { error: 'Failed to delete server' },
      { status: 500 }
    );
  }
}

