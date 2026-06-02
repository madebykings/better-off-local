import { NextRequest, NextResponse } from 'next/server';
import { handleMailgunWebhook } from '@/lib/actions/crm';

/**
 * Mailgun webhook endpoint for delivery tracking (opens, clicks, bounces).
 * Configure in Mailgun dashboard → Webhooks → point to:
 *   https://admin.betterofflocal.com/api/crm/mailgun-webhook
 *
 * Mailgun sends HMAC-SHA256 signed requests. For now we accept all valid JSON;
 * add signature verification using MAILGUN_WEBHOOK_SIGNING_KEY if needed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = body['event-data'];
    if (!event) return NextResponse.json({ ok: false }, { status: 400 });

    const eventType: string = event.event ?? '';
    const messageId: string = event.message?.headers?.['message-id'] ?? '';
    const timestamp: number = event.timestamp ?? 0;

    if (eventType && messageId) {
      await handleMailgunWebhook(eventType, messageId, timestamp);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mailgun-webhook] error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
