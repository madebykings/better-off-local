import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/analytics_provider.dart';
import '../../../core/widgets/primary_button.dart';
import '../domain/membership.dart';
import '../providers/membership_providers.dart';

// ---------------------------------------------------------------------------
// Activation state
// ---------------------------------------------------------------------------

sealed class ActivationState {
  const ActivationState();
}

/// Polling in progress — webhook has not yet updated the row.
class ActivationChecking extends ActivationState {
  const ActivationChecking();
}

/// Membership confirmed active — screen will navigate to success.
class ActivationActive extends ActivationState {
  const ActivationActive();
}

/// Polling timed out before membership became active.
/// Most likely the webhook is delayed. User can retry or skip.
class ActivationTimeout extends ActivationState {
  const ActivationTimeout();
}

// ---------------------------------------------------------------------------
// Activation controller
// ---------------------------------------------------------------------------

class ActivationController extends StateNotifier<ActivationState> {
  ActivationController(this._ref) : super(const ActivationChecking()) {
    _startPolling();
  }

  final Ref _ref;
  Timer? _pollTimer;
  Timer? _timeoutTimer;
  int _pollCount = 0;

  /// Exponential backoff schedule: immediate → 1s → 2s → 4s → 5s (cap).
  /// Once the cap is reached every subsequent interval stays at 5 seconds.
  static const _backoffDelays = [
    Duration.zero,
    Duration(seconds: 1),
    Duration(seconds: 2),
    Duration(seconds: 4),
    Duration(seconds: 5), // cap
  ];

  /// Maximum time to wait before showing the timeout state.
  /// Stripe webhooks typically fire within 2–5 seconds of a successful charge.
  static const _timeoutDuration = Duration(seconds: 20);

  void _startPolling() {
    _timeoutTimer?.cancel();
    _pollTimer?.cancel();
    _pollCount = 0;
    _timeoutTimer = Timer(_timeoutDuration, _onTimeout);
    _scheduleNextPoll();
  }

  void _scheduleNextPoll() {
    final index = _pollCount.clamp(0, _backoffDelays.length - 1);
    _pollTimer = Timer(_backoffDelays[index], _poll);
  }

  Future<void> _poll() async {
    if (state is! ActivationChecking) return;
    _pollCount++;

    try {
      // Force a fresh server query by invalidating the cached provider value.
      _ref.invalidate(currentMembershipProvider);
      final membership = await _ref.read(currentMembershipProvider.future);

      if (!mounted) return;

      if (membership != null && membership.isEntitled) {
        _timeoutTimer?.cancel();
        final plan = membership.planInterval?.name ?? 'unknown';
        final amount = membership.planInterval == MembershipPlanInterval.annual
            ? 49.99
            : 5.99;
        unawaited(_ref.read(analyticsServiceProvider).logMembershipPurchased(
              plan: plan,
              amountGbp: amount,
            ));
        state = const ActivationActive();
        return;
      }
      // Membership not yet active — schedule the next poll with backoff.
    } catch (_) {
      // Network error — continue with the next backoff interval.
    }

    if (state is ActivationChecking) _scheduleNextPoll();
  }

  void _onTimeout() {
    if (state is ActivationChecking) {
      _pollTimer?.cancel();
      state = const ActivationTimeout();
    }
  }

  /// Restart polling after a timeout. Called when the user taps "Check again".
  void retry() {
    state = const ActivationChecking();
    _startPolling();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _timeoutTimer?.cancel();
    super.dispose();
  }
}

/// Auto-disposed so polling stops as soon as the screen is removed from the
/// widget tree — whether by successful navigation or the user backing out.
final activationControllerProvider = StateNotifierProvider.autoDispose<
    ActivationController, ActivationState>(
  (ref) => ActivationController(ref),
);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/// Shown immediately after Stripe redirects back to the app.
///
/// Polls [currentMembershipProvider] until the Stripe webhook has written an
/// active membership row, then navigates to [RouteNames.subscriptionSuccess].
/// A 20-second timeout prevents an indefinite spinner if the webhook is
/// delayed or fails.
class MembershipActivatingScreen extends ConsumerStatefulWidget {
  const MembershipActivatingScreen({super.key});

  @override
  ConsumerState<MembershipActivatingScreen> createState() =>
      _MembershipActivatingScreenState();
}

