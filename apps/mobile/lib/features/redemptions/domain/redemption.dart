import 'package:equatable/equatable.dart';

enum RedemptionOutcome { success, failed, pending }

class Redemption extends Equatable {
  const Redemption({
    required this.id,
    required this.offerId,
    required this.retailerId,
    required this.outcome,
    required this.redeemedAt,
    this.savingsAmount,
  });

  final String id;
  final String offerId;
  final String retailerId;
  final RedemptionOutcome outcome;
  final DateTime redeemedAt;
  final double? savingsAmount;

  @override
  List<Object?> get props => [id, offerId, outcome, redeemedAt];
}
