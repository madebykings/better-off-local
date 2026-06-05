import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/supabase_provider.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/primary_button.dart';
import '../../loyalty/data/loyalty_remote_data_source.dart';
import '../../loyalty/providers/loyalty_providers.dart';
import '../../offers/providers/offers_providers.dart';
import '../data/redemptions_remote_data_source.dart';
import '../domain/redemption_exception.dart';
import '../providers/redemption_providers.dart';
import 'redemption_controller.dart';

/// Displays a short-lived QR code that the retailer scans to validate a
/// redemption. The token is requested from the server on mount and silently
/// refreshed at T-30 seconds.
///
/// For loyalty_visits offers, the screen additionally polls the loyalty card
/// state every 2 seconds. When the retailer scans and the stamp is recorded
/// on the server, the polling detects the stamp count increase and transitions
/// to a confirmation view that offers an immediate "get next code" action.
/// This eliminates the 5-minute dead zone between stamps.
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
  /// arrives so the countdown restarts.
  String? _activeTokenValue;

  /// Prevents multiple concurrent silent refresh calls for the same token.
  bool _silentRefreshAttempted = false;

  // ── Venue referral polling ────────────────────────────────────────────────

  /// True when a pre-flight check confirms the reward was already redeemed
  /// before the consumer opened this screen.
  bool _venueReferralAlreadyRedeemed = false;

  /// True when polling detects the retailer has just scanned and confirmed.
  bool _venueReferralConfirmed = false;

  /// Background poll timer for venue_referral offers.
  Timer? _venueReferralPollTimer;

  // ── Loyalty stamp polling ─────────────────────────────────────────────────

  /// Background poll timer; null when not a loyalty offer or stamp detected.
  Timer? _loyaltyPollTimer;

  /// Stamps earned before the currently displayed token was generated.
  /// Polling fires only when stamps_earned > this value.
  int _loyaltyBaselineStamps = 0;

  /// Card status ('active'|'completed'|'claimed') at the last known baseline.
  /// Used to detect reward claims (status → 'claimed') independent of stamp count.
  String _loyaltyBaselineStatus = 'active';

  /// Non-null when a stamp or claim has just been detected.
  ({int earned, int required, bool isComplete, bool isClaimed})? _stampResult;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // H-4: pre-flight availability check for venue_referral offers.
      // If the consumer's reward was already redeemed, show a clear message
      // instead of generating a QR code that the server will reject.
      final offer = ref.read(offerProvider(widget.offerId)).valueOrNull;
      if (offer?.offerType == 'venue_referral') {
        final profileId =
            ref.read(supabaseClientProvider).auth.currentUser?.id;
        if (profileId != null) {
          final state = await ref
              .read(redemptionsRemoteDataSourceProvider)
              .checkOfferAvailability(
                offerId: widget.offerId,
                consumerId: profileId,
              );
          if (state == 'already_redeemed' && mounted) {
            setState(() => _venueReferralAlreadyRedeemed = true);
            return;
          }
        }
      }
      ref
          .read(redemptionControllerProvider.notifier)
          .requestToken(widget.offerId);
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _loyaltyPollTimer?.cancel();
    _venueReferralPollTimer?.cancel();
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

  // ── Loyalty polling ───────────────────────────────────────────────────────

  /// Starts a 2-second poll loop.  First fetches the current card state to
  /// establish the baseline, then polls until a change is detected.
  void _startLoyaltyPolling() {
    _loyaltyPollTimer?.cancel();
    final profileId =
        ref.read(supabaseClientProvider).auth.currentUser?.id;
    if (profileId == null) return;

    // Fetch baseline (current stamps/status) before the loop starts.
    ref
        .read(loyaltyDataSourceProvider)
        .fetchCardForOffer(profileId, widget.offerId)
        .then((row) {
      if (!mounted) return;
      _loyaltyBaselineStamps = row?['stamps_earned'] as int? ?? 0;
      _loyaltyBaselineStatus = row?['status'] as String? ?? 'active';
      _startLoyaltyPollLoop(profileId);
    }).catchError((_) {
      if (mounted) _startLoyaltyPollLoop(profileId);
    });
  }

  void _startLoyaltyPollLoop(String profileId) {
    _loyaltyPollTimer?.cancel();
    _loyaltyPollTimer =
        Timer.periodic(const Duration(seconds: 2), (_) async {
      if (!mounted) {
        _loyaltyPollTimer?.cancel();
        return;
      }
      try {
        final row = await ref
            .read(loyaltyDataSourceProvider)
            .fetchCardForOffer(profileId, widget.offerId);

        final earned = row?['stamps_earned'] as int? ?? 0;
        final status = row?['status'] as String? ?? 'active';
        final required = row?['stamps_required'] as int? ?? earned;

        final stampAdded = earned > _loyaltyBaselineStamps;
        final cardClaimed =
            status == 'claimed' && _loyaltyBaselineStatus != 'claimed';

        if (stampAdded || cardClaimed) {
          _loyaltyPollTimer?.cancel();
          _countdownTimer?.cancel();
          if (!mounted) return;
          setState(() {
            _stampResult = (
              earned: earned,
              required: required,
              isComplete: status == 'completed' || status == 'claimed',
              isClaimed: status == 'claimed',
            );
          });
        }
      } catch (_) {
        // Silently swallow poll errors — continue until the token expires.
      }
    });
  }

  // ── Venue referral polling ────────────────────────────────────────────────

  /// H-3: starts a 3-second poll loop that checks offer availability.
  /// When the retailer scans the QR and marks the reward redeemed, the state
  /// transitions to 'already_redeemed' and we show the success view.
  void _startVenueReferralPolling() {
    _venueReferralPollTimer?.cancel();
    final profileId = ref.read(supabaseClientProvider).auth.currentUser?.id;
    if (profileId == null) return;

    _venueReferralPollTimer =
        Timer.periodic(const Duration(seconds: 3), (_) async {
      if (!mounted) {
        _venueReferralPollTimer?.cancel();
        return;
      }
      try {
        final state = await ref
            .read(redemptionsRemoteDataSourceProvider)
            .checkOfferAvailability(
              offerId: widget.offerId,
              consumerId: profileId,
            );
        if (state == 'already_redeemed' && mounted) {
          _venueReferralPollTimer?.cancel();
          _countdownTimer?.cancel();
          setState(() => _venueReferralConfirmed = true);
        }
      } catch (_) {
        // Silently swallow — poll until token expires or screen is dismissed.
      }
    });
  }

  /// Called when the user taps "Get next stamp code" or "Get reward code".
  /// Updates the baseline to the current count then requests a fresh token.
  void _onGetNextStampCode() {
    final earnedNow = _stampResult?.earned ?? _loyaltyBaselineStamps;
    final statusNow = _stampResult?.isClaimed == true ? 'claimed'
        : _stampResult?.isComplete == true ? 'completed'
        : 'active';
    setState(() {
      _stampResult = null;
      _activeTokenValue = null;
      _loyaltyBaselineStamps = earnedNow;
      _loyaltyBaselineStatus = statusNow;
    });
    ref
        .read(redemptionControllerProvider.notifier)
        .refreshToken(widget.offerId);
    // ref.listen restarts polling when the new RedemptionQRReady arrives.
  }

  /// Called when the user taps "Start new card" after a loyalty reward is claimed.
  /// Calls the reset_loyalty_card RPC, invalidates the loyalty cards list,
  /// shows a success snackbar, then transitions to a fresh token request.
  Future<void> _onStartNewCard() async {
    final profileId =
        ref.read(supabaseClientProvider).auth.currentUser?.id;
    if (profileId == null) return;

    try {
      await ref
          .read(redemptionsRemoteDataSourceProvider)
          .resetLoyaltyCard(offerId: widget.offerId, consumerId: profileId);

      // Invalidate so the loyalty cards list refreshes on next read.
      ref.invalidate(myLoyaltyCardsProvider);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('New card started! Keep collecting stamps.'),
          duration: Duration(seconds: 3),
        ),
      );

      // Transition to fresh token — resets the stamp baseline to 0.
      setState(() {
        _stampResult = null;
        _activeTokenValue = null;
        _loyaltyBaselineStamps = 0;
        _loyaltyBaselineStatus = 'active';
      });
      ref
          .read(redemptionControllerProvider.notifier)
          .refreshToken(widget.offerId);
    } on RedemptionException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: AppColors.error,
          duration: const Duration(seconds: 4),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not start a new card. Please try again.'),
          duration: Duration(seconds: 3),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Listen for new tokens (initial issue and silent refresh).
    ref.listen<RedemptionControllerState>(redemptionControllerProvider,
        (_, next) {
      if (next is! RedemptionQRReady) return;
      final token = next.token;
      if (_activeTokenValue == token.token) return; // same token, no change
      _activeTokenValue = token.token;
      _silentRefreshAttempted = false;
      _loyaltyPollTimer?.cancel();
      _countdownTimer?.cancel();
      setState(() {
        _remaining = token.remainingTime;
        _stampResult = null;
      });
      _startCountdown(token.expiresAt);

      // Start type-specific post-QR polling.
      final offerType =
          ref.read(offerProvider(widget.offerId)).valueOrNull?.offerType;
      if (offerType == 'loyalty_visits') {
        _startLoyaltyPolling();
      } else if (offerType == 'venue_referral') {
        _startVenueReferralPolling();
      }
    });

    final controllerState = ref.watch(redemptionControllerProvider);
    final offerTitle =
        ref.watch(offerProvider(widget.offerId)).valueOrNull?.title;

    // H-4: pre-flight — reward already redeemed before this screen opened.
    if (_venueReferralAlreadyRedeemed) {
      return Scaffold(
        appBar: AppBar(title: const Text('Use this offer')),
        body: _VenueReferralAlreadyRedeemedView(
          offerTitle: offerTitle,
          onDone: () => context.pop(),
        ),
      );
    }

    // H-3: confirmation — retailer just scanned and confirmed the reward.
    if (_venueReferralConfirmed) {
      return Scaffold(
        appBar: AppBar(title: const Text('Use this offer')),
        body: _VenueReferralConfirmedView(
          offerTitle: offerTitle,
          onDone: () => context.pop(),
        ),
      );
    }

    // Stamp confirmation overlay takes priority over the QR view.
    if (_stampResult != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Use this offer')),
        body: _StampRecordedView(
          stampResult: _stampResult!,
          offerTitle: offerTitle,
          onGetNextCode: _onGetNextStampCode,
          onDone: () => context.pop(),
        ),
      );
    }

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
              _loyaltyPollTimer?.cancel();
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

