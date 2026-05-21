import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../../core/widgets/primary_button.dart';
import 'membership_controller.dart';

// ---------------------------------------------------------------------------
// Paywall trial config
//
// Set [_kTrialDays] to a positive integer to activate trial UI.
// The CTA label and a banner below the headline update automatically.
// No changes to checkout logic are needed — this is display only.
// ---------------------------------------------------------------------------
const int _kTrialDays = 0; // e.g. 7 for a 7-day free trial
const bool _kShowTrial = _kTrialDays > 0;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class PaywallScreen extends ConsumerStatefulWidget {
  const PaywallScreen({super.key});

  @override
  ConsumerState<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends ConsumerState<PaywallScreen>
    with SingleTickerProviderStateMixin {
  String _selectedPlan = 'annual';

  late final AnimationController _entranceCtrl;
  late final Animation<Offset> _slideAnim;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _entranceCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.10),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _entranceCtrl, curve: Curves.easeOutCubic),
    );
    _fadeAnim = CurvedAnimation(parent: _entranceCtrl, curve: Curves.easeOut);
    _entranceCtrl.forward();
  }

  @override
  void dispose() {
    _entranceCtrl.dispose();
    super.dispose();
  }

  void _selectPlan(String plan) => setState(() => _selectedPlan = plan);

  Future<void> _startCheckout() async {
    await ref
        .read(membershipControllerProvider.notifier)
        .startCheckout(plan: _selectedPlan);
  }

  @override
  Widget build(BuildContext context) {
    final ctrlState = ref.watch(membershipControllerProvider);
    final isLoading = ctrlState is MembershipLoading;

    ref.listen<MembershipControllerState>(membershipControllerProvider,
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
        ref.read(membershipControllerProvider.notifier).reset();
      }
      if (next is MembershipControllerError) {
        if (mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(next.message)));
        }
        ref.read(membershipControllerProvider.notifier).reset();
      }
    });

    return Scaffold(
      // Deep green fills behind the hero and peeks above the card on overscroll.
      backgroundColor: AppColors.primary,
      body: Stack(
        children: [
          // ── Hero — always visible behind the white card
          const _HeroSection(),

          // ── White card slides up from below on entrance
          SlideTransition(
            position: _slideAnim,
            child: FadeTransition(
              opacity: _fadeAnim,
              child: Column(
                children: [
                  // Transparent gap so the hero is visible above.
                  const SizedBox(height: 210),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(28),
                      ),
                      child: Container(
                        color: AppColors.cream,
                        child: SingleChildScrollView(
                          padding:
                              const EdgeInsets.fromLTRB(20, 28, 20, 44),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const _SheetHandle(),
                              const SizedBox(height: 20),
                              const _SectionHeadline(
                                title: 'Choose your plan',
                                subtitle:
                                    'Access every offer from every local business.',
                              ),
                              const SizedBox(height: 18),

                              // ── Trial banner — visible only when _kShowTrial
                              if (_kShowTrial) ...[
                                const _TrialBanner(),
                                const SizedBox(height: 16),
                              ],

                              // ── Annual plan card (pre-selected)
                              _AnnualPlanCard(
                                isSelected: _selectedPlan == 'annual',
                                onTap: () => _selectPlan('annual'),
                              ),
                              const SizedBox(height: 10),

                              // ── Monthly plan card
                              _MonthlyPlanCard(
                                isSelected: _selectedPlan == 'monthly',
                                onTap: () => _selectPlan('monthly'),
                              ),
                              const SizedBox(height: 28),

                              // ── Feature highlights
                              const _FeatureRow(),
                              const SizedBox(height: 28),

                              // ── CTA
                              PrimaryButton(
                                label: _kShowTrial
                                    ? 'Start $_kTrialDays-day free trial'
                                    : (_selectedPlan == 'annual'
                                        ? 'Get started · £49.99/year'
                                        : 'Get started · £5.99/month'),
                                isLoading: isLoading,
                                onPressed: _startCheckout,
                              ),
                              const SizedBox(height: 20),
                              const _TrustIndicators(),
                              const SizedBox(height: 16),
                              const _LegalFooter(),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Close button overlay
          SafeArea(
            child: Align(
              alignment: Alignment.topLeft,
              child: Padding(
                padding: const EdgeInsets.only(left: 4, top: 4),
                child: IconButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.close, color: Colors.white, size: 22),
                  tooltip: 'Close',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Hero section — dark green gradient with branding and social proof
// ---------------------------------------------------------------------------

class _HeroSection extends StatelessWidget {
  const _HeroSection();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 260,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      // Subtle diagonal texture overlay — low opacity lines.
      child: CustomPaint(
        painter: _HeroDiagonalPainter(),
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 56, 24, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Membership emblem chip
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: Colors.white.withValues(alpha: 0.2), width: 1),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 7),
                      const BrandLogo(
                        variant: BrandLogoVariant.horizontal,
                        scheme: BrandLogoScheme.dark,
                        height: 14,
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'Membership',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.1,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // Headline
                const Text(
                  'Discover the best\nof local.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 30,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.5,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 8),

                // Subtext
                Text(
                  'Member discounts at independent businesses\nin Clackmannanshire.',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.68),
                    fontSize: 14,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Faint diagonal lines in hero background for texture.
class _HeroDiagonalPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.03)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    const spacing = 28.0;
    var x = -size.height.toDouble();
    while (x < size.width + size.height) {
      canvas.drawLine(
        Offset(x, 0),
        Offset(x + size.height, size.height),
        paint,
      );
      x += spacing;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter _) => false;
}

// ---------------------------------------------------------------------------
// Sheet handle — small pill at top of white card
// ---------------------------------------------------------------------------

class _SheetHandle extends StatelessWidget {
  const _SheetHandle();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 36,
        height: 4,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Section headline
// ---------------------------------------------------------------------------

class _SectionHeadline extends StatelessWidget {
  const _SectionHeadline({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppTextStyles.headlineMedium),
        const SizedBox(height: 4),
        Text(subtitle, style: AppTextStyles.bodyMedium),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Radio dot — shared selection indicator used in plan cards
// ---------------------------------------------------------------------------

class _RadioDot extends StatelessWidget {
  const _RadioDot({required this.isSelected});
  final bool isSelected;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: isSelected ? Colors.white : AppColors.border,
          width: 2,
        ),
        color: isSelected
            ? Colors.white.withValues(alpha: 0.18)
            : Colors.transparent,
      ),
      child: isSelected
          ? const Icon(Icons.check, size: 13, color: Colors.white)
          : null,
    );
  }
}

// ---------------------------------------------------------------------------
// Annual plan card — larger, pre-selected, with savings strip
// ---------------------------------------------------------------------------

class _AnnualPlanCard extends StatelessWidget {
  const _AnnualPlanCard({
    required this.isSelected,
    required this.onTap,
  });

  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeInOut,
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 0 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.28),
                    blurRadius: 20,
                    offset: const Offset(0, 7),
                  )
                ]
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  )
                ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Top row: radio · label + badge · price
              Row(
                children: [
                  _RadioDot(isSelected: isSelected),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Row(
                      children: [
                        Text(
                          'Annual',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: isSelected
                                ? Colors.white
                                : AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(width: 8),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? Colors.white.withValues(alpha: 0.18)
                                : AppColors.accent.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            'Best value',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: isSelected
                                  ? Colors.white
                                  : AppColors.accent,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '£49.99',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.4,
                          color: isSelected
                              ? Colors.white
                              : AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        'per year',
                        style: TextStyle(
                          fontSize: 12,
                          color: isSelected
                              ? Colors.white.withValues(alpha: 0.65)
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              // ── Savings strip
              const SizedBox(height: 13),
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 9),
                decoration: BoxDecoration(
                  color: isSelected
                      ? Colors.white.withValues(alpha: 0.10)
                      : AppColors.primary.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.savings_outlined,
                      size: 14,
                      color: isSelected
                          ? Colors.white.withValues(alpha: 0.80)
                          : AppColors.primary,
                    ),
                    const SizedBox(width: 7),
                    Text(
                      'Just £4.17/month · Save £21.89 vs monthly',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: isSelected
                            ? Colors.white.withValues(alpha: 0.85)
                            : AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Monthly plan card — compact
// ---------------------------------------------------------------------------

class _MonthlyPlanCard extends StatelessWidget {
  const _MonthlyPlanCard({
    required this.isSelected,
    required this.onTap,
  });

  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 0 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.28),
                    blurRadius: 20,
                    offset: const Offset(0, 7),
                  )
                ]
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  )
                ],
        ),
        child: Row(
          children: [
            _RadioDot(isSelected: isSelected),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Monthly',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: isSelected
                          ? Colors.white
                          : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Flexible · cancel anytime',
                    style: TextStyle(
                      fontSize: 12,
                      color: isSelected
                          ? Colors.white.withValues(alpha: 0.65)
                          : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '£5.99',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.4,
                    color: isSelected ? Colors.white : AppColors.textPrimary,
                  ),
                ),
                Text(
                  'per month',
                  style: TextStyle(
                    fontSize: 12,
                    color: isSelected
                        ? Colors.white.withValues(alpha: 0.65)
                        : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Feature row — three tiles showing membership value
// ---------------------------------------------------------------------------

class _FeatureRow extends StatelessWidget {
  const _FeatureRow();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Expanded(
          child: _FeatureTile(
            icon: Icons.local_offer_outlined,
            title: 'All local\noffers',
            subtitle: 'Every participating\nretailer',
          ),
        ),
        SizedBox(width: 10),
        Expanded(
          child: _FeatureTile(
            icon: Icons.credit_card_outlined,
            title: 'Digital\nmember pass',
            subtitle: 'Instant QR\nredemption',
          ),
        ),
        SizedBox(width: 10),
        Expanded(
          child: _FeatureTile(
            icon: Icons.people_outline,
            title: 'Most\npopular',
            subtitle: 'Chosen by\nmembers',
          ),
        ),
      ],
    );
  }
}

class _FeatureTile extends StatelessWidget {
  const _FeatureTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(13, 14, 13, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.primary, size: 22),
          const SizedBox(height: 9),
          Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 10.5,
              color: AppColors.textSecondary,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Trial banner — shown only when _kShowTrial is true
// ---------------------------------------------------------------------------

class _TrialBanner extends StatelessWidget {
  const _TrialBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.18)),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.primary.withValues(alpha: 0.10),
            ),
            child: const Icon(
              Icons.card_giftcard_outlined,
              size: 17,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Try free for $_kTrialDays days',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  'No charge until your trial ends. Cancel anytime.',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: AppColors.primary.withValues(alpha: 0.70),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Trust indicators — shown below CTA
// ---------------------------------------------------------------------------

class _TrustIndicators extends StatelessWidget {
  const _TrustIndicators();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        _TrustItem('Local independent businesses'),
        SizedBox(height: 5),
        _TrustItem('Secure payments'),
        SizedBox(height: 5),
        _TrustItem('Manage membership in settings'),
      ],
    );
  }
}

class _TrustItem extends StatelessWidget {
  const _TrustItem(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.check, size: 13, color: AppColors.success),
        const SizedBox(width: 6),
        Text(
          text,
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Legal footer
// ---------------------------------------------------------------------------

class _LegalFooter extends StatelessWidget {
  const _LegalFooter();

  @override
  Widget build(BuildContext context) {
    return const Text(
      'Renews automatically at the end of each billing period.\n'
      'Cancel anytime via your account settings. Prices include VAT.',
      style: TextStyle(
        fontSize: 11,
        color: AppColors.textDisabled,
        height: 1.65,
      ),
      textAlign: TextAlign.center,
    );
  }
}
