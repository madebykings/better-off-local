// Shared TypeScript types used across retailer-portal and admin.
// Keep in sync with the Supabase schema.
// Do not let types drift from canonical backend definitions.

// ── Enums ────────────────────────────────────────────────────────────────────

export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'none';

export type OfferStatus = 'pending' | 'active' | 'paused' | 'rejected' | 'expired' | 'archived';

export type RetailerStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export type RedemptionOutcome = 'success' | 'failed' | 'expired';

// ── Core entities ─────────────────────────────────────────────────────────────

export interface Retailer {
  id: string;
  name: string;
  slug: string;
  status: RetailerStatus;
  categoryId: string;
  logoUrl: string | null;
  coverUrl: string | null;
  shortDescription: string | null;
  createdAt: string;
}

export interface Offer {
  id: string;
  retailerId: string;
  title: string;
  description: string;
  status: OfferStatus;
  categoryId: string;
  discountDisplay: string;
  expiresAt: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface Membership {
  id: string;
  userId: string;
  status: MembershipStatus;
  expiresAt: string;
  createdAt: string;
}

export interface Redemption {
  id: string;
  offerId: string;
  retailerId: string;
  userId: string;
  outcome: RedemptionOutcome;
  savingsAmount: number | null;
  redeemedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
}