// ── Stamp recorded confirmation ───────────────────────────────────────────────

class _StampRecordedView extends StatelessWidget {
  const _StampRecordedView({
    required this.stampResult,
    required this.onGetNextCode,
    required this.onDone,
    this.offerTitle,
  });

  final ({int earned, int required, bool isComplete, bool isClaimed})
      stampResult;
  final VoidCallback onGetNextCode;
  final VoidCallback onDone;
  final String? offerTitle;

  @override
  Widget build(BuildContext context) {
    final isClaimed = stampResult.isClaimed;
    final isComplete = stampResult.isComplete;

    final String heading;
    final String subtext;
    final Color iconColor;
    final IconData iconData;

    if (isClaimed) {
      heading = 'Reward claimed!';
      subtext = 'Your loyalty reward has been redeemed. Start collecting stamps for your next reward.';
      iconColor = AppColors.success;
      iconData = Icons.celebration_outlined;
    } else if (isComplete) {
      heading = 'Card complete!';
      subtext = 'You\'ve earned your reward. Generate a code so the retailer can redeem it for you.';
      iconColor = const Color(0xFF0D9488);
      iconData = Icons.stars;
    } else {
      heading = 'Stamp ${stampResult.earned} of ${stampResult.required} collected';
      subtext = 'When you\'re ready for your next stamp, generate a fresh code below.';
      iconColor = AppColors.success;
      iconData = Icons.check_circle_outline;
    }

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(iconData, size: 64, color: iconColor),
          const SizedBox(height: AppSpacing.lg),
          Text(
            heading,
            style: AppTextStyles.headlineMedium,
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
          Text(
            subtext,
            style: AppTextStyles.bodyMedium.copyWith(
              color: AppColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),
          if (!isClaimed)
            PrimaryButton(
              label: isComplete ? 'Get reward code' : 'Get next stamp code',
              onPressed: onGetNextCode,
            )
          else ...[
            PrimaryButton(
              label: 'Start new card',
              onPressed: onGetNextCode,
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton(
              onPressed: onDone,
              child: const Text('Done'),
            ),
          ],
        ],
      ),
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

// ── Blocked view ──────────────────────────────────────────────────────────────

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

// ── Venue referral: already redeemed (pre-flight, H-4) ────────────────────────

class _VenueReferralAlreadyRedeemedView extends StatelessWidget {
  const _VenueReferralAlreadyRedeemedView({
    required this.onDone,
    this.offerTitle,
  });

  final VoidCallback onDone;
  final String? offerTitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(Icons.check_circle_outline,
              size: 64, color: AppColors.success),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Reward already redeemed',
            style: AppTextStyles.headlineMedium,
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
          Text(
            'You\'ve already redeemed this referral reward.',
            style: AppTextStyles.bodyMedium
                .copyWith(color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),
          OutlinedButton(
            onPressed: onDone,
            child: const Text('Go back'),
          ),
        ],
      ),
    );
  }
}

// ── Venue referral: redemption confirmed (polling success, H-3) ───────────────

class _VenueReferralConfirmedView extends StatelessWidget {
  const _VenueReferralConfirmedView({
    required this.onDone,
    this.offerTitle,
  });

  final VoidCallback onDone;
  final String? offerTitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(Icons.celebration_outlined,
              size: 64, color: AppColors.success),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Reward redeemed! ✓',
            style: AppTextStyles.headlineMedium,
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
          Text(
            'The retailer has confirmed your reward. Enjoy!',
            style: AppTextStyles.bodyMedium
                .copyWith(color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),
          OutlinedButton(
            onPressed: onDone,
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }
}
