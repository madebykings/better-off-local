import Link from 'next/link';
import { Logo } from '@better-off-local/ui';
import { parseOpeningHours, DAY_KEYS } from '@/lib/utils/opening_hours';
import { reverseNormaliseLink, URL_LINK_TYPES, type UrlLinkType } from '@/lib/utils/links';
import { ruleFromColumns } from '@/lib/utils/redemption_rules';
import { SubmitButton } from '@/components/onboarding/submit_button';

// ---------------------------------------------------------------------------
// Data types (passed as props from the server page)
// ---------------------------------------------------------------------------

export type PreviewRetailer = {
  name: string | null;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  phone: string | null;
  email: string | null;
};

export type PreviewCategory = { name: string; slug: string };

export type PreviewLocation = {
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  postcode: string | null;
  opening_hours_json: unknown;
} | null;

export type PreviewLink = { type: string; url: string };

export type PreviewOffer = {
  title: string | null;
  value_text: string | null;
  description: string | null;
  offer_type: string;
  start_at: string | null;
  end_at: string | null;
} | null;

export type PreviewOfferRules = {
  max_redemptions_per_user: number | null;
  max_redemptions_per_day: number | null;
  cooldown_hours: number | null;
  max_redemptions_total: number | null;
} | null;

export type PreviewData = {
  retailer: PreviewRetailer;
  categories: PreviewCategory[];
  location: PreviewLocation;
  links: PreviewLink[];
  offer: PreviewOffer;
  offerRules: PreviewOfferRules;
};

// ---------------------------------------------------------------------------
// Quality score
// ---------------------------------------------------------------------------

type ScoreItem = { label: string; weight: number; earned: boolean };

function computeScoreItems(data: PreviewData): ScoreItem[] {
  const { retailer, categories, location, links, offer } = data;

  const hours = location?.opening_hours_json
    ? parseOpeningHours(location.opening_hours_json)
    : null;
  const hasOpenDay = hours ? DAY_KEYS.some((k) => hours[k].open) : false;
  const hasContact =
    Boolean(retailer.phone?.trim()) ||
    Boolean(retailer.email?.trim()) ||
    links.length > 0;

  return [
    { label: 'Business name',  weight: 10, earned: Boolean(retailer.name?.trim()) },
    { label: 'Description',    weight: 10, earned: Boolean(retailer.description?.trim() || retailer.tagline?.trim()) },
    { label: 'Cover image',    weight: 15, earned: Boolean(retailer.cover_image_url) },
    { label: 'Logo',           weight: 5,  earned: Boolean(retailer.logo_url) },
    { label: 'Categories',     weight: 10, earned: categories.length > 0 },
    { label: 'Location',       weight: 10, earned: Boolean(location?.address_line_1?.trim() && location?.postcode?.trim()) },
    { label: 'Opening hours',  weight: 10, earned: hasOpenDay },
    { label: 'Contact method', weight: 15, earned: hasContact },
    { label: 'First offer',    weight: 15, earned: Boolean(offer?.title?.trim() && offer?.value_text?.trim()) },
  ];
}

