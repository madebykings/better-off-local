'use client';

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Comprehensive curated list of Material Design icon names.
// Values are the exact icon keys stored in the DB and rendered via the
// Google Material Icons font (loaded in apps/admin/app/layout.tsx).
// ---------------------------------------------------------------------------

const ICON_LIST: string[] = [
  // Food & Drink
  'bakery_dining', 'bento', 'breakfast_dining', 'brunch_dining', 'cake', 'coffee',
  'cookie', 'dinner_dining', 'egg', 'emoji_food_beverage', 'fastfood', 'icecream',
  'kebab_dining', 'liquor', 'local_bar', 'local_cafe', 'local_drink', 'local_pizza',
  'lunch_dining', 'ramen_dining', 'restaurant', 'set_meal', 'sports_bar', 'tapas',
  'wine_bar',

  // Shopping & Retail
  'card_giftcard', 'inventory', 'inventory_2', 'local_atm', 'local_convenience_store',
  'local_grocery_store', 'local_mall', 'local_offer', 'loyalty', 'point_of_sale',
  'receipt', 'receipt_long', 'redeem', 'sell', 'shopping_bag', 'shopping_basket',
  'shopping_cart', 'store', 'storefront', 'warehouse',

  // Beauty, Wellness & Spa
  'accessibility', 'accessibility_new', 'brush', 'checkroom', 'colorize',
  'content_cut', 'dry_cleaning', 'face', 'face_retouching_natural',
  'local_laundry_service', 'palette', 'self_improvement', 'spa',

  // Health & Medical
  'biotech', 'bloodtype', 'coronavirus', 'emergency', 'favorite', 'favorite_border',
  'healing', 'health_and_safety', 'local_hospital', 'local_pharmacy',
  'medical_services', 'medication', 'monitor_heart', 'psychology', 'science',
  'sick', 'vaccines', 'volunteer_activism',

  // Fitness & Sports
  'bicycle', 'directions_bike', 'directions_run', 'downhill_skiing', 'fitness_center',
  'hiking', 'hot_tub', 'kayaking', 'nordic_walking', 'paragliding', 'pool',
  'roller_skating', 'rowing', 'sailing', 'skateboarding', 'snowboarding', 'sports',
  'sports_baseball', 'sports_basketball', 'sports_cricket', 'sports_esports',
  'sports_football', 'sports_golf', 'sports_gymnastics', 'sports_handball',
  'sports_hockey', 'sports_mma', 'sports_motorsports', 'sports_rugby',
  'sports_soccer', 'sports_tennis', 'sports_volleyball', 'surfing',

  // Travel & Hospitality
  'apartment', 'beach_access', 'cabin', 'cottage', 'directions_boat', 'directions_bus',
  'directions_car', 'directions_transit', 'ev_station', 'explore', 'flight', 'forest',
  'holiday_village', 'hotel', 'landscape', 'local_airport', 'local_gas_station',
  'local_taxi', 'luggage', 'map', 'night_shelter', 'park', 'subway', 'train',
  'tram', 'travel_explore', 'villa',

  // Home & Living
  'ac_unit', 'balcony', 'bathroom', 'bathtub', 'bed', 'bedroom_parent', 'blender',
  'chair', 'countertops', 'fence', 'fireplace', 'foundation', 'garage', 'grass',
  'home', 'house', 'kitchen', 'light', 'living', 'microwave', 'roofing',
  'shower', 'wb_sunny', 'weekend', 'yard',

  // Services & Trades
  'anchor', 'build', 'cable', 'carpenter', 'cleaning_services', 'construction',
  'design_services', 'electrical_services', 'format_paint', 'handyman', 'hardware',
  'home_repair_service', 'hvac', 'manage_accounts', 'plumbing',

  // Automotive
  'car_repair', 'electric_car', 'fire_truck', 'local_car_wash', 'local_police',
  'local_shipping', 'oil_barrel', 'tire_repair', 'two_wheeler',

  // Education
  'assignment', 'auto_stories', 'book', 'calculate', 'class', 'create', 'description',
  'edit', 'emoji_events', 'grading', 'history_edu', 'library_books', 'local_library',
  'menu_book', 'military_tech', 'quiz', 'school', 'stars', 'workspace_premium',

  // Entertainment & Activities
  'album', 'attractions', 'casino', 'celebration', 'dark_mode', 'festival',
  'headphones', 'library_music', 'live_tv', 'local_activity', 'mic', 'movie',
  'music_note', 'nightlife', 'outdoor_grill', 'piano', 'theater_comedy',
  'toys', 'videogame_asset',

  // Pets & Animals
  'cruelty_free', 'pets',

  // Kids & Family
  'baby_changing_station', 'child_care', 'child_friendly', 'crib',
  'family_restroom', 'stroller',

  // Technology
  'bluetooth', 'camera', 'camera_alt', 'cloud', 'computer', 'developer_mode',
  'devices', 'keyboard', 'memory', 'mouse', 'print', 'router',
  'signal_cellular_alt', 'smartphone', 'storage', 'tablet', 'tv', 'usb',
  'videocam', 'watch', 'wifi',

  // Finance & Business
  'account_balance', 'attach_money', 'bar_chart', 'business', 'business_center',
  'corporate_fare', 'credit_card', 'currency_exchange', 'domain', 'money',
  'payments', 'real_estate_agent', 'savings', 'trending_up', 'work',

  // Communication
  'alternate_email', 'chat', 'contact_page', 'email', 'forum', 'headset_mic',
  'notifications', 'phone', 'sms', 'support_agent',

  // Nature & Environment
  'air', 'compost', 'eco', 'energy_savings_leaf', 'local_florist', 'nights_stay',
  'recycling', 'solar_power', 'storm', 'terrain', 'water', 'water_drop',
  'wb_cloudy', 'wind_power',

  // General & Utility
  'badge', 'check_circle', 'diversity_1', 'diversity_2', 'diversity_3', 'flag',
  'grade', 'groups', 'handshake', 'help', 'info', 'link', 'location_city',
  'location_on', 'lock', 'lock_open', 'near_me', 'new_releases', 'place',
  'qr_code', 'share', 'star', 'star_border', 'support', 'thumb_up',
  'tour', 'verified', 'visibility',
];

