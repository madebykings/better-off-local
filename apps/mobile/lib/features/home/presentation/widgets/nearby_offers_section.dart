import 'package:flutter/material.dart';

import '../../../../core/widgets/section_header.dart';

class NearbyOffersSection extends StatelessWidget {
  const NearbyOffersSection({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: 'Nearby offers'),
        SizedBox(height: 8),
        // TODO: implement horizontal offer card list
        Placeholder(fallbackHeight: 180),
      ],
    );
  }
}
