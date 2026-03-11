import 'package:equatable/equatable.dart';

enum MembershipStatus { active, expired, cancelled, none }

class Membership extends Equatable {
  const Membership({
    required this.id,
    required this.userId,
    required this.status,
    required this.expiresAt,
  });

  final String id;
  final String userId;
  final MembershipStatus status;
  final DateTime expiresAt;

  bool get isActive => status == MembershipStatus.active &&
      expiresAt.isAfter(DateTime.now());

  @override
  List<Object?> get props => [id, userId, status, expiresAt];
}
