import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/primary_button.dart';
import 'membership_controller.dart';

class PaywallScreen extends ConsumerStatefulWidget {
  const PaywallScreen({super.key});

  @override
  ConsumerState<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends ConsumerState<PaywallScreen> {
  String _selectedPlan = 'annual';

  void _selectPlan(String plan) => setState(() => _selectedPlan = plan);

  Future<void> _subscribe() async {
    await ref
        .read(membershipControllerProvider.notifier)
        .startCheckout(plan: _selectedPlan);
  }

  @override
  Widget build(BuildContext context) {
    final controllerState = ref.watch(membershipControllerProvider);
    final isLoading = controllerState is MembershipLoading;

    ref.listen<MembershipControllerState>(
      membershipControllerProvider,
      (_, next) async {
        if (next is MembershipCheckoutReady) {
          final uri = Uri.parse(next.url);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          } else {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Could not open checkout. Please try again.'),
                ),
              );
            }
          }
          // Reset so a future tap works correctly.
          ref.read(membershipControllerProvider.notifier).reset();
        }
        if (next is MembershipControllerError) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(next.message)),
            );
          }
          ref.read(membershipControllerProvider.notifier).reset();
        }
      },
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Become a member'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.pagePadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.md),
              // Header
              Text(
                'Better Off Local',
                style: AppTextStyles.displayLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Get unlimited access to exclusive local discounts\nin Clackmannanshire.',
                style: AppTextStyles.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xl),

              // Plan cards
              _PlanCard(
                label: 'Annual',
                price: '£49.99',
                period: 'per year',
                badge: 'Best value',
                description: 'Save over 30% vs monthly',
                isSelected: _selectedPlan == 'annual',
                onTap: () => _selectPlan('annual'),
              ),
              const SizedBox(height: AppSpacing.md),
              _PlanCard(
                label: 'Monthly',
                price: '£5.99',
                period: 'per month',
                isSelected: _selectedPlan == 'monthly',
                onTap: () => _selectPlan('monthly'),
              ),

              const SizedBox(height: AppSpacing.xl),

              // Benefits
              const _BenefitRow(text: 'Access all local member discounts'),
              const _BenefitRow(text: 'Digital membership card'),
              const _BenefitRow(text: 'Instant QR redemption'),
              const _BenefitRow(text: 'New offers added regularly'),
              const _BenefitRow(text: 'Cancel anytime'),

              const SizedBox(height: AppSpacing.xl),

              PrimaryButton(
                label: 'Subscribe now',
                isLoading: isLoading,
                onPressed: _subscribe,
              ),

              const SizedBox(height: AppSpacing.md),
              Text(
                'Subscriptions renew automatically. Cancel anytime via\nyour account settings. Prices include VAT.',
                style: AppTextStyles.labelSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.label,
    required this.price,
    required this.period,
    required this.isSelected,
    required this.onTap,
    this.badge,
    this.description,
  });

  final String label;
  final String price;
  final String period;
  final bool isSelected;
  final VoidCallback onTap;
  final String? badge;
  final String? description;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        ),
        child: Row(
          children: [
            // Selection indicator
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? AppColors.primary : AppColors.border,
                  width: 2,
                ),
                color: isSelected ? AppColors.primary : Colors.transparent,
              ),
              child: isSelected
                  ? const Icon(Icons.check, size: 14, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: AppSpacing.md),

            // Plan details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(label, style: AppTextStyles.titleMedium),
                      if (badge != null) ...[
                        const SizedBox(width: AppSpacing.sm),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.accent,
                            borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                          ),
                          child: Text(
                            badge!,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (description != null) ...[
                    const SizedBox(height: 2),
                    Text(description!, style: AppTextStyles.bodyMedium),
                  ],
                ],
              ),
            ),

            // Price
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(price, style: AppTextStyles.titleLarge),
                Text(period, style: AppTextStyles.labelSmall),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _BenefitRow extends StatelessWidget {
  const _BenefitRow({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          const Icon(Icons.check_circle_outline,
              size: 18, color: AppColors.success),
          const SizedBox(width: AppSpacing.sm),
          Text(text, style: AppTextStyles.bodyLarge),
        ],
      ),
    );
  }
}
