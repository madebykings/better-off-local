import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/redemption_exception.dart';
import '../domain/redemption_token.dart';
import '../providers/redemption_providers.dart';

sealed class RedemptionControllerState {
  const RedemptionControllerState();
}

class RedemptionIdle extends RedemptionControllerState {
  const RedemptionIdle();
}

class RedemptionLoading extends RedemptionControllerState {
  const RedemptionLoading();
}

/// Token successfully issued — display a QR code encoding [token].
class RedemptionQRReady extends RedemptionControllerState {
  const RedemptionQRReady(this.token);
  final RedemptionToken token;
}

/// Server rejected the request with a retriable error (e.g. 5xx).
/// The UI should show [message] with a retry option.
class RedemptionControllerError extends RedemptionControllerState {
  const RedemptionControllerError(this.message);
  final String message;
}

/// Server rejected the request with a permanent, non-retriable error
/// (e.g. no membership, offer ended, cap reached).
/// No retry is offered. [showMembershipCTA] signals that the UI should
/// show a "Get membership" button linking to the paywall.
class RedemptionBlocked extends RedemptionControllerState {
  const RedemptionBlocked({
    required this.message,
    this.showMembershipCTA = false,
  });
  final String message;
  final bool showMembershipCTA;
}

class RedemptionController
    extends StateNotifier<RedemptionControllerState> {
  RedemptionController(this._ref) : super(const RedemptionIdle());

  final Ref _ref;

  /// Requests a short-lived redemption token from the server for [offerId].
  /// Transitions: Idle/Error → Loading → QRReady | Blocked | Error.
  Future<void> requestToken(String offerId) async {
    state = const RedemptionLoading();
    try {
      final token = await _ref
          .read(redemptionsRepositoryProvider)
          .requestRedemptionToken(offerId);
      state = RedemptionQRReady(token);
    } on RedemptionException catch (e) {
      state = _mapError(e);
    } catch (e) {
      state = const RedemptionControllerError(
        'Something went wrong. Please try again.',
      );
    }
  }

  /// Refreshes the token after the user explicitly taps "Generate new code".
  Future<void> refreshToken(String offerId) => requestToken(offerId);

  /// Attempts a silent background token refresh at T-30 seconds.
  ///
  /// Does NOT change visible state while in flight. On success, replaces the
  /// current token with the new one (state transitions QRReady → QRReady).
  /// On failure, swallows the error — the current token remains active until
  /// it expires naturally.
  Future<void> silentRefresh(String offerId) async {
    try {
      final token = await _ref
          .read(redemptionsRepositoryProvider)
          .requestRedemptionToken(offerId);
      // Only replace if still displaying a QR — don't overwrite blocked/error
      // states that may have occurred while the request was in flight.
      if (state is RedemptionQRReady) {
        state = RedemptionQRReady(token);
      }
    } catch (_) {
      // Silent — current token valid until natural expiry.
    }
  }

  void reset() => state = const RedemptionIdle();

  // ── Error mapping ────────────────────────────────────────────────────────

  RedemptionControllerState _mapError(RedemptionException e) {
    // Primary: map by structured error_code from the server.
    switch (e.errorCode) {
      case 'membership_required':
        return const RedemptionBlocked(
          message: 'An active membership is required to use this offer.',
          showMembershipCTA: true,
        );
      case 'offer_unavailable':
        return const RedemptionBlocked(
          message: 'This offer is no longer available.',
        );
      case 'offer_ended':
      case 'global_cap':
        return const RedemptionBlocked(
          message: 'This offer has ended.',
        );
      case 'lifetime_limit':
        return const RedemptionBlocked(
          message: "You've already used this offer.",
        );
      case 'daily_limit':
        return const RedemptionBlocked(
          message: 'Daily limit reached for this offer. Try again tomorrow.',
        );
      case 'server_error':
        return const RedemptionControllerError(
          'Something went wrong. Please try again.',
        );
    }

    // Fallback: infer from HTTP status when error_code is absent.
    if (e.statusCode == 403) {
      return const RedemptionBlocked(
        message: 'An active membership is required to use this offer.',
        showMembershipCTA: true,
      );
    }
    if (e.statusCode == 404) {
      return const RedemptionBlocked(
        message: 'This offer is no longer available.',
      );
    }
    if (e.statusCode == 410) {
      return const RedemptionBlocked(message: 'This offer has ended.');
    }
    if (e.statusCode == 429) {
      return const RedemptionBlocked(
        message: 'Redemption limit reached for this offer.',
      );
    }

    return const RedemptionControllerError(
      'Something went wrong. Please try again.',
    );
  }
}

final redemptionControllerProvider =
    StateNotifierProvider.autoDispose<RedemptionController, RedemptionControllerState>(
  (ref) => RedemptionController(ref),
);
