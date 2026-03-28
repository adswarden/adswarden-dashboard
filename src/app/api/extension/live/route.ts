import { NextRequest } from 'next/server';
import {
  createRedisClient,
  publishConnectionCount,
  REALTIME_CHANNEL,
  REALTIME_COUNT_KEY,
} from '@/lib/redis';
import { checkLiveRateLimit } from '@/lib/rate-limit';
import { buildExtensionLiveInit, buildCampaignUpdateForExtension } from '@/lib/extension-live-init';
import { resolveEndUserFromRequest } from '@/lib/enduser-auth';
import type { EndUserRow } from '@/db/schema';

export const maxDuration = 300;

const encoder = new TextEncoder();

function sseEvent(name: string, data: string): Uint8Array {
  return encoder.encode(`event: ${name}\ndata: ${data}\n\n`);
}

function endUserEligibleForExtensionPayload(user: EndUserRow): boolean {
  if (user.status !== 'active') return false;
  const now = new Date();
  if (user.plan === 'trial' && user.endDate && now > new Date(user.endDate)) {
    return false;
  }
  return true;
}

/**
 * GET /api/extension/live
 * SSE: connection_count, init (domains + campaigns when authenticated), notification, domains, update.
 * Optional Bearer token — without a valid eligible user, init includes domains only.
 */
export async function GET(request: NextRequest) {
  const rateLimitRes = await checkLiveRateLimit(request);
  if (rateLimitRes) return rateLimitRes;

  const resolved = await resolveEndUserFromRequest(request);
  const endUserForInit =
    resolved?.endUser && endUserEligibleForExtensionPayload(resolved.endUser)
      ? resolved.endUser
      : null;

  const initPayload = await buildExtensionLiveInit(endUserForInit);

  const stream = new ReadableStream({
    async start(controller) {
      const client = await createRedisClient();
      if (!client) {
        controller.enqueue(sseEvent('connection_count', '0'));
        controller.close();
        return;
      }

      let subscriber: Awaited<ReturnType<typeof client.duplicate>> | null = null;

      const cleanup = async () => {
        try {
          if (subscriber) {
            await subscriber.unsubscribe(REALTIME_CHANNEL);
            await subscriber.destroy();
          }
          const newCount = Math.max(0, await client.decr(REALTIME_COUNT_KEY));
          await publishConnectionCount(newCount);
        } catch {
          // ignore
        } finally {
          try {
            await client.destroy();
          } catch {
            // ignore
          }
          try {
            controller.close();
          } catch {
            // ignore
          }
        }
      };

      try {
        subscriber = client.duplicate();
        subscriber.on('error', () => { });
        await subscriber.connect();

        const count = await client.incr(REALTIME_COUNT_KEY);
        controller.enqueue(sseEvent('connection_count', String(count)));
        await publishConnectionCount(count);

        controller.enqueue(sseEvent('init', JSON.stringify(initPayload)));

        await subscriber.subscribe(REALTIME_CHANNEL, (message: string) => {
          void (async () => {
            try {
              let parsed: { type?: string; campaignId?: string } = {};
              try {
                parsed = JSON.parse(message) as { type?: string; campaignId?: string };
              } catch {
                // legacy non-JSON payloads: fall through to notification
              }

              if (parsed?.type === 'platforms_updated') {
                controller.enqueue(sseEvent('domains', message));
                return;
              }

              if (parsed?.type === 'campaign_updated' && typeof parsed.campaignId === 'string') {
                const updatePayload = await buildCampaignUpdateForExtension(parsed.campaignId);
                controller.enqueue(sseEvent('update', JSON.stringify(updatePayload)));
                return;
              }

              controller.enqueue(sseEvent('notification', message));
            } catch {
              // stream may be closed
            }
          })();
        });

        await new Promise<void>((resolve) => {
          request.signal?.addEventListener('abort', () => resolve());
        });
      } catch {
        // connection/subscribe error
      } finally {
        await cleanup();
      }
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
