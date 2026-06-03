// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ListingRetailer = {
  name: string | null;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  phone: string | null;
  email: string | null;
};

export type ListingCategory = { name: string; slug: string };

export type ListingLocation = {
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  opening_hours_json: unknown;
} | null;

export type ListingLink = { type: string; url: string };

export type ListingOffer = {
  title: string | null;
  value_text: string | null;
  description: string | null;
  offer_type: string;
  start_at: string | null;
  end_at: string | null;
} | null;

export type ListingOfferRules = {
  max_redemptions_per_user: number | null;
  max_redemptions_per_day: number | null;
  cooldown_hours: number | null;
  max_redemptions_total: number | null;
} | null;

export type ListingCardData = {
  retailer: ListingRetailer;
  categories: ListingCategory[];
  location: ListingLocation;
  links: ListingLink[];
  offer: ListingOffer;
  offerRules: ListingOfferRules;
};

// ---------------------------------------------------------------------------
// Opening hours helpers (inlined — avoids cross-app import)
// ---------------------------------------------------------------------------

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type DayKey = (typeof DAY_KEYS)[number];

type DaySchedule = { open: boolean; all_day: boolean; start: string | null; end: string | null };
type OpeningHoursData = Record<DayKey, DaySchedule>;

const DEFAULT_HOURS: OpeningHoursData = {
  monday:    { open: true,  all_day: false, start: '09:00', end: '17:00' },
  tuesday:   { open: true,  all_day: false, start: '09:00', end: '17:00' },
  wednesday: { open: true,  all_day: false, start: '09:00', end: '17:00' },
  thursday:  { open: true,  all_day: false, start: '09:00', end: '17:00' },
  friday:    { open: true,  all_day: false, start: '09:00', end: '17:00' },
  saturday:  { open: false, all_day: false, start: null,    end: null    },
  sunday:    { open: false, all_day: false, start: null,    end: null    },
};

