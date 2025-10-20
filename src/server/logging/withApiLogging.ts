import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import logger from './logger';
import { redactObject, summarizeBody } from './redact';
import { toSafeError } from './prismaSafeError';

type Handler = (request: NextRequest, context?: any) => Promise<Response> | Response;

export function withApiLogging(
  handler: Handler,
  opts?: { redactBody?: boolean }
) {
  const { redactBody = false } = opts ?? {};

  return async function wrapped(request: NextRequest, context?: any) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;
    const queryKeys = Array.from(url.searchParams.keys());

    try {
      let meta: Record<string, unknown> = { method, path, queryKeys };
      if (method !== 'GET' && method !== 'HEAD') {
        try {
          const body = await request.clone().json();
          meta = {
            ...meta,
            body: redactBody ? undefined : redactObject(body),
            bodySummary: redactBody ? summarizeBody(body) : undefined
          };
        } catch {
          // Ignore non-JSON bodies
        }
      }
      logger.info('api_request', meta);

      const response = await handler(request, context);
      logger.info('api_response', { method, path, status: response.status });
      return response;
    } catch (err) {
      const safe = toSafeError(err);
      logger.error('api_error', { method, path, code: safe.code, name: safe.name }, err);
      return NextResponse.json({ error: safe.safeMessage }, { status: 500 });
    }
  };
}


