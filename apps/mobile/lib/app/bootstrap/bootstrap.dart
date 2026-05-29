import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/env.dart';
import '../app.dart';

Future<void> bootstrap() async {
  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
    // Explicit options so session persistence behaviour is unambiguous.
    // persistSession=true (default) stores the session in SharedPreferences.
    // autoRefreshToken=true refreshes the JWT before it expires.
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );

  runApp(
    const ProviderScope(
      child: App(),
    ),
  );
}
