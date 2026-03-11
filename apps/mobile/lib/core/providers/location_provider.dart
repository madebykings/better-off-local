import 'package:flutter_riverpod/flutter_riverpod.dart';

// TODO: implement using LocationService once concrete impl is wired up
// This provider exposes the current user position for map and nearby features.

typedef Position = ({double latitude, double longitude});

final locationProvider = StateProvider<Position?>((ref) => null);
