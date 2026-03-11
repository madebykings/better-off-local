-- 017_indexes.sql
-- Performance indexes for common query patterns

-- profiles
create index idx_profiles_role on profiles(role);

-- consumer_memberships
create index idx_consumer_memberships_profile_status on consumer_memberships(profile_id, status);
create index idx_consumer_memberships_stripe_sub on consumer_memberships(stripe_subscription_id);

-- retailer_subscriptions
create index idx_retailer_subscriptions_retailer_status on retailer_subscriptions(retailer_id, status);
create index idx_retailer_subscriptions_stripe_sub on retailer_subscriptions(stripe_subscription_id);

-- retailers
create index idx_retailers_approval_visibility on retailers(approval_status, visibility_status);

-- retailer_users
create index idx_retailer_users_profile on retailer_users(profile_id);
create index idx_retailer_users_retailer on retailer_users(retailer_id);

-- retailer_locations
create index idx_retailer_locations_retailer on retailer_locations(retailer_id);
create index idx_retailer_locations_county on retailer_locations(county);

-- offers
create index idx_offers_retailer_status on offers(retailer_id, status);
create index idx_offers_date_window on offers(start_at, end_at);
create index idx_offers_location on offers(retailer_location_id);
create index idx_offers_featured on offers(is_featured) where is_featured = true;

-- redemptions
create index idx_redemptions_profile_offer on redemptions(profile_id, offer_id);
create index idx_redemptions_retailer_date on redemptions(retailer_id, redeemed_at);
create index idx_redemptions_status on redemptions(status);

-- redemption_tokens
create index idx_redemption_tokens_expires on redemption_tokens(expires_at);
create index idx_redemption_tokens_profile on redemption_tokens(profile_id);

-- favourites
create index idx_favourites_profile on favourites(profile_id);

-- offer_views
create index idx_offer_views_offer on offer_views(offer_id);
create index idx_offer_views_retailer on offer_views(retailer_id);

-- notifications
create index idx_notifications_profile_read on notifications(profile_id, read_at);

-- audit_events
create index idx_audit_events_actor on audit_events(actor_id);
create index idx_audit_events_target on audit_events(target_table, target_id);
create index idx_audit_events_created on audit_events(created_at);
