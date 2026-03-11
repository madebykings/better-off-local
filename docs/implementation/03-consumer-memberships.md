# Better Off Local – Implementation Brief 03
# Consumer Memberships

## Objective

Implement the consumer subscription system.

Consumers must have an active membership to redeem offers.

---

# Billing Provider

Stripe

---

# Plans

Monthly  
Annual

---

# Table

consumer_memberships

Fields:

id  
profile_id  
stripe_customer_id  
stripe_subscription_id  
plan_interval  
status  
current_period_start  
current_period_end  
cancel_at_period_end  
created_at  
updated_at  

---

# Status Values

inactive  
trialing  
active  
past_due  
cancelled  
expired  

---

# Membership Logic

User can redeem offers only if:

status = active OR trialing

AND

current date < current_period_end

---

# Flutter Features

Screens:

paywall_screen  
subscription_success_screen  
membership_card_screen  

Membership card must display:

- name
- membership status
- renewal date
- QR placeholder

---

# Stripe Integration

Stripe webhooks must update membership state.

Required events:

invoice.paid  
invoice.payment_failed  
customer.subscription.deleted  

---

# Backend Logic

Stripe webhook → update membership record.

Do NOT rely on mobile app for entitlement.

---

# Deliverables

Supabase:

consumer_memberships table

Flutter:

paywall
membership card UI

Backend:

Stripe webhook handler

---

# Acceptance Criteria

User can:

- subscribe
- see membership status
- access membership card

Membership status must persist server-side.
