import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * send-push-notification
 *
 * Sends an FCM push notification to all active devices for a given consumer.
 *
 * Authorization: service-role key only (Bearer <SUPABASE_SERVICE_ROLE_KEY>).
 *
 * Request body (JSON):
 *   consumer_id : string   — profile UUID
 *   title       : string
 *   body        : string
 *   data?       : Record<string, string>  — extra payload forwarded to the app
 *
 * Response body (JSON):
 *   { sent: number, failed: number }
 *
 * Env vars required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — full service account JSON as a string
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // ── Auth: service-role only ───────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let consumer_id: string, title: string, body: string;
  let data: Record<string, string> = {};
  try {
    const payload = await req.json();
    consumer_id = payload.consumer_id;
    title = payload.title;
    body = payload.body;
    data = payload.data ?? {};
    if (!consumer_id || !title || !body) throw new Error('missing fields');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── Fetch active FCM tokens ───────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: tokenRows, error: tokensErr } = await supabase
    .from('push_tokens')
    .select('id, token')
    .eq('profile_id', consumer_id)
    .eq('is_active', true);

  if (tokensErr) {
    console.error('[push] failed to fetch tokens', tokensErr.message);
    return new Response(JSON.stringify({ error: 'DB error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!tokenRows || tokenRows.length === 0) {
    return new Response(JSON.stringify({ sent: 0, failed: 0 }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── Get OAuth2 access token from Firebase service account ────────────────
  let fcmAccessToken: string;
  try {
    fcmAccessToken = await getFcmAccessToken();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[push] failed to get FCM access token', msg);
    return new Response(JSON.stringify({ error: 'FCM auth failed' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')!);
  const projectId: string = serviceAccount.project_id;
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  // ── Send to each token ────────────────────────────────────────────────────
  let sent = 0;
  let failed = 0;
  const staleTokenIds: string[] = [];

  await Promise.all(
    tokenRows.map(async (row) => {
      try {
        const resp = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${fcmAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: row.token,
              notification: { title, body },
              data,
            },
          }),
        });

        if (resp.ok) {
          sent++;
        } else {
          const errBody = await resp.json().catch(() => ({}));
          const errCode: string = errBody?.error?.details?.[0]?.errorCode ?? '';
          if (
            errCode === 'UNREGISTERED' ||
            errCode === 'INVALID_ARGUMENT'
          ) {
            staleTokenIds.push(row.id);
          }
          failed++;
          console.warn('[push] FCM error', { token: row.id, status: resp.status, errCode });
        }
      } catch (sendErr) {
        failed++;
        const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        console.error('[push] send error', { token: row.id, error: msg });
      }
    }),
  );

  // Deactivate stale tokens.
  if (staleTokenIds.length > 0) {
    await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .in('id', staleTokenIds);
  }

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});

// ── FCM OAuth2 helper ─────────────────────────────────────────────────────────

async function getFcmAccessToken(): Promise<string> {
  const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')!);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const headerB64 = encode(header);
  const claimB64 = encode(claimSet);
  const signingInput = `${headerB64}.${claimB64}`;

  // Import the RSA private key.
  const pemKey = serviceAccount.private_key as string;
  const pemBody = pemKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${signingInput}.${signatureB64}`;

  // Exchange JWT for access token.
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    throw new Error(`OAuth2 token exchange failed: ${errText}`);
  }

  const tokenData = await tokenResp.json();
  return tokenData.access_token as string;
}
