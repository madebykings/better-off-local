import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

/// Pre-painted custom map markers for Better Off Local MAP 2.0.
///
/// Call [initialize] once (e.g. in State.initState) and await it.
/// After that [isReady] is true and the get* methods return synchronously.
class MapMarkerCache {
  static const _kGreen = Color(0xFF1B4332);
  static const _kGreenLight = Color(0xFF2D6A4F);
  static const _kAmber = Color(0xFFF4A261);
  static const _kBlue = Color(0xFF0D6EFD);

  final Map<_PinKey, BitmapDescriptor> _cache = {};
  bool get isReady => _cache.isNotEmpty;

  Future<void> initialize() async {
    _cache[_PinKey.defaultRetailer] = await _paintTeardrop(color: _kGreen);
    _cache[_PinKey.featuredRetailer] = await _paintTeardrop(color: _kAmber);
    _cache[_PinKey.followingRetailer] =
        await _paintTeardrop(color: _kGreen, hasRing: true);
    _cache[_PinKey.selectedRetailer] =
        await _paintTeardrop(color: _kGreenLight, scale: 1.25);
    _cache[_PinKey.eventPin] = await _paintCircle(color: _kBlue);
    _cache[_PinKey.selectedEvent] =
        await _paintCircle(color: _kBlue, scale: 1.25);
  }

  BitmapDescriptor getRetailerDescriptor({
    required bool isSelected,
    required bool isFollowing,
    required bool isFeatured,
  }) {
    if (!isReady) return BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen);
    if (isSelected) return _cache[_PinKey.selectedRetailer]!;
    if (isFollowing) return _cache[_PinKey.followingRetailer]!;
    if (isFeatured) return _cache[_PinKey.featuredRetailer]!;
    return _cache[_PinKey.defaultRetailer]!;
  }

  BitmapDescriptor getEventDescriptor({bool isSelected = false}) {
    if (!isReady) {
      return BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue);
    }
    return isSelected
        ? _cache[_PinKey.selectedEvent]!
        : _cache[_PinKey.eventPin]!;
  }
}

enum _PinKey {
  defaultRetailer,
  featuredRetailer,
  followingRetailer,
  selectedRetailer,
  eventPin,
  selectedEvent,
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

Future<BitmapDescriptor> _paintTeardrop({
  required Color color,
  bool hasRing = false,
  double scale = 1.0,
}) async {
  const baseW = 28.0;
  const baseH = 38.0;
  final w = (baseW * scale).roundToDouble();
  final h = (baseH * scale).roundToDouble();
  final cx = w / 2;
  final circleR = cx - 2 * scale;

  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, w, h));

  // Drop shadow
  final shadowPaint = Paint()
    ..color = const Color(0x40000000)
    ..maskFilter = MaskFilter.blur(BlurStyle.normal, 3 * scale);
  canvas.drawCircle(Offset(cx + scale, circleR + scale * 2), circleR, shadowPaint);

  if (hasRing) {
    // White ring behind the pin
    final ringPaint = Paint()..color = Colors.white;
    canvas.drawCircle(Offset(cx, circleR), circleR + 2 * scale, ringPaint);
  }

  // Main circle fill
  final fillPaint = Paint()..color = color;
  canvas.drawCircle(Offset(cx, circleR), circleR, fillPaint);

  // Teardrop point
  final pointPath = Path()
    ..moveTo(cx - 5 * scale, circleR * 2 - 4 * scale)
    ..lineTo(cx, h - scale)
    ..lineTo(cx + 5 * scale, circleR * 2 - 4 * scale)
    ..close();
  canvas.drawPath(pointPath, fillPaint);

  // White inner dot
  final dotPaint = Paint()
    ..color = Colors.white.withValues(alpha: 0.85);
  canvas.drawCircle(Offset(cx, circleR), circleR * 0.32, dotPaint);

  final picture = recorder.endRecording();
  final img = await picture.toImage(w.toInt(), h.toInt());
  final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
  img.dispose();
  return BitmapDescriptor.fromBytes(bytes!.buffer.asUint8List());
}

Future<BitmapDescriptor> _paintCircle({
  required Color color,
  double scale = 1.0,
}) async {
  const baseSize = 24.0;
  final size = (baseSize * scale).roundToDouble();
  final cx = size / 2;

  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, size, size));

  // Shadow
  final shadowPaint = Paint()
    ..color = const Color(0x40000000)
    ..maskFilter = MaskFilter.blur(BlurStyle.normal, 2 * scale);
  canvas.drawCircle(Offset(cx + scale, cx + scale), cx - 3 * scale, shadowPaint);

  // White border
  final borderPaint = Paint()..color = Colors.white;
  canvas.drawCircle(Offset(cx, cx), cx - 1.5 * scale, borderPaint);

  // Fill
  final fillPaint = Paint()..color = color;
  canvas.drawCircle(Offset(cx, cx), cx - 3.5 * scale, fillPaint);

  // Small white dot
  final dotPaint = Paint()..color = Colors.white.withValues(alpha: 0.8);
  canvas.drawCircle(Offset(cx, cx), (cx - 3.5 * scale) * 0.3, dotPaint);

  final picture = recorder.endRecording();
  final img = await picture.toImage(size.toInt(), size.toInt());
  final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
  img.dispose();
  return BitmapDescriptor.fromBytes(bytes!.buffer.asUint8List());
}
