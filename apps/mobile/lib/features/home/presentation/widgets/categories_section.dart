import 'package:flutter/material.dart';

import '../../../../core/widgets/section_header.dart';

class CategoriesSection extends StatelessWidget {
  const CategoriesSection({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: 'Categories'),
        SizedBox(height: 8),
        // TODO: implement horizontal category chip list
        Placeholder(fallbackHeight: 48),
      ],
    );
  }
}
