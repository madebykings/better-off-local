import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';

/// Categories browse is handled via the Explore screen filter bar.
/// This screen redirects immediately rather than showing a dead end.
class CategoriesScreen extends StatelessWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.go(RouteNames.explore);
    });
    return const SizedBox.shrink();
  }
}
