# Better Off Local – Universal JavaScript Widget

## Overview

The Better Off Local widget is a self-contained JavaScript snippet that any retailer can
install on their website to offer member-only benefits at checkout. It handles the full
verification session lifecycle: creating the session, displaying the QR code, polling for
consumer approval, and notifying the host page when a member is verified.

The widget is platform-agnostic. It works on WooCommerce, Shopify, Wix, Webflow,
Squarespace, or any custom site. Platform connectors (WooCommerce plugin, Shopify app,
etc.) use the widget's output to apply the actual benefit.

---

## Installation

```html
<script
  src="https://cdn.betterofflocal.co.uk/widget.js"
  data-retailer-id="<retailer-uuid>"
  data-offer-id="<offer-uuid>"        <!-- optional -->
  data-theme="light"                  <!-- light | dark, default: light -->
  data-locale="en-GB">                <!-- default: en-GB -->
</script>
```

The script is loaded asynchronously. It injects a mount point into the DOM when ready.

---

## Widget Behaviour

### On load
1. Widget reads `data-retailer-id` and optional `data-offer-id` from the script tag
2. Calls `POST /functions/v1/create-verification-session` with retailer and offer context
3. Receives a `session_token` and `expires_at`
4. Renders the verification UI into a host element

### Verification UI states

| State | Display |
|---|---|
| `loading` | Spinner while session is being created |
| `ready` | QR code + countdown timer + instruction text |
| `approved` | Confirmation message — "Member benefit applied" |
| `rejected` | Message — "Membership could not be verified" |
| `expired` | Message + "Refresh" button to create a new session |

### QR code
The QR encodes the raw session token. The consumer scans this with the BOL app.
The widget never displays a discount code. The QR is the only interactive element.

### Polling
Once the session is created and QR is displayed, the widget polls:

```
GET /functions/v1/poll-verification-session?token=<raw_token>
```

Interval: every 2 seconds while status is `pending`.
Stops polling on `approved`, `rejected`, or `expired`.

The poll endpoint returns only `{ status }` — no membership data, no consumer details.

### Countdown
The widget displays a live countdown to `expires_at`. When it reaches zero:
- Status is set to `expired` locally
- Polling stops
- A "Refresh" button is shown
- Clicking refresh calls `create-verification-session` again and resets the flow

---

## JavaScript Events

The widget fires DOM events on the `<script>` element so platform connectors and custom
integrations can respond:

| Event | When fired | Detail payload |
|---|---|---|
| `bolSessionCreated` | Session created | `{ sessionId, expiresAt }` |
| `bolSessionApproved` | Consumer verified | `{ sessionId, retailerId, offerId? }` |
| `bolSessionRejected` | Membership invalid | `{ sessionId, reason }` |
| `bolSessionExpired` | TTL elapsed | `{ sessionId }` |

### Listening example

```javascript
document.querySelector('script[data-retailer-id]')
  .addEventListener('bolSessionApproved', (e) => {
    // The member benefit is confirmed. Apply discount via your platform connector.
    console.log('BOL session approved:', e.detail.sessionId);
  });
```

Platform connectors (WooCommerce plugin, Shopify app) listen for `bolSessionApproved`
to trigger their server-side benefit application. Custom integrations can do the same.

---

## Security Properties

- The widget communicates with the BOL backend only. No third-party requests.
- The session token is stored in widget memory only. It is never written to
  `localStorage`, `sessionStorage`, or cookies.
- The raw token is never sent to the host page. Events carry only the session ID (UUID).
- The poll endpoint does not require authentication and returns no personal data.
- The widget has no knowledge of what the discount actually is. Benefit definition lives
  in the platform connector configuration, not in the widget.

---

## Appearance and Customisation

The widget renders inside a shadow DOM to prevent host page styles from leaking in.
It respects `data-theme` for light/dark mode.

The widget should match the Better Off Local brand:
- Clean, minimal, premium feel
- No coupon or voucher aesthetic
- Clear, concise instruction text
- Prominent QR code with adequate size for mobile cameras

No additional visual customisation is exposed in v1. Retailer branding (logo, name) may
be added in a future version by fetching retailer profile data on widget init.

---

## Hosting and Distribution

The widget JS is hosted at:

```
https://cdn.betterofflocal.co.uk/widget.js
```

Versioning strategy:
- The unversioned URL always serves the latest stable release
- Versioned URLs are available for retailers who need pinned versions:
  `https://cdn.betterofflocal.co.uk/widget@1.0.0.js`

The widget is built as a single self-contained ES module bundle. It has no external
runtime dependencies.

---

## CORS and API Access

The `create-verification-session` and `poll-verification-session` edge functions must
allow cross-origin requests from any origin, since they are called from retailer websites
that are not on the BOL domain.

The `approve-verification-session` function is called from the mobile app using the
consumer's JWT. It does not need permissive CORS.

---

## Widget Placement Guidance

For retailers, the recommended placement is:
- On the cart page, near the order summary
- On the checkout page, before the payment step

The widget should be visible before the consumer commits to payment so they can verify
membership before checkout completes.

---

## Build and Deployment

The widget source lives at:

```
packages/widget/
  src/
    index.ts        — entry point, reads dataset attributes, bootstraps
    session.ts      — session API calls
    ui.ts           — shadow DOM rendering, state machine
    events.ts       — DOM event dispatch
    poll.ts         — polling loop with backoff
  dist/
    widget.js       — built bundle (CDN target)
  package.json
  tsconfig.json
  build.config.ts   — esbuild or Rollup config
```

The widget is excluded from the main Turborepo pipeline and has its own build step
targeting a single output file optimised for browser delivery.

---

## Future Enhancements

- Retailer logo in widget header (fetched from BOL backend)
- Offer-specific messaging ("Unlock: 10% off all hot drinks")
- Analytics: widget impression tracking (non-PII, fire-and-forget)
- Progressive disclosure: collapse to a small banner when not on cart/checkout pages
- Shopify Checkout Extensions: native integration without the script tag approach
