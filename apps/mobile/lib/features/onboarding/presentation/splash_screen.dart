import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/widgets/brand_logo.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _navigate();
  }

  Future<void> _navigate() async {
    // Run the minimum splash delay and session resolution in parallel.
    // If auth resolves before 1500 ms the splash still shows for the full
    // duration. If auth is slower (cold-start / token refresh), we wait —
    // avoiding the race where valueOrNull returns null for a still-loading
    // session and sends an authenticated user to the welcome screen.
    await Future.wait([
      Future<void>.delayed(const Duration(milliseconds: 1500)),
      ref.read(sessionProvider.future).then<void>((_) {}).catchError((_) {}),
    ]);
    if (!mounted) return;

    final session = ref.read(sessionProvider).valueOrNull;
    if (session != null) {
      context.go(RouteNames.home);
    } else {
      context.go(RouteNames.welcome);
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            BrandLogo(variant: BrandLogoVariant.horizontal, height: 72),
          ],
        ),
      ),
    );
  }
}
