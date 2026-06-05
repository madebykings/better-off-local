export type PartnerType =
  | 'business'
  | 'club'
  | 'charity'
  | 'community_group'
  | 'organisation';

export interface PartnerTerms {
  entity: string;
  entities: string;
  customer: string;
  customers: string;
  offer: string;
  offers: string;
  descriptionLabel: string;
  healthLabel: string;
}

const TERMS: Record<PartnerType, PartnerTerms> = {
  business: {
    entity: 'Business',
    entities: 'Businesses',
    customer: 'Customer',
    customers: 'Customers',
    offer: 'Offer',
    offers: 'Offers',
    descriptionLabel: 'Business description',
    healthLabel: 'Business Health Score',
  },
  club: {
    entity: 'Club',
    entities: 'Clubs',
    customer: 'Member',
    customers: 'Members',
    offer: 'Perk',
    offers: 'Perks',
    descriptionLabel: 'About your club',
    healthLabel: 'Club Profile Score',
  },
  charity: {
    entity: 'Organisation',
    entities: 'Organisations',
    customer: 'Supporter',
    customers: 'Supporters',
    offer: 'Campaign',
    offers: 'Campaigns',
    descriptionLabel: 'Our mission',
    healthLabel: 'Profile Score',
  },
  community_group: {
    entity: 'Organisation',
    entities: 'Organisations',
    customer: 'Supporter',
    customers: 'Supporters',
    offer: 'Activity',
    offers: 'Activities',
    descriptionLabel: 'About us',
    healthLabel: 'Profile Score',
  },
  organisation: {
    entity: 'Organisation',
    entities: 'Organisations',
    customer: 'Member',
    customers: 'Members',
    offer: 'Activity',
    offers: 'Activities',
    descriptionLabel: 'About us',
    healthLabel: 'Profile Score',
  },
};

export function getPartnerTerms(partnerType: string | null | undefined): PartnerTerms {
  return TERMS[(partnerType as PartnerType)] ?? TERMS.business;
}

export const PARTNER_TYPE_OPTIONS = [
  { value: 'business',        label: 'Local business' },
  { value: 'club',            label: 'Sports club' },
  { value: 'charity',         label: 'Charity' },
  { value: 'community_group', label: 'Community group' },
  { value: 'organisation',    label: 'Other organisation' },
] as const;

export const PARTNER_TYPE_LABELS: Record<string, string> = {
  business:         'Business',
  club:             'Club',
  charity:          'Charity',
  community_group:  'Community Group',
  organisation:     'Organisation',
};
