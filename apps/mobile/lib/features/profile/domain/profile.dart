import 'package:equatable/equatable.dart';

enum UserRole { consumer, retailerUser, admin }

UserRole _roleFromString(String value) => switch (value) {
      'retailer_user' => UserRole.retailerUser,
      'admin' => UserRole.admin,
      _ => UserRole.consumer,
    };

class Profile extends Equatable {
  const Profile({
    required this.id,
    required this.role,
    required this.isActive,
    this.fullName,
    this.email,
    this.phone,
    this.avatarUrl,
    this.regionId,
    this.paypalEmail,
  });

  final String id;
  final UserRole role;
  final bool isActive;
  final String? fullName;
  final String? email;
  final String? phone;
  final String? avatarUrl;
  final String? regionId;
  final String? paypalEmail;

  bool get isComplete => fullName != null && fullName!.trim().isNotEmpty;
  bool get hasRegion => regionId != null;

  factory Profile.fromMap(Map<String, dynamic> map) {
    return Profile(
      id: map['id'] as String,
      role: _roleFromString(map['role'] as String? ?? 'consumer'),
      isActive: map['is_active'] as bool? ?? true,
      fullName: map['full_name'] as String?,
      email: map['email'] as String?,
      phone: map['phone'] as String?,
      avatarUrl: map['avatar_url'] as String?,
      regionId: map['region_id'] as String?,
      paypalEmail: map['paypal_email'] as String?,
    );
  }

  Profile copyWith({
    String? fullName,
    String? phone,
    String? avatarUrl,
    String? regionId,
    String? paypalEmail,
    bool clearPaypalEmail = false,
  }) {
    return Profile(
      id: id,
      role: role,
      isActive: isActive,
      fullName: fullName ?? this.fullName,
      email: email,
      phone: phone ?? this.phone,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      regionId: regionId ?? this.regionId,
      paypalEmail: clearPaypalEmail ? null : (paypalEmail ?? this.paypalEmail),
    );
  }

  @override
  List<Object?> get props => [id, role, isActive, fullName, email, phone, avatarUrl, regionId, paypalEmail];
}
