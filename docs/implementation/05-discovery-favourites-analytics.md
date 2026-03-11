# Better Off Local – Implementation Brief 05
# Discovery, Favourites, and Analytics

## Objective
Implement the discovery, favourites, and basic analytics slice for Better Off Local.

Consumers must be able to discover live offers and retailers, save their favourites, and view offer details. Retailers must be able to see basic usage metrics in the portal.

---

## Scope

- Live offer discovery (home screen + explore list)
- Category filtering for offers
- Offer detail screen with favourite toggle and membership-gated redeem CTA
- Retailer detail screen with offer list and contact info
- Favourites system (save/unsave offers and retailers)
- Offer view logging (fire-and-forget analytics)
- Retailer portal dashboard metrics (views, saves, redemptions, live offers)
- Retailer portal offers table with per-offer stats

---

## Domain Models

### Offer
Fields: `id`, `retailerId`, `retailerName` (from join), `title`, `status`, `shortSummary`, `description`, `offerType`, `valueText`, `termsText`, `startAt`, `endAt`, `isFeatured`, `imageUrl`, `retailerLogoUrl`, `distanceKm`.

Removed: `categoryId` (not in DB), `discountDisplay`, `expiresAt`.

`fromMap` handles nested `retailers` join map.

### Retailer
Fields: `id`, `name`, `slug`, `description`, `shortDescription`, `logoUrl`, `coverImageUrl`, `websiteUrl`, `phone`, `email`, `addressLine1`, `town`, `postcode`, `latitude`, `longitude`, `distanceKm`.

Removed: `categoryId`, `isActive` (handled server-side via RLS/query filter).

`fromMap` handles nested `retailer_locations` join (list or single map, picks primary).

### Category
Fields: `id`, `name`, `slug`, `icon`, `sortOrder`. Read-only reference data.

### Favourite
Fields: `id`, `profileId`, `retailerId`, `offerId`, `createdAt`. Either `retailerId` or `offerId` must be set.

---

## Offer Discovery Rules

Offers are live when:
- `status = 'live'`
- `end_at IS NULL OR end_at > now()`
- `start_at IS NULL OR start_at <= now()`

These are enforced in the Supabase query, never client-side.

Category filtering works by:
1. Query `retailer_categories` for retailer IDs with matching `category_id`
2. Filter offers by those retailer IDs via `.inFilter()`

---

## Data Layer

### offers_remote_data_source.dart
- `fetchOffers({categoryId})` — live offers with category filter support
- `fetchOffer(offerId)` — full detail with retailer + location join
- `fetchOffersByRetailer(retailerId)` — live offers for a retailer
- `logOfferView({offerId, retailerId, profileId})` — insert to `offer_views`
- `fetchCategories()` — active categories ordered by sort_order

### retailers_remote_data_source.dart
- `fetchRetailer(retailerId)` — single live retailer with primary location
- `fetchLiveRetailers()` — all live+active retailers for home screen

### favourites_remote_data_source.dart
- `fetchFavourites(profileId)` — all favourite rows
- `fetchFavouriteOffers(profileId)` — with joined offer + retailer data
- `fetchFavouriteRetailers(profileId)` — with joined retailer data
- `addOfferFavourite`, `removeOfferFavourite`
- `addRetailerFavourite`, `removeRetailerFavourite`

---

## Providers

### offers_providers.dart
- `selectedCategoryProvider` — `StateProvider<String?>`, null = all
- `liveOffersProvider` — `FutureProvider<List<Offer>>`, watches `selectedCategoryProvider`
- `homeOffersProvider` — first 10 live offers for home screen
- `offerProvider` — `FutureProvider.family<Offer, String>`
- `retailerOffersProvider` — `FutureProvider.family<List<Offer>, String>`
- `categoriesProvider` — `FutureProvider<List<Category>>`
- `logOfferView(ref, offerId, retailerId)` — fire-and-forget utility function

### retailer_providers.dart
- `retailerProvider` — `FutureProvider.family<Retailer, String>`
- `liveRetailersProvider` — `FutureProvider<List<Retailer>>`

### favourites_providers.dart
- `favouritesProvider` — `FutureProvider<List<Favourite>>`
- `favouriteOfferIdsProvider` — `Provider<Set<String>>` derived
- `favouriteRetailerIdsProvider` — `Provider<Set<String>>` derived
- `toggleOfferFavourite(ref, offerId, isCurrentlyFavourited)` — utility
- `toggleRetailerFavourite(ref, retailerId, isCurrentlyFavourited)` — utility

---

## Flutter Screens

### OfferListScreen
- Category chip bar at top (from `CategoryChipList`)
- Live scrollable list of `OfferCard` widgets
- Pull-to-refresh
- Empty state per category

### OfferDetailScreen
- `ConsumerStatefulWidget`: logs view on init via `addPostFrameCallback`
- Favourite toggle in app bar
- Value badge, title, retailer link, description, terms
- Membership-gated redeem CTA: active membership → redeem; no membership → paywall

### RetailerDetailScreen
- Cover image in collapsible app bar
- Logo, name, address, contact chips (phone, website)
- Description
- Live offer list via `retailerOffersProvider`

### FavouritesScreen
- Two tabs: Offers | Retailers
- Each tab fetches joined data from `favourites_remote_data_source`

### Home Widgets
- `NearbyOffersSection`: horizontal scroll of `OfferCardCompact`, "See all" → explore
- `FeaturedRetailersSection`: horizontal scroll of retailer logos (up to 8)
- `CategoriesSection`: horizontal chip list, tap navigates to explore with category pre-selected
- `SavingsSummaryCard`: shows count of successful redemptions from `redemptionHistoryProvider`

---

## Retailer Portal

### dashboard/page.tsx
4 metric cards (server-rendered via `Promise.all`):
- Live offers count
- Total successful redemptions
- Total offer views
- Total saves/favourites

Plus a recent redemptions table (last 5).

### offers/page.tsx
Table of all offers with:
- Title, status badge, created date
- Views, saves, redemptions counts (aggregated client-side from parallel queries)

---

## Constraints

- No loyalty points
- No referral logic
- No advanced recommendation engine
- No real-time map screen (stubbed, requires Google Maps API key)
- Distance sorting uses client-side Haversine (acceptable for hyper-local Clackmannanshire launch)

---

## Assumptions and Follow-ups

- `offer_views` has no deduplication — same user can log multiple views
- Race condition on category filter: if `retailer_categories` is empty for a category, returns empty list without error
- Favourites screen uses FutureBuilder for joined data (not integrated into Riverpod provider graph, acceptable for simplicity)
- `SavingsSummaryCard` shows redemption count, not £ value (no savings amount stored in DB)
- Retailer portal stats can be slow for very high volume — acceptable at launch scale with small dataset
