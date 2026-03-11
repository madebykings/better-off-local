import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/primary_button.dart';
import 'redemption_controller.dart';

/// Displays a short-lived QR code that the retailer scans to validate a
/// redemption. The token is requested from the server on mount and refreshed
/// automatically when it expires.
///
/// The QR value is the raw token UUID — the server hashes it when validating.
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
      final remaining = expiresAt.difference(DateTime.now().toUtc());
      if (!mounted) return;
      setState(() {
        _remaining = remaining.isNegative ? Duration.zero : remaining;
      });
    });
  }

  String _formatCountdown(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final controllerState = ref.watch(redemptionControllerProvider);

    // When QR is ready, kick off (or restart) the countdown timer.
    if (controllerState is RedemptionQRReady) {
      final token = controllerState.token;
      if (_countdownTimer == null || !_countdownTimer!.isActive) {
        _remaining = token.remainingTime;
        _startCountdown(token.expiresAt);
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Redeem offer')),
      body: switch (controllerState) {
        RedemptionLoading() => const LoadingIndicator(),
        RedemptionControllerError(:final message) => ErrorState(
            message: message,
            onRetry: () => ref
                .read(redemptionControllerProvider.notifier)
                .requestToken(widget.offerId),
          ),
        RedemptionQRReady(:final token) => _QRView(
            token: token.token,
            isExpired: _remaining == Duration.zero,
            countdown: _formatCountdown(_remaining),
            onRefresh: () {
              _countdownTimer?.cancel();
              _countdownTimer = null;
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

class _QRView extends StatelessWidget {
  const _QRView({
    required this.token,
    required this.isExpired,
    required this.countdown,
    required this.onRefresh,
  });

  final String token;
  final bool isExpired;
  final String countdown;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Show this code to the retailer',
            style: AppTextStyles.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
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
                      color: Colors.black.withOpacity(0.55),
                      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.timer_off_outlined,
                          color: Colors.white,
                          size: 40,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        const Text(
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

          // Countdown or expired badge
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
    // Parse MM:SS and warn when under 60s
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
