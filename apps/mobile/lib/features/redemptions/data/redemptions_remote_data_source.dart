import 'package:supabase_flutter/supabase_flutter.dart';

class RedemptionsRemoteDataSource {
  const RedemptionsRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<Map<String, dynamic>> requestRedemptionToken(String offerId) async {
    // TODO: call a Supabase Edge Function that validates membership,
    // generates a signed token, and returns it. Do NOT validate client-side.
    throw UnimplementedError();
  }

  Future<List<Map<String, dynamic>>> fetchRedemptionHistory() async {
    // TODO: implement
    throw UnimplementedError();
  }
}
