import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class MapScreen extends ConsumerWidget {
  const MapScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: implement Google Maps with offer/retailer pins
    // Use google_maps_flutter + geolocator for user position
    return Scaffold(
      appBar: AppBar(title: const Text('Map')),
      body: const Center(child: Text('TODO: Map screen')),
    );
  }
}
