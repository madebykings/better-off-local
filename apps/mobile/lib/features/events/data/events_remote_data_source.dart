import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/event.dart';

class EventsRemoteDataSource {
  const EventsRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<List<Event>> getUpcomingEvents(String regionId, {int limit = 20}) async {
    final now = DateTime.now().toUtc().toIso8601String();
    final rows = await _client
        .from('events')
        .select('*, venue:venue_id(name, address_line1), retailer:retailer_id(name, logo_url)')
        .eq('region_id', regionId)
        .eq('status', 'live')
        .gte('start_at', now)
        .order('start_at')
        .limit(limit);
    return (rows as List).map((r) => Event.fromMap(r as Map<String, dynamic>)).toList();
  }

  Future<List<Event>> getFeaturedEvents(String regionId) async {
    final now = DateTime.now().toUtc().toIso8601String();
    final rows = await _client
        .from('events')
        .select('*, venue:venue_id(name, address_line1), retailer:retailer_id(name, logo_url)')
        .eq('region_id', regionId)
        .eq('status', 'live')
        .eq('is_featured', true)
        .gte('start_at', now)
        .order('start_at')
        .limit(10);
    return (rows as List).map((r) => Event.fromMap(r as Map<String, dynamic>)).toList();
  }

  Future<List<Event>> getThisWeekendEvents(String regionId) async {
    // Calculate the upcoming Saturday and Sunday.
    final now = DateTime.now().toUtc();
    final daysUntilSaturday = (6 - now.weekday + 7) % 7;
    final saturday = now.add(Duration(days: daysUntilSaturday));
    final sunday = saturday.add(const Duration(days: 1));
    final startOfSaturday = DateTime(saturday.year, saturday.month, saturday.day);
    final endOfSunday = DateTime(sunday.year, sunday.month, sunday.day, 23, 59, 59);

    final rows = await _client
        .from('events')
        .select('*, venue:venue_id(name, address_line1), retailer:retailer_id(name, logo_url)')
        .eq('region_id', regionId)
        .eq('status', 'live')
        .gte('start_at', startOfSaturday.toIso8601String())
        .lte('start_at', endOfSunday.toIso8601String())
        .order('start_at')
        .limit(20);
    return (rows as List).map((r) => Event.fromMap(r as Map<String, dynamic>)).toList();
  }

  Future<Event> getEventDetail(String eventId) async {
    final row = await _client
        .from('events')
        .select('*, venue:venue_id(name, address_line1, latitude, longitude), retailer:retailer_id(name, logo_url)')
        .eq('id', eventId)
        .single();
    return Event.fromMap(row as Map<String, dynamic>);
  }

  Future<bool> hasReminder(String eventId, String profileId) async {
    final rows = await _client
        .from('event_reminders')
        .select('id')
        .eq('event_id', eventId)
        .eq('profile_id', profileId)
        .limit(1);
    return (rows as List).isNotEmpty;
  }

  Future<void> setReminder(String eventId, String profileId) async {
    await _client.from('event_reminders').upsert({
      'event_id': eventId,
      'profile_id': profileId,
    });
  }

  Future<void> removeReminder(String eventId, String profileId) async {
    await _client
        .from('event_reminders')
        .delete()
        .eq('event_id', eventId)
        .eq('profile_id', profileId);
  }

  Future<void> logEventView(String eventId, String? profileId) async {
    await _client.from('event_views').insert({
      'event_id': eventId,
      if (profileId != null) 'profile_id': profileId,
    });
  }
}
