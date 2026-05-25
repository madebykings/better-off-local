// ---------------------------------------------------------------------------
// Link normalisation utilities
//
// These are pure client/server helpers — no 'use server' directive.
// Imported by both server pages and 'use server' action files.
// ---------------------------------------------------------------------------

export const URL_LINK_TYPES = [
  'website',
  'instagram',
  'facebook',
  'tiktok',
  'whatsapp',
] as const;

export type UrlLinkType = (typeof URL_LINK_TYPES)[number];

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function prependHttps(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  return `https://${t}`;
}

function stripSchemeAndWww(raw: string): string {
  return raw.replace(/^(?:https?:\/\/)?(?:www\.)?/, '');
}

// ---------------------------------------------------------------------------
// Normalisation — runs server-side before storage
// ---------------------------------------------------------------------------

export function normaliseWebsite(raw: string): string {
  return prependHttps(raw.trim());
}

export function normaliseInstagram(raw: string): string {
  const handle = stripSchemeAndWww(raw.trim())
    .replace(/^instagram\.com\//, '')
    .replace(/^@/, '')
    .replace(/\/$/, '');
  return `https://instagram.com/${handle}`;
}

export function normaliseFacebook(raw: string): string {
  const page = stripSchemeAndWww(raw.trim())
    .replace(/^facebook\.com\//, '')
    .replace(/^@/, '')
    .replace(/\/$/, '');
  return `https://facebook.com/${page}`;
}

export function normaliseTikTok(raw: string): string {
  const handle = stripSchemeAndWww(raw.trim())
    .replace(/^tiktok\.com\/@?/, '')
    .replace(/^@/, '')
    .replace(/\/$/, '');
  return `https://tiktok.com/@${handle}`;
}

/**
 * Normalises a raw phone number to a wa.me deep-link.
 * UK numbers starting with 0 are converted to the +44 international format.
 * e.g. "07911 123456" → "https://wa.me/447911123456"
 */
export function normaliseWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const e164 = digits.startsWith('0') ? '44' + digits.slice(1) : digits;
  return `https://wa.me/${e164}`;
}

// ---------------------------------------------------------------------------
// Reverse normalisation — used by pages for pre-fill
// ---------------------------------------------------------------------------

export function reverseNormaliseLink(type: UrlLinkType, url: string): string {
  switch (type) {
    case 'website':
      return url; // store and display the full URL
    case 'instagram':
      return '@' + url.replace('https://instagram.com/', '');
    case 'facebook':
      return url.replace('https://facebook.com/', '');
    case 'tiktok':
      return '@' + url.replace('https://tiktok.com/@', '');
    case 'whatsapp': {
      // Reverse: "https://wa.me/447911123456" → "07911123456"
      const digits = url.replace('https://wa.me/', '');
      return digits.startsWith('44') ? '0' + digits.slice(2) : digits;
    }
  }
}
