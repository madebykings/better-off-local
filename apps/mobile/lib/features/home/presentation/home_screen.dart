import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/section_header.dart';
import 'widgets/categories_section.dart';
import 'widgets/featured_retailers_section.dart';
import 'widgets/nearby_offers_section.dart';
import 'widgets/savings_summary_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: implement home screen content
    return Scaffold(
      appBar: AppBar(
        title: const Text('Better Off Local'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {
              // TODO: navigate to notifications
            },
          ),
        ],
      ),
      body: const SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SavingsSummaryCard(),
            SizedBox(height: 24),
            CategoriesSection(),
            SizedBox(height: 24),
            NearbyOffersSection(),
            SizedBox(height: 24),
            FeaturedRetailersSection(),
          ],
        ),
      ),
    );
  }
}
