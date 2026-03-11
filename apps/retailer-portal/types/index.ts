// Retailer-portal-specific TypeScript types.
// Shared types live in packages/types.

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
