// offer_availability.dart
// Server-authoritative availability state for a single offer.
// Returned by get_retailer_offers_availability and get_offer_availability RPCs.
// Flutter must not compute availability from local state — always use the RPC result.

enum OfferAvailabilityState {
  // Hidden states — do not show explanation to consumer
  retailerInactive,
  offerExpired,

  // Visible states — show human-friendly reason
  offerNotStarted,
  totalCapReached,
  requiresMembership,
  retailerDailyCapReached,
  lifetimeUsed,
  cooldown,
  dailyCapReached,
  dayRestricted,
  timeRestricted,
  newCustomersOnly,

  // Available
  available,
}

extension OfferAvailabilityStateX on OfferAvailabilityState {
  static OfferAvailabilityState fromString(String value) {
    switch (value) {
      case 'retailer_inactive':
        return OfferAvailabilityState.retailerInactive;
      case 'offer_expired':
        return OfferAvailabilityState.offerExpired;
      case 'offer_not_started':
        return OfferAvailabilityState.offerNotStarted;
      case 'total_cap_reached':
        return OfferAvailabilityState.totalCapReached;
      case 'requires_membership':
        return OfferAvailabilityState.requiresMembership;
      case 'retailer_daily_cap_reached':
        return OfferAvailabilityState.retailerDailyCapReached;
      case 'lifetime_used':
        return OfferAvailabilityState.lifetimeUsed;
      case 'cooldown':
        return OfferAvailabilityState.cooldown;
      case 'daily_cap_reached':
        return OfferAvailabilityState.dailyCapReached;
      case 'day_restricted':
        return OfferAvailabilityState.dayRestricted;
      case 'time_restricted':
        return OfferAvailabilityState.timeRestricted;
      case 'new_customers_only':
        return OfferAvailabilityState.newCustomersOnly;
      case 'available':
        return OfferAvailabilityState.available;
      default:
        // Unknown state — treat as unavailable
        return OfferAvailabilityState.offerExpired;
    }
  }

  bool get isAvailable => this == OfferAvailabilityState.available;

  /// Whether to show this offer in the consumer UI at all.
  /// Hidden states are silently excluded from the offer list.
  bool get isVisible {
    switch (this) {
      case OfferAvailabilityState.retailerInactive:
      case OfferAvailabilityState.offerExpired:
        return false;
      default:
        return true;
    }
  }

  /// Whether to show a paywall CTA instead of the availability reason.
  bool get requiresMembership =>
      this == OfferAvailabilityState.requiresMembership;

  /// Whether the state has a reset time the consumer should see.
  bool get hasResetTime {
    switch (this) {
      case OfferAvailabilityState.offerNotStarted:
      case OfferAvailabilityState.retailerDailyCapReached:
      case OfferAvailabilityState.cooldown:
      case OfferAvailabilityState.dailyCapReached:
      case OfferAvailabilityState.dayRestricted:
      case OfferAvailabilityState.timeRestricted:
        return true;
      default:
        return false;
    }
  }

  /// Short badge label shown on the offer card for unavailable-but-visible offers.
  String? get badgeLabel {
    switch (this) {
      case OfferAvailabilityState.requiresMembership:
        return 'Members only';
      case OfferAvailabilityState.offerNotStarted:
        return 'Coming soon';
      case OfferAvailabilityState.totalCapReached:
      case OfferAvailabilityState.lifetimeUsed:
        return 'Fully claimed';
      case OfferAvailabilityState.retailerDailyCapReached:
      case OfferAvailabilityState.dailyCapReached:
        return 'Try tomorrow';
      case OfferAvailabilityState.cooldown:
        return 'Used recently';
      case OfferAvailabilityState.dayRestricted:
        return 'Day restricted';
      case OfferAvailabilityState.timeRestricted:
        return 'Time restricted';
      case OfferAvailabilityState.newCustomersOnly:
        return 'New customers only';
      case OfferAvailabilityState.available:
      case OfferAvailabilityState.retailerInactive:
      case OfferAvailabilityState.offerExpired:
        return null;
    }
  }

  /// Human-friendly explanation shown on the offer detail CTA area.
  String? get ctaExplanation {
    switch (this) {
      case OfferAvailabilityState.offerNotStarted:
        return 'This offer isn\'t available yet.';
      case OfferAvailabilityState.totalCapReached:
        return 'This offer has been fully claimed.';
      case OfferAvailabilityState.lifetimeUsed:
        return 'You\'ve already used this offer.';
      case OfferAvailabilityState.retailerDailyCapReached:
        return 'You\'ve used the maximum number of offers at this retailer today. Try again tomorrow.';
      case OfferAvailabilityState.dailyCapReached:
        return 'You\'ve used this offer today. Try again tomorrow.';
      case OfferAvailabilityState.cooldown:
        return 'You need to wait a bit before using this offer again.';
      case OfferAvailabilityState.dayRestricted:
        return 'This offer isn\'t available today.';
      case OfferAvailabilityState.timeRestricted:
        return 'This offer is only available during certain hours.';
      case OfferAvailabilityState.newCustomersOnly:
        return 'This offer is for new customers only.';
      case OfferAvailabilityState.requiresMembership:
      case OfferAvailabilityState.available:
      case OfferAvailabilityState.retailerInactive:
      case OfferAvailabilityState.offerExpired:
        return null;
    }
  }

  /// Sort weight: lower = shown first in offer list.
  int get sortWeight {
    switch (this) {
      case OfferAvailabilityState.available:
        return 0;
      case OfferAvailabilityState.requiresMembership:
        return 1;
      // Timed — has a reset time, so worth showing prominently
      case OfferAvailabilityState.offerNotStarted:
      case OfferAvailabilityState.retailerDailyCapReached:
      case OfferAvailabilityState.cooldown:
      case OfferAvailabilityState.dailyCapReached:
      case OfferAvailabilityState.dayRestricted:
      case OfferAvailabilityState.timeRestricted:
        return 2;
      // Permanent caps
      case OfferAvailabilityState.totalCapReached:
      case OfferAvailabilityState.lifetimeUsed:
      case OfferAvailabilityState.newCustomersOnly:
        return 3;
      // Hidden — should be filtered before sorting, but give them highest weight
      case OfferAvailabilityState.retailerInactive:
      case OfferAvailabilityState.offerExpired:
        return 4;
    }
  }
}

class OfferAvailability {
  final String offerId;
  final OfferAvailabilityState state;
  final DateTime? availableAt;

  const OfferAvailability({
    required this.offerId,
    required this.state,
    this.availableAt,
  });

  factory OfferAvailability.fromMap(Map<String, dynamic> map) {
    return OfferAvailability(
      offerId: map['offer_id'] as String,
      state: OfferAvailabilityStateX.fromString(
        map['availability_state'] as String? ?? '',
      ),
      availableAt: map['available_at'] != null
          ? DateTime.parse(map['available_at'] as String)
          : null,
    );
  }

  bool get isAvailable => state.isAvailable;
  bool get isVisible => state.isVisible;
}
