import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FavouritesScreen extends ConsumerWidget {
  const FavouritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: implement favourites list (saved offers / retailers)
    return Scaffold(
      appBar: AppBar(title: const Text('Favourites')),
      body: const Center(child: Text('TODO: Favourites screen')),
    );
  }
}
