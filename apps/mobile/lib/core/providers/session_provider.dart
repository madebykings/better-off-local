import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/supabase_service.dart';

/// Provides the current Supabase [Session], or null if unauthenticated.
/// The router uses this to enforce authentication and trigger redirects.
final sessionProvider = StreamProvider<Session?>((ref) {
  return SupabaseService.auth.onAuthStateChange.map((event) => event.session);
});
