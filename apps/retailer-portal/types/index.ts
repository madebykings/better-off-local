// Retailer-portal-specific TypeScript types.
// Shared types live in packages/types.

export type UserRole = 'consumer' | 'retailer_user' | 'admin';

export interface Profile {
  id: string;
  role: UserRole;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
}

export interface RetailerUser {
  id: string;
  email: string;
  retailerId: string;
}

export interface RetailerContext {
  userId: string;
  retailerId: string;
  retailerName: string;
}
