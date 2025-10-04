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
    const { name, ip, user, password, ssh_key, auth_method }: CreateServerData = body;

    // Validate required fields
    if (!name || !ip || !user) {
      return NextResponse.json(
        { error: 'Missing required fields: name, ip, and user are required' },
        { status: 400 }
      );
    }

    // Validate authentication method and credentials
    const authMethodValue = auth_method ?? 'password';
    if (authMethodValue === 'password' && !password) {
      return NextResponse.json(
        { error: 'Password is required for password authentication' },
        { status: 400 }
      );
    }
    if (authMethodValue === 'ssh_key' && !ssh_key) {
      return NextResponse.json(
        { error: 'SSH key is required for key authentication' },
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

    const result = db.updateServer(id, { name, ip, user, password, ssh_key, auth_method: authMethodValue });
    
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

