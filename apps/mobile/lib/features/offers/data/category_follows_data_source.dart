import 'package:supabase_flutter/supabase_flutter.dart';

class CategoryFollowsDataSource {
  const CategoryFollowsDataSource(this._client);
  final SupabaseClient _client;

  Future<Set<String>> fetchFollowedCategoryIds(String profileId) async {
    final rows = await _client
        .from('category_follows')
        .select('category_id')
        .eq('profile_id', profileId);
    return {for (final r in rows) r['category_id'] as String};
  }

  Future<void> follow(String profileId, String categoryId) async {
    // ignoreDuplicates=true → ON CONFLICT DO NOTHING, requires only INSERT.
    // DO UPDATE would require UPDATE grant; category_follows has no mutable
    // columns so a conflict is always a no-op anyway.
    await _client.from('category_follows').upsert(
      {'profile_id': profileId, 'category_id': categoryId},
      onConflict: 'profile_id,category_id',
      ignoreDuplicates: true,
    );
  }

  Future<void> unfollow(String profileId, String categoryId) async {
    await _client
        .from('category_follows')
        .delete()
        .eq('profile_id', profileId)
        .eq('category_id', categoryId);
  }
}
