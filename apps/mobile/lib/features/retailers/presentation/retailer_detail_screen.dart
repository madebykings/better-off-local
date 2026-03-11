import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class RetailerDetailScreen extends ConsumerWidget {
  const RetailerDetailScreen({super.key, required this.retailerId});
  final String retailerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: implement retailer detail page
    return Scaffold(
      appBar: AppBar(title: const Text('Retailer')),
      body: Center(child: Text('TODO: Retailer detail – $retailerId')),
    );
  }
}
