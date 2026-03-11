import 'membership.dart';

abstract class MembershipRepository {
  /// Fetch the active membership for the current authenticated user.
  Future<Membership?> getCurrentMembership();

  /// Fetch membership by ID.
  Future<Membership?> getMembership(String membershipId);
}
