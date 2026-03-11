import 'package:flutter_riverpod/flutter_riverpod.dart';

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

class RedemptionControllerError extends RedemptionControllerState {
  const RedemptionControllerError(this.message);
  final String message;
}

class RedemptionController
    extends StateNotifier<RedemptionControllerState> {
  RedemptionController(this._ref) : super(const RedemptionIdle());

  final Ref _ref;

  /// Requests a short-lived redemption token from the server for [offerId].
  /// On success, state transitions to [RedemptionQRReady] with the token.
  /// The QR screen encodes [RedemptionToken.token] into a scannable code.
  Future<void> requestToken(String offerId) async {
    state = const RedemptionLoading();
    try {
      final token = await _ref
          .read(redemptionsRepositoryProvider)
          .requestRedemptionToken(offerId);
      state = RedemptionQRReady(token);
    } catch (e) {
      state = RedemptionControllerError(
        e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  /// Refreshes the token for the same offer. Called when the previous token
  /// expires while the QR screen is still visible.
  Future<void> refreshToken(String offerId) => requestToken(offerId);

  void reset() => state = const RedemptionIdle();
}

final redemptionControllerProvider =
    StateNotifierProvider.autoDispose<RedemptionController, RedemptionControllerState>(
  (ref) => RedemptionController(ref),
);
