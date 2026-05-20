import 'package:flutter/material.dart';

enum BrandLogoVariant { horizontal, icon }

enum BrandLogoScheme { light, dark }

/// Better Off Local brand logo widget.
///
/// Loads a PNG asset from `assets/images/`. Falls back to a storefront icon
/// if the asset is not yet present (e.g. before PNG exports have been copied
/// via scripts/copy-brand-assets.js).
///
/// PNG files must be exported at 1×, 2×, and 3× densities:
///   assets/images/logo-horizontal-light.png
///   assets/images/logo-horizontal-light@2x.png
///   assets/images/logo-horizontal-light@3x.png
///   (and so on for each variant/scheme combination)
class BrandLogo extends StatelessWidget {
  const BrandLogo({
    super.key,
    this.variant = BrandLogoVariant.horizontal,
    this.scheme = BrandLogoScheme.light,
    this.height = 28,
  });

  final BrandLogoVariant variant;
  final BrandLogoScheme scheme;
  final double height;

  String get _assetPath {
    final v = variant == BrandLogoVariant.horizontal ? 'horizontal' : 'icon';
    final s = scheme == BrandLogoScheme.light ? 'light' : 'dark';
    return 'assets/images/logo-$v-$s.png';
  }

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      _assetPath,
      height: height,
      fit: BoxFit.contain,
      errorBuilder: (context, error, stackTrace) => Icon(
        Icons.storefront,
        size: height,
        color: scheme == BrandLogoScheme.light
            ? Theme.of(context).colorScheme.primary
            : Colors.white,
      ),
    );
  }
}
