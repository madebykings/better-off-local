import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class OfferDetailScreen extends ConsumerWidget {
  const OfferDetailScreen({super.key, required this.offerId});
  final String offerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: implement offer detail with redeem CTA (membership-gated)
    return Scaffold(
      appBar: AppBar(title: const Text('Offer')),
      body: Center(child: Text('TODO: Offer detail – $offerId')),
    );
  }
}
