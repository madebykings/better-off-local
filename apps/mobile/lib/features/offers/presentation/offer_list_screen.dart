import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class OfferListScreen extends ConsumerWidget {
  const OfferListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: implement offer list with filter bar and category chips
    return Scaffold(
      appBar: AppBar(title: const Text('Explore')),
      body: const Center(child: Text('TODO: Offer list screen')),
    );
  }
}
