# Better Off Local – Implementation Brief 09
# Deployment and Environment Readiness

## Objective
Prepare Better Off Local for safe multi-environment deployment.

Ensure the system can run across:
- local development
- staging
- production

All services must have clear configuration separation and safe secret handling.

---

## Environment Structure

Define three environments:

### Local
Developer environment.

Uses:
- local configuration
- Supabase development project
- Stripe test mode
- debug logging

---

### Staging
Pre-production testing.

Uses:
- staging Supabase project
- Stripe test mode
- staging domain or subdomain
- realistic seed/demo data

---

### Production
Live environment.

Uses:
- production Supabase project
- Stripe live mode
- production domains
- production logging configuration

---

## Environment Variables

Ensure environment configuration exists for:

### Flutter Mobile App

Required variables:

SUPABASE_URL  
SUPABASE_ANON_KEY  
API_BASE_URL  
STRIPE_PUBLISHABLE_KEY  
ENVIRONMENT  

---

### Retailer Portal

Required variables:

NEXT_PUBLIC_SUPABASE_URL  
NEXT_PUBLIC_SUPABASE_ANON_KEY  
NEXT_PUBLIC_ENVIRONMENT  

Server-only variables:

SUPABASE_SERVICE_ROLE_KEY  
STRIPE_SECRET_KEY  

---

### Admin Portal

Required variables:

NEXT_PUBLIC_SUPABASE_URL  
NEXT_PUBLIC_SUPABASE_ANON_KEY  
NEXT_PUBLIC_ENVIRONMENT  

Server-only variables:

SUPABASE_SERVICE_ROLE_KEY  

---

## Secrets Handling

Rules:

- never commit secrets to git
- use `.env.local` for development
- use hosting provider environment variables for staging/production
- restrict service role keys to server-only contexts

---

## Supabase Environment Setup

Ensure separate Supabase projects exist for:

- development
- staging
- production

Each environment must have:

- migrations applied
- RLS policies active
- seed data for non-production environments

---

## Stripe Setup

Configure:

### Test Mode
Used for:
- local
- staging

### Live Mode
Used only in production.

Stripe resources required:

- consumer subscription product (£2.99/month)
- retailer subscription product (£79.99/year)

Ensure webhook endpoints exist for:

invoice.paid  
invoice.payment_failed  
customer.subscription.deleted  

---

## Deployment Targets

Recommended targets:

### Mobile App
- Flutter build pipelines
- TestFlight (iOS)
- internal testing (Android)

---

### Retailer Portal
Deploy to hosting platform such as:

- Vercel
- Cloudflare
- similar

Must support environment variables.

---

### Admin Portal
Deploy similarly to retailer portal.

---

## Build Scripts

Ensure build scripts exist for:

- mobile build (debug/release)
- web builds
- environment switching
- migration deployment

---

## Logging

Ensure logging behaves differently per environment.

### Development
Verbose logging allowed.

### Staging
Moderate logging.

### Production
Structured logging with minimal sensitive data.

---

## QA Environment Test

Verify in staging:

- sign up flow
- login flow
- membership purchase
- offer discovery
- redemption
- retailer offer creation
- admin approvals

---

## Constraints

- do not introduce new product features
- focus only on deployment readiness
- maintain environment safety
- avoid leaking secrets

---

## Acceptance Criteria

- environments clearly defined
- secrets not committed to repo
- staging environment testable
- Stripe webhooks working in test mode
- deployments reproducible
