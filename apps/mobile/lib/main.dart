import 'dart:async';

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/material.dart';

import 'app/bootstrap/bootstrap.dart';

void main() {
  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();
      await bootstrap();
    },
    (error, stack) {
      // Zone-level catch-all for any error that escapes all other handlers.
      // By the time async errors reach here, bootstrap has already run and
      // Crashlytics is wired.  If Firebase failed (no config files, emulator),
      // the recordError call itself throws and we fall back to debugPrint.
      try {
        FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      } catch (_) {
        debugPrint('[Zone] uncaught error (pre-Crashlytics): $error\n$stack');
      }
    },
  );
}
