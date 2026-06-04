import 'package:flutter/material.dart';

const _kTeal = Color(0xFF0D9488);
const _kTealLight = Color(0xFFCCFBF1);

class LoyaltyStampGrid extends StatelessWidget {
  const LoyaltyStampGrid({
    super.key,
    required this.stampsEarned,
    required this.stampsRequired,
    this.dotSize = 28,
    this.spacing = 6,
  });

  final int stampsEarned;
  final int stampsRequired;
  final double dotSize;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    final columns = stampsRequired <= 6 ? stampsRequired : (stampsRequired <= 12 ? 6 : 8);
    final rows = (stampsRequired / columns).ceil();

    return LayoutBuilder(builder: (context, constraints) {
      final availableWidth = constraints.maxWidth;
      final effectiveDotSize =
          ((availableWidth - (spacing * (columns - 1))) / columns)
              .clamp(18.0, dotSize);

      return Wrap(
        spacing: spacing,
        runSpacing: spacing,
        children: List.generate(rows * columns, (i) {
          if (i >= stampsRequired) return const SizedBox.shrink();
          final earned = i < stampsEarned;
          return SizedBox(
            width: effectiveDotSize,
            height: effectiveDotSize,
            child: _Dot(earned: earned, size: effectiveDotSize),
          );
        }),
      );
    });
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.earned, required this.size});
  final bool earned;
  final double size;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: earned ? _kTeal : _kTealLight,
        border: Border.all(
          color: earned ? _kTeal : const Color(0xFF99F6E4),
          width: 1.5,
        ),
      ),
      child: earned
          ? const Icon(Icons.check, size: 14, color: Colors.white)
          : null,
    );
  }
}
