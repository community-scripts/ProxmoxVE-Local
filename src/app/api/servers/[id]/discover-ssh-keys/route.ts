import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../../server/database-prisma';
import { getSSHExecutionService } from '../../../../../server/ssh-execution-service';
import type { Server } from '~/types/server';

const DISCOVER_TIMEOUT_MS = 10_000;

/** Match lines that look like SSH public keys (same as build.func) */
const SSH_PUBKEY_RE = /^(ssh-(rsa|ed25519)|ecdsa-sha2-nistp256|sk-(ssh-ed25519|ecdsa-sha2-nistp256))\s+/;

/**
 * Run a command on the Proxmox host and return buffered stdout.
 * Resolves when the process exits or rejects on timeout/spawn error.
 */
function runRemoteCommand(
  server: Server,
  command: string,
  timeoutMs: number
): Promise<{ stdout: string; exitCode: number }> {
  const ssh = getSSHExecutionService();
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    let settled = false;

    const finish = (stdout: string, exitCode: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, exitCode });
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('SSH discover keys timeout'));
    }, timeoutMs);

    ssh
      .executeCommand(
        server,
        command,
        (data: string) => chunks.push(data),
        () => {},
        (code: number) => finish(chunks.join(''), code)
      )
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid server ID' }, { status: 400 });
    }

    const db = getDatabase();
    const server = await db.getServerById(id) as Server | null;

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    // Same paths as native build.func ssh_discover_default_files()
    const remoteScript = `bash -c 'for f in /root/.ssh/authorized_keys /root/.ssh/authorized_keys2 /root/.ssh/*.pub /etc/ssh/authorized_keys /etc/ssh/authorized_keys.d/* 2>/dev/null; do [ -f "$f" ] && [ -r "$f" ] && grep -E "^(ssh-(rsa|ed25519)|ecdsa-sha2-nistp256|sk-)" "$f" 2>/dev/null; done | sort -u'`;

    const { stdout } = await runRemoteCommand(server, remoteScript, DISCOVER_TIMEOUT_MS);

    const keys = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && SSH_PUBKEY_RE.test(line));

    return NextResponse.json({ keys });
  } catch (error) {
    console.error('Error discovering SSH keys:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
