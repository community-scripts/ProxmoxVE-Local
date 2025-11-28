import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSSHService } from '../../../../server/ssh-service';
import { getDatabase } from '../../../../server/database-prisma';
import { withApiLogging } from '../../../../server/logging/withApiLogging';

export const POST = withApiLogging(async function POST(_request: NextRequest) {
  try {
    const sshService = getSSHService();
    const db = getDatabase();
    
    // Get the next available server ID for key file naming
    const serverId = await db.getNextServerId();
    
    const keyPair = await sshService.generateKeyPair(Number(serverId));
    
    return NextResponse.json({
      success: true,
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      serverId: serverId
    });
  } catch (error) {
    // Error handled by withApiLogging
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate SSH key pair'
      },
      { status: 500 }
    );
  }
}, { redactBody: true });
