import 'package:flutter/material.dart';

enum BrandLogoVariant { horizontal, icon }

enum BrandLogoScheme { light, dark }

/// Better Off Local brand logo widget.
///
/// Assets live in `assets/branding/`:
///   logo-horizontal.png       — dark wordmark on transparent (light backgrounds)
///   logo-white.png            — white wordmark on transparent (dark backgrounds)
///   logo-icon-transparent.png — icon mark on transparent (any background)
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
    if (variant == BrandLogoVariant.icon) {
      return 'assets/branding/logo-icon-transparent.png';
    }
    // Horizontal wordmark: dark version for light backgrounds, white for dark.
    return scheme == BrandLogoScheme.dark
        ? 'assets/branding/logo-white.png'
        : 'assets/branding/logo-horizontal.png';
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
