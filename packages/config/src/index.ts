// Shared constants and environment helpers for web apps.
// Used by retailer-portal and admin.

export const APP_NAME = 'Better Off Local';

export const ROUTES = {
  // Retailer portal
  retailer: {
    dashboard: '/dashboard',
    profile: '/profile',
    locations: '/locations',
    offers: '/offers',
    newOffer: '/offers/new',
    scan: '/scan',
    redemptions: '/redemptions',
    billing: '/billing',
    settings: '/settings',
  },
  // Admin portal
  admin: {
    dashboard: '/dashboard',
    retailers: '/retailers',
    offers: '/offers',
    members: '/members',
    redemptions: '/redemptions',
    categories: '/categories',
    subscriptions: '/subscriptions',
    featured: '/featured',
    audit: '/audit',
    settings: '/settings',
  },
} as const;

export const PAGINATION = {
  defaultPageSize: 25,
  maxPageSize: 100,
} as const;

export const DATE_FORMATS = {
  display: 'dd MMM yyyy',
  displayWithTime: 'dd MMM yyyy HH:mm',
  iso: "yyyy-MM-dd'T'HH:mm:ss'Z'",
} as const;
