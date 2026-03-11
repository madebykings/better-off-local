import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class RedemptionHistoryScreen extends ConsumerWidget {
  const RedemptionHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: implement redemption history list
    return Scaffold(
      appBar: AppBar(title: const Text('Redemption history')),
      body: const Center(child: Text('TODO: Redemption history')),
    );
  }
}