function computeQualityScore(data: PreviewData): number {
  return computeScoreItems(data)
    .filter((item) => item.earned)
    .reduce((sum, item) => sum + item.weight, 0);
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

type ChecklistStatus = 'complete' | 'required' | 'recommended';
type ChecklistItem = { label: string; status: ChecklistStatus; editPath: string };

function buildChecklist(data: PreviewData): ChecklistItem[] {
  const { retailer, categories, location, links, offer } = data;

  const hours = location?.opening_hours_json
    ? parseOpeningHours(location.opening_hours_json)
    : null;
  const hasOpenDay = hours ? DAY_KEYS.some((k) => hours[k].open) : false;
  const hasContact =
    Boolean(retailer.phone?.trim()) ||
    Boolean(retailer.email?.trim()) ||
    links.length > 0;

  return [
    {
      label: 'Business name & details',
      status: retailer.name?.trim() ? 'complete' : 'required',
      editPath: '/onboarding/business-details',
    },
    {
      label: 'Cover image',
      status: retailer.cover_image_url ? 'complete' : 'required',
      editPath: '/onboarding/branding',
    },
    {
      label: 'Logo',
      status: retailer.logo_url ? 'complete' : 'recommended',
      editPath: '/onboarding/branding',
    },
    {
      label: 'Categories',
      status: categories.length > 0 ? 'complete' : 'required',
      editPath: '/onboarding/categories',
    },
    {
      label: 'Location & address',
      status:
        location?.address_line_1?.trim() && location?.postcode?.trim()
          ? 'complete'
          : 'required',
      editPath: '/onboarding/location',
    },
    {
      label: 'Opening hours',
      status: hasOpenDay ? 'complete' : 'required',
      editPath: '/onboarding/opening-hours',
    },
    {
      label: 'Contact method',
      status: hasContact ? 'complete' : 'required',
      editPath: '/onboarding/links',
    },
    {
      label: 'First offer',
      status:
        offer?.title?.trim() && offer?.value_text?.trim() ? 'complete' : 'required',
      editPath: '/onboarding/first-offer',
    },
  ];
}

function computeBlockingErrors(checklist: ChecklistItem[]): string[] {
  const messages: Record<string, string> = {
    'Business name & details': 'Business name is required.',
    'Cover image':             'A cover image is required.',
    'Categories':              'At least one category is required.',
    'Location & address':      'A business address is required.',
    'Opening hours':           'At least one opening day is required.',
    'Contact method':          'At least one contact method is required.',
    'First offer':             'A first offer is required.',
  };

  return checklist
    .filter((item) => item.status === 'required')
    .map((item) => messages[item.label] ?? `${item.label} is required.`);
}

// ---------------------------------------------------------------------------
// Quality score bar
// ---------------------------------------------------------------------------

function QualityScore({ score }: { score: number }) {
  const barClass =
    score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const textClass =
    score >= 80 ? 'text-green-700' : score >= 50 ? 'text-amber-700' : 'text-red-700';
  const label = score >= 80 ? 'Great' : score >= 50 ? 'Good' : 'Needs work';

  return (
    <div className="mb-6">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Profile quality</p>
        <span className={`text-sm font-bold tabular-nums ${textClass}`}>
          {score}/100 &middot; {label}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checklist UI
// ---------------------------------------------------------------------------

// Heroicons v2 outline path arrays — check, x-mark, minus

const CHECK_PATH =
  'M4.5 12.75l6 6 9-13.5';
const X_PATH =
  'M6 18L18 6M6 6l12 12';
const MINUS_PATH =
  'M5 12h14';

function StatusIcon({ status }: { status: ChecklistStatus }) {
  const path = status === 'complete' ? CHECK_PATH : status === 'required' ? X_PATH : MINUS_PATH;
  const stroke =
    status === 'complete'
      ? 'text-green-500'
      : status === 'required'
        ? 'text-red-400'
        : 'text-amber-400';

  return (
    <svg
      className={`h-4 w-4 shrink-0 ${stroke}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function Checklist({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        Ready for review
      </p>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusIcon status={item.status} />
              <span
                className={`text-[12px] ${
                  item.status === 'complete'
                    ? 'text-gray-700'
                    : item.status === 'required'
                      ? 'font-medium text-red-600'
                      : 'text-gray-500'
                }`}
              >
                {item.label}
                {item.status === 'recommended' && (
                  <span className="ml-1 font-normal text-gray-400">(recommended)</span>
                )}
              </span>
            </div>
            <Link
              href={item.editPath}
              className="shrink-0 text-[11px] font-medium text-brand hover:underline"
            >
              Edit
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Listing card sections
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

function CoverHeader({ retailer }: { retailer: PreviewRetailer }) {
  return (
    <div className="relative">
      {retailer.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={retailer.cover_image_url}
          alt={`${retailer.name ?? 'Business'} cover`}
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
          <p className="text-xs text-gray-400">No cover image added</p>
        </div>
      )}
      <div className="absolute -bottom-6 left-4">
        {retailer.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={retailer.logo_url}
            alt="Logo"
            className="h-12 w-12 rounded-xl border-2 border-white bg-white object-contain shadow-sm"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-white bg-gray-100 shadow-sm">
            <span className="text-[9px] font-medium text-gray-400">Logo</span>
          </div>
        )}
      </div>
    </div>
  );
}

function NameBlock({
  retailer,
  categories,
}: {
  retailer: PreviewRetailer;
  categories: PreviewCategory[];
}) {
  return (
    <div className="px-4 pt-8">
      <h2 className="text-lg font-bold text-gray-900">
        {retailer.name ?? <span className="text-gray-400">Your business name</span>}
      </h2>
      {retailer.tagline && (
        <p className="mt-0.5 text-sm text-gray-500">{retailer.tagline}</p>
      )}
      {categories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <span
              key={cat.slug}
              className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand"
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

function AddressBlock({ location }: { location: PreviewLocation }) {
  if (!location?.address_line_1?.trim()) return null;

  const parts = [
    location.address_line_1,
    location.address_line_2,
    location.town,
    location.postcode,
  ]
    .filter(Boolean)
    .join(', ');

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
            ? day.all_day
              ? 'Open 24 hours'
              : `${day.start} – ${day.end}`
            : 'Closed';
          return (
            <div key={key} className="flex justify-between text-[12px]">
              <span className="text-gray-500">{DAY_SHORT[key]}</span>
              <span className={day.open ? 'text-gray-700' : 'text-gray-400'}>
                {timeLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OfferBlock({
  offer,
  rules,
}: {
  offer: PreviewOffer;
  rules: PreviewOfferRules;
}) {
  if (!offer?.title && !offer?.value_text) {
    return (
      <div className="px-4 py-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          First offer
        </p>
        <p className="text-[12px] text-gray-400">No offer added yet.</p>
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
        <div className="bg-gradient-to-br from-brand to-brand/80 px-4 pb-3 pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
            {OFFER_TYPE_LABELS[offer.offer_type] ?? 'Offer'}
          </span>
          <p className="mt-1 text-xl font-extrabold leading-tight text-white">
            {offer.value_text}
          </p>
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

function ContactBlock({
  retailer,
  links,
}: {
  retailer: PreviewRetailer;
  links: PreviewLink[];
}) {
  const items: { label: string; value: string }[] = [];

  if (retailer.phone?.trim()) items.push({ label: 'Phone', value: retailer.phone });
  if (retailer.email?.trim()) items.push({ label: 'Email', value: retailer.email });

  for (const link of links) {
    if (URL_LINK_TYPES.includes(link.type as UrlLinkType)) {
      items.push({
        label: LINK_LABELS[link.type] ?? link.type,
        value: reverseNormaliseLink(link.type as UrlLinkType, link.url),
      });
    }
  }

  return (
    <div className="px-4 py-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        Contact & links
      </p>
      {items.length === 0 ? (
        <p className="text-[12px] text-gray-400">No contact details added yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span
              key={i}
              className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600"
            >
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ListingPreview
// ---------------------------------------------------------------------------

export function ListingPreview({ data }: { data: PreviewData }) {
  const checklist = buildChecklist(data);
  const blockingErrors = computeBlockingErrors(checklist);
  const score = computeQualityScore(data);

  const hasHours = Boolean(data.location?.opening_hours_json);

  return (
    <div className="grid grid-cols-1 gap-x-14 gap-y-10 lg:grid-cols-[1fr_300px]">
      {/* ── Consumer listing card ─────────────────────────────────── */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          How your listing will look to members
        </p>
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04]">
          {/* Simulated platform chrome */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
            <Logo variant="horizontal" scheme="light" height={22} />
            <div className="h-6 w-6 rounded-full bg-gray-200" />
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
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Opening hours
              </p>
              <p className="mt-1 text-[12px] text-gray-400">No opening hours added yet.</p>
            </div>
          )}

          <div className="border-t border-gray-100" />
          <OfferBlock offer={data.offer} rules={data.offerRules} />

          <div className="border-t border-gray-100" />
          <ContactBlock retailer={data.retailer} links={data.links} />
        </div>
      </div>

      {/* ── Quality + checklist + submit ─────────────────────────── */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <QualityScore score={score} />
        <Checklist items={checklist} />

        <SubmitButton blockingErrors={blockingErrors} />

        <div className="mt-4 text-center">
          <Link
            href="/onboarding/first-offer"
            className="text-sm text-gray-400 transition-colors hover:text-gray-600"
          >
            &larr; Back to offer
          </Link>
        </div>
      </aside>
    </div>
  );
}
