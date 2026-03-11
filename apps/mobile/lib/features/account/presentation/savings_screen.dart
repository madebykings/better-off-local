import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class SavingsScreen extends ConsumerWidget {
  const SavingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: implement savings summary (total saved, breakdown by category)
    return Scaffold(
      appBar: AppBar(title: const Text('My savings')),
      body: const Center(child: Text('TODO: Savings screen')),
    );
  }
}
