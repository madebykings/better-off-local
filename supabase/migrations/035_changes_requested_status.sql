-- Migration 035: Add changes_requested approval status and submitted_at column
--
-- Changes:
--   1. Extends the approval_status check constraint on retailers to include
--      'changes_requested'. This is set by admins when they want the retailer
--      to make edits before re-reviewing, without fully rejecting them.
--
--   2. Adds submitted_at timestamptz. Set when onboarding_step transitions to
--      'submitted' (both initial submission and resubmissions). Used to order
--      the admin review queue by submission time.

-- ── 1. Extend approval_status check constraint ────────────────────────────────

ALTER TABLE retailers
  DROP CONSTRAINT IF EXISTS retailers_approval_status_check;

ALTER TABLE retailers
  ADD CONSTRAINT retailers_approval_status_check
  CHECK (approval_status IN (
    'pending',
    'approved',
    'rejected',
    'suspended',
    'changes_requested'
  ));

-- ── 2. Add submitted_at column ────────────────────────────────────────────────

ALTER TABLE retailers
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

-- Back-fill submitted_at for retailers that have already submitted.
-- Uses updated_at as a proxy for the submission timestamp since we
-- don't have a more precise value for historical rows.
UPDATE retailers
SET submitted_at = updated_at
WHERE onboarding_step = 'submitted'
  AND submitted_at IS NULL;
