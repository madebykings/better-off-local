# Better Off Local – Flutter App Structure

## Overview
This document defines the recommended Flutter app structure for the Better Off Local consumer mobile app.

The goal is to create a production-ready structure that:
- scales cleanly
- keeps features modular
- supports iOS and Android from one codebase
- works well with AI-assisted coding
- avoids spaghetti state management and random file growth

This app is for consumers only.
Retailer and admin workflows belong in separate web portals.

---

## Core Principles
- feature-first folder structure
- shared app core for cross-cutting concerns
- clear separation between presentation, application, domain, and data layers where useful
- avoid overengineering early, but do not collapse everything into screens and services
- business-critical logic must not rely on client-only validation
- keep API and Supabase interaction centralized and testable

---

## Recommended State Management
Recommended:
- Riverpod

Why:
- clean dependency injection
- testable
- good async handling
- scalable across feature modules
- works well with feature-first architecture

Alternative:
- Bloc is acceptable, but Riverpod is likely faster and cleaner for this product

---

## Recommended Navigation
Recommended:
- go_router

Why:
- declarative routing
- auth-aware redirects
- nested routes
- scalable as app grows

---

## Recommended Packages (Initial)
- flutter_riverpod
- hooks_riverpod (optional)
- go_router
- supabase_flutter
- google_maps_flutter
- geolocator
- mobile_scanner (if ever needed client-side later)
- intl
- flutter_secure_storage
- cached_network_image
- equatable (optional)
- freezed / json_serializable (optional if typed models are heavily used)

---

## App Responsibilities
The mobile app is responsible for:
- consumer onboarding
- authentication
- membership purchase entry points
- nearby discovery
- offer browsing
- map exploration
- favourites
- notifications display
- membership card UI
- redemption initiation UI

The mobile app is not the source of truth for:
- membership entitlement
- redemption validity
- retailer visibility
- offer eligibility
- fraud validation

Those must be enforced server-side.

---

## Recommended Folder Structure

