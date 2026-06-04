import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

/**
 * Venue referral share-link landing page.
 *
 * Receives a GET request containing ?t=TOKEN (the 8-char share token) and
 * serves an HTML page that:
 *   1. Auto-attempts to open the consumer app via custom URI scheme
 *      betterofflocal://venue-referral?t=TOKEN
 *   2. Falls back to App Store / Play Store download links for users who
 *      do not yet have the app
 *
 * Deployment note:
 *   This function is deployed at
 *     https://<project>.supabase.co/functions/v1/venue-referral
 *   betterofflocal.com/venue-referral should proxy or redirect to this URL.
 *
 * Required env vars: none (public, no auth).
 *
 * Request: GET /venue-referral?t=TOKEN[&ref=PLATFORM_CODE]
 * Response: 200 text/html
 */

const APP_STORE_URL =
  'https://apps.apple.com/gb/app/better-off-local/id0000000000'; // update before launch
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.betterofflocal.app'; // update before launch

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get('t') ?? '').trim().toUpperCase();
  const deepLink = token.length > 0
    ? `betterofflocal://venue-referral?t=${encodeURIComponent(token)}`
    : 'betterofflocal://home';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Better Off Local – Exclusive Offer</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#f4f5f0;color:#1a1a1a;min-height:100vh;
         display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border-radius:16px;padding:40px 32px;
          max-width:420px;width:100%;text-align:center;
          box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .logo{font-size:22px;font-weight:800;color:#1a7a4a;margin-bottom:24px}
    h1{font-size:20px;font-weight:700;margin-bottom:12px;line-height:1.3}
    p{color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:28px}
    .btn-primary{display:block;background:#1a7a4a;color:#fff;text-decoration:none;
                 border-radius:10px;padding:14px 24px;font-size:16px;
                 font-weight:600;margin-bottom:12px}
    .btn-secondary{display:block;border:1.5px solid #d1d5db;color:#374151;
                   text-decoration:none;border-radius:10px;padding:14px 24px;
                   font-size:15px;margin-bottom:12px}
    .divider{color:#9ca3af;font-size:13px;margin:4px 0 16px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Better Off Local</div>
    <h1>Your friend shared an exclusive offer with you</h1>
    <p>Access exclusive discounts at brilliant independent local businesses near you.</p>
    <a id="openApp" class="btn-primary" href="${deepLink}">Open in app</a>
    <div class="divider">Don't have the app yet?</div>
    <a class="btn-secondary" href="${APP_STORE_URL}">Download on the App Store</a>
    <a class="btn-secondary" href="${PLAY_STORE_URL}">Get it on Google Play</a>
  </div>
  <script>
    // Attempt to open the app automatically on page load.
    // Custom URI scheme: if the app is installed the OS hands it off;
    // if not, the browser stays on this page showing the download links.
    ${token.length > 0 ? `setTimeout(function(){window.location.href="${deepLink}"},350);` : ''}
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});
