// Admin-portal-specific TypeScript types.
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

export interface AdminUser {
  id: string;
  email: string;
}
