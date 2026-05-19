# Better Off Local – WooCommerce Connector

## Overview

The WooCommerce connector is a WordPress plugin that integrates Better Off Local
membership verification into WooCommerce checkouts. It installs the BOL widget, listens
for session approval (via JavaScript event and/or server-side webhook), and applies the
member benefit as a cart discount — entirely server-side, with no discount code visible
to the consumer.

---

## What the Connector Does

1. Installs the BOL widget on WooCommerce cart and checkout pages
2. Listens for `bolSessionApproved` JavaScript event on the client side
3. Stores the approved session ID in the WooCommerce session
4. On checkout submission, verifies the stored session ID via a server-side call to the
   BOL backend
5. Applies the benefit using WooCommerce's fee/discount hooks
6. Records the approval in WooCommerce order metadata

The consumer never sees a coupon code field. The discount appears as a named line item
on the order summary (e.g. "Better Off Local member discount — 10% off").

---

## Plugin Architecture

```
better-off-local-woocommerce/
  better-off-local.php          — plugin bootstrap, hooks registration
  includes/
    class-bol-widget.php        — enqueue widget JS with retailer/offer data attributes
    class-bol-session.php       — WP session / transient storage for approved session ID
    class-bol-cart-discount.php — WooCommerce cart/order discount application
    class-bol-webhook.php       — receives server-side approval webhook from BOL backend
    class-bol-api.php           — PHP client for BOL verification API
    class-bol-admin.php         — WordPress admin settings page
  assets/
    js/
      checkout.js               — JS glue: listens for bolSessionApproved, stores session
  languages/
    better-off-local.pot
  readme.txt
```

---

## Configuration (WordPress Admin)

The plugin adds a settings page under WooCommerce > Settings > Better Off Local:

| Setting | Description |
|---|---|
| Retailer ID | The UUID of this retailer in the BOL platform |
| API Key / Shared Secret | Used to verify inbound webhooks from BOL |
| Offer ID | Optional — restrict widget to a specific offer |
| Benefit Type | `percentage_discount` / `fixed_discount` / `free_shipping` |
| Benefit Value | Numeric value for the benefit (e.g. `10` for 10%) |
| Discount Label | Label shown on checkout (e.g. "Better Off Local member discount") |

The benefit definition lives in the connector, not in the widget or the BOL backend.
The BOL backend only confirms membership — the connector decides what that means
commercially for this retailer.

---

## Widget Installation

The connector enqueues `widget.js` on cart and checkout pages:

```php
// class-bol-widget.php
wp_enqueue_script(
    'bol-widget',
    'https://cdn.betterofflocal.co.uk/widget.js',
    [],
    null,
    true
);
wp_script_add_data('bol-widget', 'data-retailer-id', $this->retailer_id);
wp_script_add_data('bol-widget', 'data-offer-id', $this->offer_id); // optional
```

---

## Client-Side Session Capture

`checkout.js` is enqueued after the widget. It listens for `bolSessionApproved` and
stores the session ID in the WooCommerce session via an AJAX call:

```javascript
// assets/js/checkout.js
document.querySelector('script[data-retailer-id]')
  .addEventListener('bolSessionApproved', async (e) => {
    await fetch('/wp-admin/admin-ajax.php', {
      method: 'POST',
      body: new URLSearchParams({
        action: 'bol_store_session',
        session_id: e.detail.sessionId,
        nonce: bolCheckout.nonce,   // localised from PHP
      }),
    });
    // Trigger WooCommerce cart refresh to show discount line item
    jQuery(document.body).trigger('wc_update_cart');
  });
```

The PHP handler stores the `session_id` in `WC()->session->set('bol_session_id', ...)`.

---

## Cart Discount Application

The connector hooks into `woocommerce_cart_calculate_fees` to apply the discount when
a valid session ID is present in the WooCommerce session:

```php
// class-bol-cart-discount.php
add_action('woocommerce_cart_calculate_fees', [$this, 'apply_member_discount']);

public function apply_member_discount($cart) {
    $session_id = WC()->session->get('bol_session_id');
    if (!$session_id) return;

    // Server-side verify the session is still approved and belongs to this retailer
    $verified = $this->api->verify_session($session_id);
    if (!$verified) {
        WC()->session->__unset('bol_session_id');
        return;
    }

    $discount = $this->calculate_discount($cart->get_subtotal());
    $cart->add_fee($this->discount_label, -$discount, true);
}
```

The `verify_session` API call confirms:
- Session exists in BOL backend
- Session status is `approved`
- Session `retailer_id` matches this connector's configured retailer ID

This is the server-side gate. The JavaScript event alone is never trusted.

---

## Server-Side Webhook (Alternative / Supplementary Path)

The BOL backend sends a webhook when a session is approved
(see `docs/architecture/online-redemption.md` — Platform Connector Webhook section).

The connector registers a webhook endpoint:

```
POST /wp-json/bol/v1/session-approved
```

The plugin validates the `Authorization: Bearer <shared_secret>` header before
processing. On a valid webhook:
- Stores session approval in a short-lived transient (`bol_approved_<session_id>`)
- The cart discount hook checks this transient as an alternative to the WC session

The webhook supplements the JS event path. If the JS event is missed (e.g. the page
reloaded), the transient ensures the discount can still be applied on cart recalculation.

---

## Order Metadata

On successful order placement, the connector writes to order meta:

```php
add_action('woocommerce_checkout_order_created', [$this, 'save_order_meta']);

public function save_order_meta($order) {
    $session_id = WC()->session->get('bol_session_id');
    if ($session_id) {
        $order->update_meta_data('_bol_session_id', $session_id);
        $order->update_meta_data('_bol_retailer_id', $this->retailer_id);
        $order->save();
        WC()->session->__unset('bol_session_id');
    }
}
```

This allows admins to see which orders had BOL member discounts applied and correlate
with BOL's own redemption records.

---

## Security Model

| Concern | Mitigation |
|---|---|
| Client-side session spoofing | JS event only triggers UI update; server re-verifies session via BOL API before applying discount |
| Replay attacks | Sessions are single-use; BOL backend enforces `status = 'approved'` transition once only |
| Webhook spoofing | Shared secret header verified before processing |
| Discount without verification | `apply_member_discount` always calls `verify_session` before adding fee |
| Session not from this retailer | `verify_session` checks `retailer_id` matches |

---

## Testing

The connector should be tested in Stripe test mode with:
- A test consumer membership in the BOL staging environment
- The staging widget URL pointing to staging BOL backend
- Test WooCommerce order placement

A `WP_BOL_ENVIRONMENT` constant can switch the plugin between staging and production
BOL API endpoints.

---

## Minimum Requirements

- WordPress 6.0+
- WooCommerce 8.0+
- PHP 8.1+
- HTTPS on the site (required for camera QR scan in the browser)

---

## Distribution

The plugin will be distributed:
- As a ZIP download from the BOL retailer portal (billing page or onboarding flow)
- Eventually via the WordPress.org plugin directory if volume justifies it

---

## Future

- Shopify app — native Shopify integration using the same verification session API
- Webflow / Squarespace — widget-only (no server-side connector available; benefit must
  be applied manually or via a third-party automation)
- Automatic benefit configuration — BOL backend tells the connector what the benefit is
  based on the approved offer, removing the need for manual connector configuration
