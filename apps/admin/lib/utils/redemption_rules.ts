// ---------------------------------------------------------------------------
// Redemption rule utilities
//
// Pure helpers — no 'use server' directive.
// Maps between the UI redemption rule enum and the offer_rules DB columns.
// ---------------------------------------------------------------------------

export const REDEMPTION_RULES = [
  'unlimited',
  'once_per_member',
  'once_per_day',
  'once_per_week',
  'once_per_month',
] as const;

export type RedemptionRule = (typeof REDEMPTION_RULES)[number];

export type RuleColumns = {
  max_redemptions_per_user: number | null;
  max_redemptions_per_day: number | null;
  cooldown_hours: number | null;
};

export function ruleToColumns(rule: RedemptionRule): RuleColumns {
  switch (rule) {
    case 'unlimited':
      return { max_redemptions_per_user: null, max_redemptions_per_day: null, cooldown_hours: null };
    case 'once_per_member':
      return { max_redemptions_per_user: 1, max_redemptions_per_day: null, cooldown_hours: null };
    case 'once_per_day':
      return { max_redemptions_per_user: null, max_redemptions_per_day: 1, cooldown_hours: null };
    case 'once_per_week':
      return { max_redemptions_per_user: null, max_redemptions_per_day: null, cooldown_hours: 168 };
    case 'once_per_month':
      return { max_redemptions_per_user: null, max_redemptions_per_day: null, cooldown_hours: 720 };
  }
}

export function ruleFromColumns(cols: RuleColumns): RedemptionRule {
  if (cols.max_redemptions_per_user === 1) return 'once_per_member';
  if (cols.max_redemptions_per_day === 1) return 'once_per_day';
  if (cols.cooldown_hours === 168) return 'once_per_week';
  if (cols.cooldown_hours === 720) return 'once_per_month';
  return 'unlimited';
}