// Sort and deduplicate (directions_car appears in multiple sections above).
const ALL_ICONS = [...new Set(ICON_LIST)].sort();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  /** The <input name> exposed to the enclosing form. */
  name: string;
  /** Currently saved icon key, e.g. "restaurant". */
  defaultValue?: string | null;
}

export function MaterialIconPicker({ name, defaultValue }: Props) {
  const [selected, setSelected] = useState<string>(defaultValue ?? '');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');

  // Search term normalised: spaces → underscores, lowercase.
  const query = search.trim().toLowerCase().replace(/\s+/g, '_');
  const filtered = query ? ALL_ICONS.filter((ic) => ic.includes(query)) : ALL_ICONS;
  // Cap visible results to keep the grid fast when unfiltered.
  const displayed = filtered.slice(0, 120);

  function pick(icon: string) {
    setSelected(icon);
    setOpen(false);
    setSearch('');
    setManualValue('');
  }

  function clear() {
    setSelected('');
    setOpen(false);
  }

  return (
    <div>
      {/* Hidden input submitted with the enclosing form */}
      <input type="hidden" name={name} value={selected} />

      {/* ── Compact trigger ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {selected ? (
          <span className="material-icons text-gray-600 shrink-0" style={{ fontSize: 20 }}>
            {selected}
          </span>
        ) : (
          <span className="inline-block w-5 h-5 rounded border border-dashed border-gray-300 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-green-700 hover:text-green-900 underline truncate max-w-[120px]"
          title={selected || 'Choose icon…'}
        >
          {selected || 'Choose icon…'}
        </button>

        {selected && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-gray-400 hover:text-gray-600 leading-none shrink-0"
            aria-label="Clear icon"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Picker panel (inline — no absolute positioning) ─────────── */}
      {open && (
        <div
          className="mt-2 rounded-lg border border-gray-200 bg-white shadow-md"
          style={{ width: 300, maxWidth: '100%' }}
        >
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                // Prevent Enter from submitting the enclosing server-action form.
                if (e.key === 'Enter') e.preventDefault();
              }}
              placeholder="Search icons…"
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-700"
            />
          </div>

          {/* Icon grid */}
          <div
            className="grid grid-cols-6 gap-px p-1.5 overflow-y-auto"
            style={{ maxHeight: 208 }}
          >
            {displayed.map((icon) => (
              <button
                key={icon}
                type="button"
                title={icon}
                onClick={() => pick(icon)}
                className={[
                  'flex flex-col items-center gap-0.5 rounded p-1.5 transition-colors',
                  'hover:bg-green-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-500',
                  selected === icon ? 'bg-green-100 ring-1 ring-inset ring-green-500' : '',
                ].join(' ')}
              >
                <span className="material-icons text-gray-700" style={{ fontSize: 20 }}>
                  {icon}
                </span>
                <span className="text-[9px] text-gray-400 truncate w-full text-center leading-tight">
                  {icon.replace(/_/g, '​_')}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-6 py-4 text-center text-xs text-gray-400">
                No icons match &ldquo;{search}&rdquo;.
              </p>
            )}
          </div>

          {/* Footer: count + manual fallback + close */}
          <div className="border-t border-gray-100 p-2 space-y-2">
            {filtered.length > 120 && (
              <p className="text-[10px] text-gray-400">
                Showing 120 of {filtered.length} — type to narrow results.
              </p>
            )}

            {/* Manual key entry */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 shrink-0">Manual key:</span>
              {manualValue.trim() && (
                <span
                  className="material-icons text-gray-500 shrink-0"
                  style={{ fontSize: 16 }}
                  title={`Preview: ${manualValue}`}
                >
                  {manualValue.trim()}
                </span>
              )}
              <input
                type="text"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (manualValue.trim()) pick(manualValue.trim());
                  }
                }}
                placeholder="e.g. local_cafe"
                className="flex-1 min-w-0 rounded border border-gray-200 px-2 py-1 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-700"
              />
              <button
                type="button"
                disabled={!manualValue.trim()}
                onClick={() => { if (manualValue.trim()) pick(manualValue.trim()); }}
                className="shrink-0 text-xs rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                Use
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setOpen(false); setSearch(''); }}
              className="text-[10px] text-gray-400 hover:text-gray-600 w-full text-right"
            >
              Close ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
