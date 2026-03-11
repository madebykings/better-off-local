import 'package:equatable/equatable.dart';

enum MembershipStatus {
  inactive,
  trialing,
  active,
  pastDue,
  cancelled,
  expired,
}

MembershipStatus _statusFromString(String value) => switch (value) {
      'trialing' => MembershipStatus.trialing,
      'active' => MembershipStatus.active,
      'past_due' => MembershipStatus.pastDue,
      'cancelled' => MembershipStatus.cancelled,
      'expired' => MembershipStatus.expired,
      _ => MembershipStatus.inactive,
    };

enum MembershipPlanInterval { monthly, annual }

MembershipPlanInterval? _intervalFromString(String? value) => switch (value) {
      'monthly' => MembershipPlanInterval.monthly,
      'annual' => MembershipPlanInterval.annual,
      _ => null,
    };

class Membership extends Equatable {
  const Membership({
    required this.id,
    required this.profileId,
    required this.status,
    this.planInterval,
    this.stripeCustomerId,
    this.stripeSubscriptionId,
    this.currentPeriodStart,
    this.currentPeriodEnd,
    this.cancelAtPeriodEnd = false,
    this.startedAt,
    this.endedAt,
  });

  final String id;
  final String profileId;
  final MembershipStatus status;
  final MembershipPlanInterval? planInterval;
  final String? stripeCustomerId;
  final String? stripeSubscriptionId;
  final DateTime? currentPeriodStart;
  final DateTime? currentPeriodEnd;
  final bool cancelAtPeriodEnd;
  final DateTime? startedAt;
  final DateTime? endedAt;

  /// True when the user is entitled to redeem offers.
  /// Requires server-confirmed active or trialing status within the current period.
  /// The app reads this from the server — never computed from local state alone.
  bool get isEntitled {
    if (status != MembershipStatus.active &&
        status != MembershipStatus.trialing) {
      return false;
    }
    if (currentPeriodEnd == null) return false;
    return currentPeriodEnd!.isAfter(DateTime.now().toUtc());
  }

  factory Membership.fromMap(Map<String, dynamic> map) {
    return Membership(
      id: map['id'] as String,
      profileId: map['profile_id'] as String,
      status: _statusFromString(map['status'] as String? ?? 'inactive'),
      planInterval: _intervalFromString(map['plan_interval'] as String?),
      stripeCustomerId: map['stripe_customer_id'] as String?,
      stripeSubscriptionId: map['stripe_subscription_id'] as String?,
      currentPeriodStart: map['current_period_start'] != null
          ? DateTime.parse(map['current_period_start'] as String)
          : null,
      currentPeriodEnd: map['current_period_end'] != null
          ? DateTime.parse(map['current_period_end'] as String)
          : null,
      cancelAtPeriodEnd: map['cancel_at_period_end'] as bool? ?? false,
      startedAt: map['started_at'] != null
          ? DateTime.parse(map['started_at'] as String)
          : null,
      endedAt: map['ended_at'] != null
          ? DateTime.parse(map['ended_at'] as String)
          : null,
    );
  }

  @override
  List<Object?> get props => [
        id,
        profileId,
        status,
        planInterval,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      ];
}
