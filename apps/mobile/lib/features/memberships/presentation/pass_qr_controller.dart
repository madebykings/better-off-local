import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../redemptions/domain/redemption_token.dart';
import '../../redemptions/providers/redemption_providers.dart';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

sealed class PassQRState {
  const PassQRState();
}

class PassQRIdle extends PassQRState {
  const PassQRIdle();
}

class PassQRLoading extends PassQRState {
  const PassQRLoading();
}

/// Token issued and ready to display.
///
/// [token] is a membership-level [RedemptionToken]: [RedemptionToken.offerId]
/// and [RedemptionToken.retailerId] are null — this token proves membership,
/// not a specific offer redemption.
class PassQRReady extends PassQRState {
  const PassQRReady(this.token);
  final RedemptionToken token;
}

/// An unexpected error occurred fetching the pass token (network, auth, etc).
class PassQRError extends PassQRState {
  const PassQRError(this.message);
  final String message;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/// Manages the lifecycle of the short-lived QR token displayed on the
/// membership pass (Card tab).
///
/// This is intentionally separate from [RedemptionController], which manages
/// offer-specific redemption QR codes. The membership pass token:
///
/// - Proves active BOL membership (no specific offer or retailer)
/// - Is requested via [RedemptionsRepository.requestPassToken]
/// - Has null [RedemptionToken.offerId] and [RedemptionToken.retailerId]
/// - Auto-refreshes 30 seconds before expiry so the QR is never stale
///
/// Failures (network, auth, rate-limit) go to [PassQRError] and can be
/// retried manually via [refresh].
class PassQRController extends StateNotifier<PassQRState> {
  PassQRController(this._ref) : super(const PassQRIdle());

  final Ref _ref;
  Timer? _refreshTimer;

  /// Fetch a fresh membership pass token from the backend.
  ///
  /// Called on Card tab mount and automatically 30 seconds before each token
  /// expires. Safe to call multiple times — cancels any pending refresh timer.
  Future<void> requestToken() async {
    state = const PassQRLoading();
    _refreshTimer?.cancel();

    try {
      final token = await _ref
          .read(redemptionsRepositoryProvider)
          .requestPassToken();

      state = PassQRReady(token);
      _scheduleAutoRefresh(token);
    } catch (e) {
      state = PassQRError(
        e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  /// Manually refresh the pass token (e.g. after a [PassQRError]).
  Future<void> refresh() => requestToken();

  void _scheduleAutoRefresh(RedemptionToken token) {
    _refreshTimer?.cancel();
    final remaining = token.remainingTime;

    // Refresh 30 seconds before expiry to avoid showing a dead QR.
    final refreshIn = remaining - const Duration(seconds: 30);

    if (refreshIn <= Duration.zero) {
      // Token is nearly expired already — refresh immediately.
      requestToken();
      return;
    }

    _refreshTimer = Timer(refreshIn, requestToken);
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }
}

final passQRControllerProvider =
    StateNotifierProvider.autoDispose<PassQRController, PassQRState>(
  (ref) => PassQRController(ref),
);
