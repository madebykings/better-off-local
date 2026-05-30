import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../data/category_follows_data_source.dart';

final categoryFollowsDataSourceProvider =
    Provider<CategoryFollowsDataSource>(
  (ref) => CategoryFollowsDataSource(ref.watch(supabaseClientProvider)),
);

/// Set of category IDs the current member follows.
final followedCategoryIdsProvider =
    FutureProvider<Set<String>>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return {};
  return ref
      .read(categoryFollowsDataSourceProvider)
      .fetchFollowedCategoryIds(session.user.id);
});

/// Toggle follow/unfollow for a category — optimistic update.
Future<void> toggleCategoryFollow(
  WidgetRef ref,
  String categoryId,
  bool isCurrentlyFollowing,
) async {
  final session = ref.read(sessionProvider).valueOrNull;
  if (session == null) return;

  final ds = ref.read(categoryFollowsDataSourceProvider);
  try {
    if (isCurrentlyFollowing) {
      await ds.unfollow(session.user.id, categoryId);
    } else {
      await ds.follow(session.user.id, categoryId);
    }
    ref.invalidate(followedCategoryIdsProvider);
  } catch (_) {
    // Non-fatal — user can retry by tapping again
  }
}
