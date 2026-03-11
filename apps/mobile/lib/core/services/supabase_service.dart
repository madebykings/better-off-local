import 'package:supabase_flutter/supabase_flutter.dart';

/// Centralised access point for the Supabase client.
/// Features should access Supabase through their own data sources,
/// not by calling this directly from UI code.
class SupabaseService {
  static SupabaseClient get client => Supabase.instance.client;

  static GoTrueClient get auth => client.auth;

  static SupabaseStorageClient get storage => client.storage;

  static RealtimeClient get realtime => client.realtime;
}
