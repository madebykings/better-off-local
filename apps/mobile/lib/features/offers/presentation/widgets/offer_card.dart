import 'package:flutter/material.dart';

// TODO: implement offer card widget
class OfferCard extends StatelessWidget {
  const OfferCard({super.key, required this.offerId});
  final String offerId;

  @override
  Widget build(BuildContext context) {
    return const Card(child: Placeholder(fallbackHeight: 120));
  }
}
