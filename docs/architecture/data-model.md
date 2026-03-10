# Data Model

## Core Entities

### users
Managed by Supabase Auth. Extended via `profiles` table.

### profiles
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (FK → auth.users) | |
| full_name | text | |
| avatar_url | text | |
| role | enum (consumer, retailer, admin) | |
| created_at | timestamptz | |

### retailers
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | |
| owner_id | uuid (FK → profiles) | |
| name | text | |
| description | text | |
| address | text | |
| location | geography(Point) | PostGIS point for geo queries |
| category | text | |
| logo_url | text | |
| qr_code | text | Unique QR code identifier |
| status | enum (pending, approved, suspended) | |
| created_at | timestamptz | |

### visits
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | |
| consumer_id | uuid (FK → profiles) | |
| retailer_id | uuid (FK → retailers) | |
| points_earned | int | |
| scanned_at | timestamptz | |

### rewards
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | |
| retailer_id | uuid (FK → retailers) | nullable = platform reward |
| name | text | |
| description | text | |
| points_cost | int | |
| is_active | bool | |

### redemptions
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | |
| consumer_id | uuid (FK → profiles) | |
| reward_id | uuid (FK → rewards) | |
| redeemed_at | timestamptz | |

## Key Relationships

```
profiles ──< visits >── retailers
profiles ──< redemptions >── rewards
retailers ──< rewards
retailers has one owner (profiles)
```
