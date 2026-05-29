import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/supabase_service.dart';

/// Provides the current Supabase [Session], or null if unauthenticated.
/// The router uses this to enforce authentication and trigger redirects.
///
/// Yields [auth.currentSession] synchronously as the first value so the
/// provider is always in AsyncData (never AsyncLoading) from the first read.
/// This eliminates the brief window after cold-start where the router would
/// treat a persisted session as unauthenticated while waiting for the
/// onAuthStateChange initialSession event to fire.
final sessionProvider = StreamProvider<Session?>((ref) async* {
  yield SupabaseService.auth.currentSession;
  yield* SupabaseService.auth.onAuthStateChange.map((e) => e.session);
});
