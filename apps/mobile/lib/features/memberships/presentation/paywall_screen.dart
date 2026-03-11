import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class PaywallScreen extends ConsumerWidget {
  const PaywallScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: implement membership purchase paywall
    // Must not grant access locally — initiate purchase flow and
    // wait for server-side entitlement confirmation.
    return Scaffold(
      appBar: AppBar(title: const Text('Become a member')),
      body: const Center(child: Text('TODO: Paywall screen')),
    );
  }
}