```text
apps/mobile/
├── lib/
│   ├── app/
│   │   ├── app.dart
│   │   ├── router/
│   │   │   ├── app_router.dart
│   │   │   └── route_names.dart
│   │   ├── theme/
│   │   │   ├── app_theme.dart
│   │   │   ├── app_colors.dart
│   │   │   ├── app_text_styles.dart
│   │   │   └── app_spacing.dart
│   │   └── bootstrap/
│   │       └── bootstrap.dart
│   │
│   ├── core/
│   │   ├── config/
│   │   │   ├── env.dart
│   │   │   └── app_config.dart
│   │   ├── constants/
│   │   │   ├── app_constants.dart
│   │   │   └── storage_keys.dart
│   │   ├── errors/
│   │   │   ├── app_exception.dart
│   │   │   └── failure.dart
│   │   ├── utils/
│   │   │   ├── date_utils.dart
│   │   │   ├── currency_utils.dart
│   │   │   ├── distance_utils.dart
│   │   │   └── validation_utils.dart
│   │   ├── network/
│   │   │   ├── connectivity_service.dart
│   │   │   └── api_result.dart
│   │   ├── services/
│   │   │   ├── supabase_service.dart
│   │   │   ├── location_service.dart
│   │   │   ├── notification_service.dart
│   │   │   └── analytics_service.dart
│   │   ├── widgets/
│   │   │   ├── app_scaffold.dart
│   │   │   ├── primary_button.dart
│   │   │   ├── loading_indicator.dart
│   │   │   ├── empty_state.dart
│   │   │   ├── error_state.dart
│   │   │   └── section_header.dart
│   │   └── providers/
│   │       ├── supabase_provider.dart
│   │       ├── session_provider.dart
│   │       └── location_provider.dart
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/
│   │   │   │   ├── auth_repository_impl.dart
│   │   │   │   └── auth_remote_data_source.dart
│   │   │   ├── domain/
│   │   │   │   ├── auth_repository.dart
│   │   │   │   └── auth_state.dart
│   │   │   ├── presentation/
│   │   │   │   ├── sign_in_screen.dart
│   │   │   │   ├── sign_up_screen.dart
│   │   │   │   ├── forgot_password_screen.dart
│   │   │   │   └── auth_controller.dart
│   │   │   └── providers/
│   │   │       └── auth_providers.dart
│   │   │
│   │   ├── onboarding/
│   │   │   ├── presentation/
│   │   │   │   ├── splash_screen.dart
│   │   │   │   ├── welcome_screen.dart
│   │   │   │   └── onboarding_controller.dart
│   │   │   └── providers/
│   │   │       └── onboarding_providers.dart
│   │   │
│   │   ├── memberships/
│   │   │   ├── data/
│   │   │   │   ├── membership_repository_impl.dart
│   │   │   │   └── membership_remote_data_source.dart
│   │   │   ├── domain/
│   │   │   │   ├── membership.dart
│   │   │   │   └── membership_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── paywall_screen.dart
│   │   │   │   ├── subscription_success_screen.dart
│   │   │   │   ├── membership_card_screen.dart
│   │   │   │   └── membership_controller.dart
│   │   │   └── providers/
│   │   │       └── membership_providers.dart
│   │   │
│   │   ├── home/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   ├── presentation/
│   │   │   │   ├── home_screen.dart
│   │   │   │   ├── widgets/
│   │   │   │   │   ├── nearby_offers_section.dart
│   │   │   │   │   ├── featured_retailers_section.dart
│   │   │   │   │   ├── categories_section.dart
│   │   │   │   │   └── savings_summary_card.dart
│   │   │   │   └── home_controller.dart
│   │   │   └── providers/
│   │   │       └── home_providers.dart
│   │   │
│   │   ├── offers/
│   │   │   ├── data/
│   │   │   │   ├── offers_repository_impl.dart
│   │   │   │   └── offers_remote_data_source.dart
│   │   │   ├── domain/
│   │   │   │   ├── offer.dart
│   │   │   │   └── offers_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── offer_list_screen.dart
│   │   │   │   ├── offer_detail_screen.dart
│   │   │   │   ├── categories_screen.dart
│   │   │   │   ├── widgets/
│   │   │   │   │   ├── offer_card.dart
│   │   │   │   │   ├── offer_filter_bar.dart
│   │   │   │   │   └── category_chip_list.dart
│   │   │   │   └── offers_controller.dart
│   │   │   └── providers/
│   │   │       └── offers_providers.dart
│   │   │
│   │   ├── retailers/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   │   ├── retailer.dart
│   │   │   │   └── retailer_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── retailer_detail_screen.dart
│   │   │   │   └── retailer_controller.dart
│   │   │   └── providers/
│   │   │       └── retailer_providers.dart
│   │   │
│   │   ├── map/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   ├── presentation/
│   │   │   │   ├── map_screen.dart
│   │   │   │   ├── widgets/
│   │   │   │   │   └── map_offer_preview_card.dart
│   │   │   │   └── map_controller.dart
│   │   │   └── providers/
│   │   │       └── map_providers.dart
│   │   │
│   │   ├── favourites/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   ├── presentation/
│   │   │   │   ├── favourites_screen.dart
│   │   │   │   └── favourites_controller.dart
│   │   │   └── providers/
│   │   │       └── favourites_providers.dart
│   │   │
│   │   ├── redemptions/
│   │   │   ├── data/
│   │   │   │   ├── redemptions_repository_impl.dart
│   │   │   │   └── redemptions_remote_data_source.dart
│   │   │   ├── domain/
│   │   │   │   ├── redemption.dart
│   │   │   │   ├── redemption_token.dart
│   │   │   │   └── redemptions_repository.dart
│   │   │   ├── presentation/
│   │   │   │   ├── redemption_confirmation_screen.dart
│   │   │   │   ├── redemption_failed_screen.dart
│   │   │   │   ├── redemption_history_screen.dart
│   │   │   │   └── redemption_controller.dart
│   │   │   └── providers/
│   │   │       └── redemption_providers.dart
│   │   │
│   │   ├── notifications/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   │   └── app_notification.dart
│   │   │   ├── presentation/
│   │   │   │   ├── notifications_screen.dart
│   │   │   │   └── notifications_controller.dart
│   │   │   └── providers/
│   │   │       └── notifications_providers.dart
│   │   │
│   │   ├── account/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   ├── presentation/
│   │   │   │   ├── account_screen.dart
│   │   │   │   ├── settings_screen.dart
│   │   │   │   ├── savings_screen.dart
│   │   │   │   └── account_controller.dart
│   │   │   └── providers/
│   │   │       └── account_providers.dart
│   │   │
│   │   └── shell/
│   │       ├── presentation/
│   │       │   ├── app_shell.dart
│   │       │   └── bottom_nav_scaffold.dart
│   │       └── providers/
│   │           └── shell_providers.dart
│   │
│   ├── l10n/
│   └── main.dart
│
├── test/
├── integration_test/
├── pubspec.yaml
└── README.md
```

