import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../data/loyalty_remote_data_source.dart';
import '../domain/loyalty_card.dart';

final loyaltyDataSourceProvider = Provider<LoyaltyRemoteDataSource>(
  (ref) => LoyaltyRemoteDataSource(ref.watch(supabaseClientProvider)),
);

/// All loyalty cards for the current user.
final myLoyaltyCardsProvider = FutureProvider<List<LoyaltyCard>>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return [];
  final rows = await ref
      .read(loyaltyDataSourceProvider)
      .fetchMyCards(session.user.id);
  return rows.map(LoyaltyCard.fromMap).toList();
});

/// Loyalty card for a specific offer (may be null if not yet started).
final loyaltyCardForOfferProvider =
    FutureProvider.family<LoyaltyCard?, String>((ref, offerId) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return null;
  final row = await ref
      .read(loyaltyDataSourceProvider)
      .fetchCardForOffer(session.user.id, offerId);
  if (row == null) return null;
  return LoyaltyCard.fromMap(row);
});

/// Loyalty config for a specific offer (stamps_required, reward_description, etc.)
final loyaltyConfigProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((ref, offerId) async {
  return await ref
      .read(loyaltyDataSourceProvider)
      .fetchLoyaltyConfig(offerId);
});
