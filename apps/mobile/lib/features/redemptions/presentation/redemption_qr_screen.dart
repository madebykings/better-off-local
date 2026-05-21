import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/primary_button.dart';
import '../../offers/providers/offers_providers.dart';
import 'redemption_controller.dart';

/// Displays a short-lived QR code that the retailer scans to validate a
/// redemption. The token is requested from the server on mount and silently
/// refreshed at T-30 seconds. The QR value is the raw token UUID — the server
/// hashes it when validating.
class RedemptionQRScreen extends ConsumerStatefulWidget {
  const RedemptionQRScreen({super.key, required this.offerId});

  final String offerId;

  @override
  ConsumerState<RedemptionQRScreen> createState() =>
      _RedemptionQRScreenState();
}

class _RedemptionQRScreenState extends ConsumerState<RedemptionQRScreen> {
  Timer? _countdownTimer;
  Duration _remaining = Duration.zero;

  /// Value of the token currently displayed. Used to detect when a new token
  /// arrives (initial issue or after silent refresh) so the countdown restarts.
  String? _activeTokenValue;

  /// Prevents multiple concurrent silent refresh calls for the same token.
  bool _silentRefreshAttempted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref
          .read(redemptionControllerProvider.notifier)
          .requestToken(widget.offerId);
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startCountdown(DateTime expiresAt) {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final remaining = expiresAt.difference(DateTime.now().toUtc());
      setState(() {
        _remaining = remaining.isNegative ? Duration.zero : remaining;
      });
      // Silent refresh at T-30s (once per token).
      if (!_silentRefreshAttempted &&
          _remaining.inSeconds <= 30 &&
          _remaining.inSeconds > 0) {
        _silentRefreshAttempted = true;
        ref
            .read(redemptionControllerProvider.notifier)
            .silentRefresh(widget.offerId);
      }
    });
  }

  String _formatCountdown(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    // Listen for new tokens (initial issue and silent refresh).
    // Using ref.listen avoids side effects inside the build body.
    ref.listen<RedemptionControllerState>(redemptionControllerProvider,
        (_, next) {
      if (next is! RedemptionQRReady) return;
      final token = next.token;
      if (_activeTokenValue == token.token) return; // same token, no change
      _activeTokenValue = token.token;
      _silentRefreshAttempted = false;
      _countdownTimer?.cancel();
      setState(() => _remaining = token.remainingTime);
      _startCountdown(token.expiresAt);
    });

    final controllerState = ref.watch(redemptionControllerProvider);

    // Offer title shown in the QR view (best-effort; silently absent on error).
    final offerTitle =
        ref.watch(offerProvider(widget.offerId)).valueOrNull?.title;

    return Scaffold(
      appBar: AppBar(title: const Text('Use this offer')),
      body: switch (controllerState) {
        RedemptionLoading() => const LoadingIndicator(),
        RedemptionControllerError(:final message) => ErrorState(
            message: message,
            onRetry: () => ref
                .read(redemptionControllerProvider.notifier)
                .requestToken(widget.offerId),
          ),
        RedemptionBlocked(:final message, :final showMembershipCTA) =>
          _BlockedView(
            message: message,
            showMembershipCTA: showMembershipCTA,
          ),
        RedemptionQRReady(:final token) => _QRView(
            token: token.token,
            offerTitle: offerTitle,
            isExpired: _remaining == Duration.zero,
            countdown: _formatCountdown(_remaining),
            onRefresh: () {
              _countdownTimer?.cancel();
              _activeTokenValue = null;
              ref
                  .read(redemptionControllerProvider.notifier)
                  .refreshToken(widget.offerId);
            },
          ),
        _ => const LoadingIndicator(),
      },
    );
  }
}

// ── QR view ──────────────────────────────────────────────────────────────────

class _QRView extends StatelessWidget {
  const _QRView({
    required this.token,
    required this.isExpired,
    required this.countdown,
    required this.onRefresh,
    this.offerTitle,
  });

  final String token;
  final bool isExpired;
  final String countdown;
  final VoidCallback onRefresh;
  final String? offerTitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Show this code to the retailer',
            style: AppTextStyles.titleMedium,
            textAlign: TextAlign.center,
          ),
          if (offerTitle != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              offerTitle!,
              style: AppTextStyles.bodyLarge.copyWith(
                color: AppColors.primary,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'The retailer will scan this code to confirm your redemption.',
            style: AppTextStyles.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),

          // QR code or expired overlay
          Center(
            child: Stack(
              alignment: Alignment.center,
              children: [
                ColorFiltered(
                  colorFilter: isExpired
                      ? const ColorFilter.mode(
                          Colors.grey,
                          BlendMode.saturation,
                        )
                      : const ColorFilter.mode(
                          Colors.transparent,
                          BlendMode.dst,
                        ),
                  child: QrImageView(
                    data: token,
                    version: QrVersions.auto,
                    size: 240,
                    backgroundColor: Colors.white,
                    padding: const EdgeInsets.all(12),
                  ),
                ),
                if (isExpired)
                  Container(
                    width: 240,
                    height: 240,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.55),
                      borderRadius:
                          BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    child: const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.timer_off_outlined,
                          color: Colors.white,
                          size: 40,
                        ),
                        SizedBox(height: AppSpacing.sm),
                        Text(
                          'Code expired',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          // Countdown
          Center(
            child: isExpired
                ? const SizedBox.shrink()
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.timer_outlined,
                        size: 16,
                        color: _countdownColor(countdown),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Expires in $countdown',
                        style: AppTextStyles.labelSmall.copyWith(
                          color: _countdownColor(countdown),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
          ),

          if (isExpired) ...[
            const SizedBox(height: AppSpacing.xl),
            PrimaryButton(
              label: 'Generate new code',
              onPressed: onRefresh,
            ),
          ],
        ],
      ),
    );
  }

  Color _countdownColor(String countdown) {
    final parts = countdown.split(':');
    if (parts.length == 2) {
      final minutes = int.tryParse(parts[0]) ?? 0;
      final seconds = int.tryParse(parts[1]) ?? 0;
      final totalSeconds = minutes * 60 + seconds;
      if (totalSeconds <= 30) return AppColors.error;
      if (totalSeconds <= 60) return AppColors.warning;
    }
    return AppColors.textSecondary;
  }
}

// ── Blocked view (permanent error, no retry) ─────────────────────────────────

class _BlockedView extends StatelessWidget {
  const _BlockedView({
    required this.message,
    required this.showMembershipCTA,
  });

  final String message;
  final bool showMembershipCTA;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(
            showMembershipCTA
                ? Icons.card_membership_outlined
                : Icons.block_outlined,
            size: 56,
            color: AppColors.textSecondary,
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            message,
            style: AppTextStyles.bodyLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),
          if (showMembershipCTA)
            PrimaryButton(
              label: 'Get membership',
              onPressed: () => context.go(RouteNames.paywall),
            )
          else
            OutlinedButton(
              onPressed: () => context.pop(),
              child: const Text('Go back'),
            ),
        ],
      ),
    );
  }
}
