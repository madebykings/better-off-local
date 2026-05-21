import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/widgets/primary_button.dart';
import '../providers/membership_providers.dart';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/// Shown after a successful Stripe Checkout redirect via deep link.
///
/// On arrival the membership provider is invalidated so the server state is
/// re-fetched. The Stripe webhook may not have fired yet — if the card screen
/// still shows inactive, a pull-to-refresh will re-check.
class SubscriptionSuccessScreen extends ConsumerStatefulWidget {
  const SubscriptionSuccessScreen({super.key});

  @override
  ConsumerState<SubscriptionSuccessScreen> createState() =>
      _SubscriptionSuccessScreenState();
}

class _SubscriptionSuccessScreenState
    extends ConsumerState<SubscriptionSuccessScreen>
    with TickerProviderStateMixin {
  late final AnimationController _checkCtrl;
  late final AnimationController _contentCtrl;

  late final Animation<double> _checkScale;
  late final Animation<double> _checkFade;
  late final Animation<double> _ringExpand;
  late final Animation<double> _contentFade;
  late final Animation<Offset> _contentSlide;

  @override
  void initState() {
    super.initState();

    _checkCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _contentCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 480),
    );

    _checkScale = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
          parent: _checkCtrl,
          curve: const Interval(0.0, 0.65, curve: Curves.elasticOut)),
    );
    _checkFade = CurvedAnimation(
      parent: _checkCtrl,
      curve: const Interval(0.0, 0.25),
    );
    // Outer ring expands and fades out — adds depth to the entrance.
    _ringExpand = CurvedAnimation(
      parent: _checkCtrl,
      curve: const Interval(0.1, 0.8, curve: Curves.easeOut),
    );
    _contentFade = CurvedAnimation(parent: _contentCtrl, curve: Curves.easeOut);
    _contentSlide = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _contentCtrl, curve: Curves.easeOutCubic),
    );

    // Sequence: checkmark → then body content fades in.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkCtrl.forward().then((_) {
        if (mounted) _contentCtrl.forward();
      });
      // Reload membership from the server — webhook may have already activated it.
      ref.invalidate(currentMembershipProvider);
    });
  }

  @override
  void dispose() {
    _checkCtrl.dispose();
    _contentCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.cream,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
          child: Column(
            children: [
              const Spacer(flex: 2),

              // ── Animated checkmark
              _AnimatedCheckmark(
                scaleAnim: _checkScale,
                fadeAnim: _checkFade,
                ringAnim: _ringExpand,
              ),

              const SizedBox(height: AppSpacing.xl),

              // ── Body copy
              SlideTransition(
                position: _contentSlide,
                child: FadeTransition(
                  opacity: _contentFade,
                  child: const Column(
                    children: [
                      Text(
                        "You're a member!",
                        style: AppTextStyles.displayLarge,
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: AppSpacing.sm),
                      Text(
                        'Your membership is active. Start exploring\n'
                        'exclusive local deals in Clackmannanshire.',
                        style: AppTextStyles.bodyMedium,
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: AppSpacing.lg),

                      // ── Membership status pill
                      _MemberBadge(),
                    ],
                  ),
                ),
              ),

              const Spacer(flex: 3),

              // ── CTAs
              FadeTransition(
                opacity: _contentFade,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    PrimaryButton(
                      label: 'Explore offers',
                      onPressed: () => context.go(RouteNames.home),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextButton(
                      onPressed: () => context.go(RouteNames.card),
                      child: const Text('View my membership pass'),
                    ),
                    const SizedBox(height: AppSpacing.md),
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
// Animated checkmark — scale in with elasticOut + outer ring halo
// ---------------------------------------------------------------------------

class _AnimatedCheckmark extends StatelessWidget {
  const _AnimatedCheckmark({
    required this.scaleAnim,
    required this.fadeAnim,
    required this.ringAnim,
  });

  final Animation<double> scaleAnim;
  final Animation<double> fadeAnim;
  final Animation<double> ringAnim;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      height: 120,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Expanding outer ring — fades out as it grows.
          AnimatedBuilder(
            animation: ringAnim,
            builder: (_, __) => Opacity(
              opacity: (1.0 - ringAnim.value).clamp(0.0, 0.35),
              child: Transform.scale(
                scale: 0.6 + 0.8 * ringAnim.value,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.primary,
                      width: 2,
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Check circle
          FadeTransition(
            opacity: fadeAnim,
            child: ScaleTransition(
              scale: scaleAnim,
              child: Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primary,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.28),
                      blurRadius: 28,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.check,
                  color: Colors.white,
                  size: 42,
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
// Member badge — shows active membership status pill
// ---------------------------------------------------------------------------

class _MemberBadge extends StatelessWidget {
  const _MemberBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.16),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Live indicator dot
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.success,
              boxShadow: [
                BoxShadow(
                  color: AppColors.success.withValues(alpha: 0.5),
                  blurRadius: 4,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          const Text(
            'Better Off Local member · Active',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }
}
