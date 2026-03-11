import 'package:flutter/material.dart';

import '../../../../core/widgets/section_header.dart';

class FeaturedRetailersSection extends StatelessWidget {
  const FeaturedRetailersSection({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: 'Featured retailers'),
        SizedBox(height: 8),
        // TODO: implement featured retailers list
        Placeholder(fallbackHeight: 140),
      ],
    );
  }
}