function parseOpeningHours(raw: unknown): OpeningHoursData {
  const result = structuredClone(DEFAULT_HOURS);
  if (!raw || typeof raw !== 'object') return result;
  for (const day of DAY_KEYS) {
    const entry = (raw as Record<string, unknown>)[day];
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    result[day] = {
      open:    typeof e.open    === 'boolean' ? e.open    : false,
      all_day: typeof e.all_day === 'boolean' ? e.all_day : false,
      start:   typeof e.start   === 'string'  ? e.start   : null,
      end:     typeof e.end     === 'string'  ? e.end     : null,
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Offer rule helper (inlined)
// ---------------------------------------------------------------------------

type RuleColumns = {
  max_redemptions_per_user: number | null;
  max_redemptions_per_day: number | null;
  cooldown_hours: number | null;
};

function ruleFromColumns(cols: RuleColumns): string {
  if (cols.max_redemptions_per_user === 1) return 'once_per_member';
  if (cols.max_redemptions_per_day === 1)  return 'once_per_day';
  if (cols.cooldown_hours === 168)          return 'once_per_week';
  if (cols.cooldown_hours === 720)          return 'once_per_month';
  return 'unlimited';
}

// ---------------------------------------------------------------------------
// Display maps
// ---------------------------------------------------------------------------

const DAY_SHORT: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const OFFER_TYPE_LABELS: Record<string, string> = {
  percentage_discount: 'Percentage off',
  fixed_discount:      'Fixed amount off',
  free_item:           'Free item',
  other:               'Special access',
};

const RULE_SHORT: Record<string, string> = {
  unlimited:       'Unlimited uses',
  once_per_member: 'Once per member',
  once_per_day:    'Once per day',
  once_per_week:   'Once per week',
  once_per_month:  'Once per month',
};

const LINK_LABELS: Record<string, string> = {
  website: 'Website', instagram: 'Instagram', facebook: 'Facebook',
  tiktok: 'TikTok', whatsapp: 'WhatsApp',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CoverHeader({ retailer }: { retailer: ListingRetailer }) {
  return (
    <div className="relative">
      {retailer.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={retailer.cover_image_url}
          alt={`${retailer.name ?? 'Business'} cover`}
          className="w-full object-cover aspect-[16/9]"
        />
      ) : (
        <div className="flex w-full items-end justify-start bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] aspect-[16/9] px-4 pb-4">
          <span className="text-[11px] font-medium text-white/40">No cover image</span>
        </div>
      )}
      <div className="absolute -bottom-5 left-4">
        {retailer.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={retailer.logo_url}
            alt="Logo"
            className="h-14 w-14 rounded-xl border-2 border-white bg-white object-contain shadow-md"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-white bg-gray-100 shadow-md">
            <span className="text-[9px] font-medium text-gray-400">Logo</span>
          </div>
        )}
      </div>
    </div>
  );
}

function NameBlock({ retailer, categories }: { retailer: ListingRetailer; categories: ListingCategory[] }) {
  return (
    <div className="px-4 pt-9">
      <h2 className="text-lg font-bold text-gray-900">
        {retailer.name ?? <span className="text-gray-400">Business name</span>}
      </h2>
      {retailer.tagline && (
        <p className="mt-0.5 text-sm text-gray-500">{retailer.tagline}</p>
      )}
      {categories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <span
              key={cat.slug}
              className="rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-medium text-green-700"
            >
              {cat.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DescriptionBlock({ description }: { description: string | null }) {
  if (!description?.trim()) return null;
  return (
    <div className="mt-3 px-4">
      <p className="text-sm leading-relaxed text-gray-600">{description}</p>
    </div>
  );
}

function AddressBlock({ location }: { location: ListingLocation }) {
  if (!location?.address_line_1?.trim()) return null;
  const parts = [
    location.address_line_1, location.address_line_2,
    location.town, location.county, location.postcode,
  ].filter(Boolean).join(', ');
  return (
    <div className="mt-2 px-4">
      <p className="text-[12px] text-gray-500">{parts}</p>
    </div>
  );
}

function OpeningHoursBlock({ json }: { json: unknown }) {
  const hours = parseOpeningHours(json);
  return (
    <div className="px-4 py-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        Opening hours
      </p>
      <div className="space-y-1">
        {DAY_KEYS.map((key) => {
          const day = hours[key];
          const timeLabel = day.open
            ? day.all_day ? 'Open 24 hours' : `${day.start} – ${day.end}`
            : 'Closed';
          return (
            <div key={key} className="flex justify-between text-[12px]">
              <span className="text-gray-500">{DAY_SHORT[key]}</span>
              <span className={day.open ? 'text-gray-700' : 'text-gray-400'}>{timeLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OfferBlock({ offer, rules }: { offer: ListingOffer; rules: ListingOfferRules }) {
  if (!offer?.title && !offer?.value_text) {
    return (
      <div className="px-4 py-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          First offer
        </p>
        <p className="text-[12px] text-gray-400">No offer added.</p>
      </div>
    );
  }

  const rule = rules
    ? ruleFromColumns({
        max_redemptions_per_user: rules.max_redemptions_per_user,
        max_redemptions_per_day:  rules.max_redemptions_per_day,
        cooldown_hours:           rules.cooldown_hours,
      })
    : 'unlimited';

  return (
    <div className="px-4 py-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        First offer
      </p>
      <div className="overflow-hidden rounded-xl ring-1 ring-black/[0.04]">
        <div className="bg-gradient-to-br from-green-700 to-green-600 px-4 pb-3 pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
            {OFFER_TYPE_LABELS[offer.offer_type] ?? 'Offer'}
          </span>
          <p className="mt-1 text-xl font-extrabold leading-tight text-white">{offer.value_text}</p>
          <p className="text-sm font-medium text-white/80">{offer.title}</p>
        </div>
        <div className="flex items-center justify-between bg-white px-4 py-2">
          <span className="text-[11px] text-gray-500">{RULE_SHORT[rule]}</span>
          {rules?.max_redemptions_total != null && (
            <span className="text-[11px] font-medium text-orange-500">Limited</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactBlock({ retailer, links }: { retailer: ListingRetailer; links: ListingLink[] }) {
  const items: { label: string }[] = [];
  if (retailer.phone?.trim()) items.push({ label: 'Phone' });
  if (retailer.email?.trim()) items.push({ label: 'Email' });
  for (const link of links) {
    if (LINK_LABELS[link.type]) items.push({ label: LINK_LABELS[link.type] });
  }

  return (
    <div className="px-4 py-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        Contact & links
      </p>
      {items.length === 0 ? (
        <p className="text-[12px] text-gray-400">No contact details.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span key={i} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RetailerListingCard — read-only consumer listing preview for admin use
// ---------------------------------------------------------------------------

export function RetailerListingCard({ data }: { data: ListingCardData }) {
  const hasHours = Boolean(data.location?.opening_hours_json);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] max-w-sm mx-auto">
      {/* Simulated app nav bar */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        <span className="text-sm font-semibold text-[#1B4332] flex-1">Better Off Local</span>
        <div className="h-7 w-7 rounded-full bg-gray-100 border border-gray-200" />
      </div>

      <CoverHeader retailer={data.retailer} />
      <NameBlock retailer={data.retailer} categories={data.categories} />
      <DescriptionBlock description={data.retailer.description} />
      <AddressBlock location={data.location} />

      <div className="mt-4 border-t border-gray-100" />
      {hasHours ? (
        <OpeningHoursBlock json={data.location?.opening_hours_json} />
      ) : (
        <div className="px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Opening hours</p>
          <p className="mt-1 text-[12px] text-gray-400">No opening hours added.</p>
        </div>
      )}

      <div className="border-t border-gray-100" />
      <OfferBlock offer={data.offer} rules={data.offerRules} />

      <div className="border-t border-gray-100" />
      <ContactBlock retailer={data.retailer} links={data.links} />
    </div>
  );
}
