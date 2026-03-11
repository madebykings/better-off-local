import 'package:supabase_flutter/supabase_flutter.dart';

// TODO: implement membership data source
// Queries the memberships table via Supabase for the current user.
class MembershipRemoteDataSource {
  const MembershipRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<Map<String, dynamic>?> fetchCurrentMembership(String userId) async {
    // TODO: implement
    throw UnimplementedError();
  }
}