---

## Layer Guidance

### Presentation Layer

Contains:
- screens
- widgets
- controllers/notifiers
- UI state

Should not contain:
- raw SQL or direct Supabase queries spread everywhere
- billing business rules
- redemption validity logic

---

### Domain Layer

Contains:
- core entities
- repository contracts
- feature models
- business-facing interfaces

Use when:
- feature is important enough to justify structure
- multiple screens use the same models/logic

---

### Data Layer

Contains:
- repository implementations
- remote data sources
- DTO mapping
- Supabase calls
- API responses

Purpose:
- isolate backend changes
- prevent UI from becoming backend-aware

---

## Initial Feature Ownership

### Auth Feature

Owns:
- sign in
- sign up
- password reset
- session awareness

### Memberships Feature

Owns:
- paywall
- membership state
- membership card screen
- renewal visibility

### Home Feature

Owns:
- landing state after login
- nearby preview
- featured content
- categories summary

### Offers Feature

Owns:
- browsing and offer details

### Retailers Feature

Owns:
- retailer profile pages

### Map Feature

Owns:
- map browsing and pin interactions

### Redemptions Feature

Owns:
- redemption token retrieval
- confirmation and history UI
- failure states

### Account Feature

Owns:
- profile
- plan summary
- settings
- saved money summary

---

## Routing Strategy

### Public-ish Routes
- splash
- welcome
- sign-in
- sign-up
- forgot-password

### Authenticated Routes
- home
- explore
- map
- offer detail
- retailer detail
- favourites
- card
- notifications
- account
- settings
- savings
- redemption history

### Membership-Gated Flows
- paywall
- membership card access
- redeem CTA
- some premium app actions later

Note: Viewing some public content may be allowed without active membership, but redemption should always require active entitlement.

---

## Shared UI Guidance

Build shared widgets for:
- buttons
- section headers
- chips
- cards
- empty states
- loading states
- top bars
- error surfaces

Do not duplicate these across features.

---

## API / Backend Access Guidance

All Supabase access should go through:
- data sources
- repository implementations
- centralized service providers

Avoid:
- direct Supabase calls inside widgets
- repeated query logic across screens

---

## App Shell Recommendation

### Bottom Navigation Tabs
- Home
- Explore
- Map
- Card
- Account

### Why
This supports the core value loop:
- discover offers
- browse nearby
- redeem easily
- manage membership

---

## Initial Build Sequence

1. app bootstrap
2. theme and router
3. auth feature
4. shell/navigation
5. memberships feature
6. home feature
7. offers feature
8. retailers feature
9. map feature
10. favourites feature
11. redemptions feature
12. notifications feature
13. account feature

---

## Testing Recommendation

At minimum:
- controller/provider tests for auth and memberships
- repository tests for critical feature modules
- widget tests for main screens
- integration tests for:
  - auth flow
  - paywall entry
  - nearby offers load
  - membership card access

---

## Non-Negotiables

- do not hardcode membership status in UI
- do not validate redemption purely client-side
- do not mix retailer/admin concerns into this app
- do not let feature folders become dumping grounds
- do not put all logic into one global app controller
