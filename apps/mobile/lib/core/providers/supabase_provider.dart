import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/supabase_service.dart';

final supabaseClientProvider = Provider<SupabaseClient>(
  (ref) => SupabaseService.client,
);
