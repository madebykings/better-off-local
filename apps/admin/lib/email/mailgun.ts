/**
 * Mailgun email sending utility.
 * Uses the v3 REST API directly via fetch — no external SDK required.
 *
 * Required environment variables:
 *   MAILGUN_API_KEY    – Private API key (starts with "key-...")
 *   MAILGUN_DOMAIN     – Sending domain (e.g. "mg.betterofflocal.com")
 *   MAILGUN_FROM_EMAIL – Default from address (e.g. "team@betterofflocal.com")
 */

export interface MailgunSendOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string;
  tags?: string[];
  /** Opaque reference stored in the message vars for webhook correlation. */
  referenceId?: string;
}

export interface MailgunSendResult {
  id: string;   // Mailgun message ID (<...@mg.domain>)
  message: string;
}

const BASE_URL = 'https://api.mailgun.net/v3';

function getConfig() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const fromEmail = process.env.MAILGUN_FROM_EMAIL ?? 'team@betterofflocal.com';
  if (!apiKey || !domain) {
    throw new Error('MAILGUN_API_KEY and MAILGUN_DOMAIN must be set.');
  }
  return { apiKey, domain, fromEmail };
}

export async function sendEmail(opts: MailgunSendOptions): Promise<MailgunSendResult> {
  const { apiKey, domain, fromEmail } = getConfig();
  const from = opts.fromName ? `${opts.fromName} <${fromEmail}>` : fromEmail;

  const body = new URLSearchParams({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });

  if (opts.replyTo) body.append('h:Reply-To', opts.replyTo);
  if (opts.tags) opts.tags.forEach((t) => body.append('o:tag', t));
  if (opts.referenceId) {
    body.append('v:reference_id', opts.referenceId);
  }

  // Enable open + click tracking.
  body.append('o:tracking-opens', 'yes');
  body.append('o:tracking-clicks', 'yes');

  const response = await fetch(`${BASE_URL}/${domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mailgun error ${response.status}: ${text}`);
  }

  return response.json() as Promise<MailgunSendResult>;
}

/**
 * Apply simple {{variable}} substitutions to an email template body.
 * Variables not found in the map are left as-is.
 */
export function applyTemplateVars(
  text: string,
  vars: Record<string, string>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