class _MembershipActivatingScreenState
    extends ConsumerState<MembershipActivatingScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<ActivationState>(activationControllerProvider, (_, next) {
      if (next is ActivationActive) {
        // Brief pause so the active state renders before navigation.
        Future.delayed(const Duration(milliseconds: 700), () {
          if (mounted) context.go(RouteNames.subscriptionSuccess);
        });
      }
    });

    final activationState = ref.watch(activationControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.cream,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.pagePadding),
          child: switch (activationState) {
            ActivationChecking() => _CheckingView(pulseCtrl: _pulseCtrl),
            ActivationActive() => const _ActiveView(),
            ActivationTimeout() => _TimeoutView(
                onRetry: () =>
                    ref.read(activationControllerProvider.notifier).retry(),
                onSkip: () => context.go(RouteNames.home),
              ),
          },
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Checking view — pulsing circle while polling
// ---------------------------------------------------------------------------

class _CheckingView extends StatelessWidget {
  const _CheckingView({required this.pulseCtrl});

  final AnimationController pulseCtrl;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Spacer(flex: 2),

        // Pulsing emblem
        SizedBox(
          width: 130,
          height: 130,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Outer pulse ring — expands and fades on each cycle.
              AnimatedBuilder(
                animation: pulseCtrl,
                builder: (_, __) {
                  final t = pulseCtrl.value;
                  return Opacity(
                    opacity: (1.0 - t).clamp(0.0, 0.28),
                    child: Transform.scale(
                      scale: 0.65 + 0.55 * t,
                      child: Container(
                        width: 130,
                        height: 130,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.primary.withValues(alpha: 0.18),
                        ),
                      ),
                    ),
                  );
                },
              ),

              // Middle ring — offset phase for layered effect.
              AnimatedBuilder(
                animation: pulseCtrl,
                builder: (_, __) {
                  final t = ((pulseCtrl.value + 0.4) % 1.0);
                  return Opacity(
                    opacity: (1.0 - t).clamp(0.0, 0.18),
                    child: Transform.scale(
                      scale: 0.65 + 0.55 * t,
                      child: Container(
                        width: 130,
                        height: 130,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.primary.withValues(alpha: 0.12),
                        ),
                      ),
                    ),
                  );
                },
              ),

              // Solid inner circle with icon.
              Container(
                width: 82,
                height: 82,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primary,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.30),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.credit_card_outlined,
                  color: Colors.white,
                  size: 36,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: AppSpacing.xl),

        const Text(
          'Activating your membership',
          style: AppTextStyles.headlineMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.sm),
        const Text(
          'Confirming your payment with Stripe\u2026',
          style: AppTextStyles.bodyMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.sm),
        const Text(
          'This usually takes a few seconds.',
          style: AppTextStyles.labelSmall,
          textAlign: TextAlign.center,
        ),

        const Spacer(flex: 3),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Active view — briefly shown before auto-navigation to success screen
// ---------------------------------------------------------------------------

class _ActiveView extends StatelessWidget {
  const _ActiveView();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Spacer(flex: 2),

        Container(
          width: 88,
          height: 88,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.success,
            boxShadow: [
              BoxShadow(
                color: AppColors.success.withValues(alpha: 0.30),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: const Icon(
            Icons.check,
            color: Colors.white,
            size: 44,
          ),
        ),

        const SizedBox(height: AppSpacing.lg),

        const Text(
          'Membership active!',
          style: AppTextStyles.headlineMedium,
          textAlign: TextAlign.center,
        ),

        const Spacer(flex: 3),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Timeout view — webhook delayed; offer retry or skip
// ---------------------------------------------------------------------------

class _TimeoutView extends StatelessWidget {
  const _TimeoutView({required this.onRetry, required this.onSkip});

  final VoidCallback onRetry;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Spacer(flex: 2),

        const Icon(
          Icons.hourglass_bottom_outlined,
          size: 56,
          color: AppColors.warning,
        ),

        const SizedBox(height: AppSpacing.lg),

        const Text(
          'Taking longer than expected',
          style: AppTextStyles.headlineMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.sm),
        const Text(
          'Your payment may still be processing. Your '
          'membership will appear once Stripe confirms it.',
          style: AppTextStyles.bodyMedium,
          textAlign: TextAlign.center,
        ),

        const Spacer(flex: 3),

        PrimaryButton(label: 'Check again', onPressed: onRetry),
        const SizedBox(height: AppSpacing.sm),
        TextButton(
          onPressed: onSkip,
          child: const Text('Continue to app'),
        ),
        const SizedBox(height: AppSpacing.xs),
        const Text(
          'Your membership may still be activating in the background',
          style: AppTextStyles.labelSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.md),
      ],
    );
  }
}
