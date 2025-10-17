import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../../server/database-prisma';
import { getSSHService } from '../../../../../server/ssh-service';
import type { Server } from '../../../../../types/server';

export async function POST(
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
    const server = await db.getServerById(id) as Server;
    
    if (!server) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      );
    }

    // Test SSH connection
    const sshService = getSSHService();
    const connectionResult = await sshService.testConnection(server);
    
    return NextResponse.json(connectionResult);
  } catch (error) {
    console.error('Error testing SSH connection:', error);
    return NextResponse.json(
      { error: 'Failed to test SSH connection' },
      { status: 500 }
    );
  }
}

