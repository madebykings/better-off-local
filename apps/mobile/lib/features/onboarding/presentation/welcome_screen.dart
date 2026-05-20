import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../../core/widgets/primary_button.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              const BrandLogo(variant: BrandLogoVariant.horizontal, height: 56),
              const SizedBox(height: 24),
              Text(
                'Discover offers from local independent retailers near you.',
                style: Theme.of(context).textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              PrimaryButton(
                label: 'Get started',
                onPressed: () => context.go(RouteNames.signUp),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => context.go(RouteNames.signIn),
                child: const Text('I already have an account'),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
