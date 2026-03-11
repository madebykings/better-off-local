import 'package:flutter/material.dart';

// TODO: implement bottom sheet preview card shown when an offer pin is tapped
class MapOfferPreviewCard extends StatelessWidget {
  const MapOfferPreviewCard({super.key, required this.offerId});
  final String offerId;

  @override
  Widget build(BuildContext context) {
    return const Card(child: Placeholder(fallbackHeight: 100));
  }
}
