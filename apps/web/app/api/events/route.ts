import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getDirectClient } from '@airport-pong/db';
import { COOKIE_NAME } from '../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE multiplex.
 *  - airport_pong_events: forwarded to every connected client
 *  - airport_pong_bets: forwarded only when the payload's userId matches
 *    this connection's session cookie
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const sql = getDirectClient();
  const c = await cookies();
  const userId = c.get(COOKIE_NAME)?.value ?? null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      safeEnqueue(`: connected\n\n`);
      const heartbeat = setInterval(() => safeEnqueue(`: hb\n\n`), 25_000);

      const listeners: Array<{ unlisten: () => Promise<void> }> = [];

      try {
        listeners.push(
          await sql.listen('airport_pong_events', (payload: string) => {
            safeEnqueue(`data: ${payload}\n\n`);
          })
        );
        listeners.push(
          await sql.listen('airport_pong_bets', (payload: string) => {
            if (!userId) return;
            try {
              const parsed = JSON.parse(payload) as { userId?: string };
              if (parsed.userId !== userId) return;
            } catch {
              return;
            }
            safeEnqueue(`data: ${payload}\n\n`);
          })
        );
      } catch (err) {
        safeEnqueue(`event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`);
      }

      const cleanup = async () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        for (const l of listeners) {
          try {
            await l.unlisten();
          } catch {}
        }
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener('abort', () => {
        void cleanup();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
