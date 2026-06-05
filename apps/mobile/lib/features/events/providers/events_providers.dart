import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/supabase_provider.dart';
import '../data/events_remote_data_source.dart';
import '../domain/event.dart';

final eventsDataSourceProvider = Provider<EventsRemoteDataSource>(
  (ref) => EventsRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final upcomingEventsProvider = FutureProvider.family<List<Event>, String>(
  (ref, regionId) => ref.read(eventsDataSourceProvider).getUpcomingEvents(regionId),
);

final featuredEventsProvider = FutureProvider.family<List<Event>, String>(
  (ref, regionId) => ref.read(eventsDataSourceProvider).getFeaturedEvents(regionId),
);

final thisWeekendEventsProvider = FutureProvider.family<List<Event>, String>(
  (ref, regionId) => ref.read(eventsDataSourceProvider).getThisWeekendEvents(regionId),
);

final eventDetailProvider = FutureProvider.family<Event, String>(
  (ref, eventId) => ref.read(eventsDataSourceProvider).getEventDetail(eventId),
);

/// Family param: record with eventId and profileId.
final eventReminderProvider = FutureProvider.family<bool, ({String eventId, String profileId})>(
  (ref, params) => ref.read(eventsDataSourceProvider).hasReminder(params.eventId, params.profileId),
);
