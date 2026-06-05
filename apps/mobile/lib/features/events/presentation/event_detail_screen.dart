import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/providers/session_provider.dart';
import '../domain/event.dart';
import '../providers/events_providers.dart';

class EventDetailScreen extends ConsumerWidget {
  const EventDetailScreen({super.key, required this.eventId});

  final String eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventAsync = ref.watch(eventDetailProvider(eventId));

    return eventAsync.when(
      loading: () => Scaffold(
        appBar: AppBar(backgroundColor: Colors.transparent),
        body: const LoadingIndicator(),
      ),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('Event')),
        body: ErrorState(
          message: 'Could not load event details.',
          onRetry: () => ref.invalidate(eventDetailProvider(eventId)),
        ),
      ),
      data: (event) => _EventDetailView(eventId: eventId, event: event),
    );
  }
}

// ---------------------------------------------------------------------------
// Full detail view — runs logEventView on mount.
// ---------------------------------------------------------------------------

class _EventDetailView extends ConsumerStatefulWidget {
  const _EventDetailView({required this.eventId, required this.event});

  final String eventId;
  final Event event;

  @override
  ConsumerState<_EventDetailView> createState() => _EventDetailViewState();
}

class _EventDetailViewState extends ConsumerState<_EventDetailView> {
  @override
  void initState() {
    super.initState();
    // Fire-and-forget view log.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final session = ref.read(sessionProvider).valueOrNull;
      ref
          .read(eventsDataSourceProvider)
          .logEventView(widget.eventId, session?.user.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final event = widget.event;
    final session = ref.watch(sessionProvider).valueOrNull;
    final profileId = session?.user.id;

    return Scaffold(
      backgroundColor: AppColors.cream,
      body: CustomScrollView(
        slivers: [
          // ── Sliver app bar with hero image ────────────────────────────────
          SliverAppBar(
            expandedHeight: MediaQuery.of(context).size.width * (9 / 16),
            pinned: true,
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              background: event.imageUrl != null
                  ? Image.network(
                      event.imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          const _EventHeroPlaceholder(),
                    )
                  : const _EventHeroPlaceholder(),
            ),
          ),

          // ── Event content ─────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Event type badge
                  _EventTypeBadge(eventType: event.eventType),
                  const SizedBox(height: 12),

                  // Title
                  Text(event.title, style: AppTextStyles.headlineMedium),
                  const SizedBox(height: 16),

                  // Date + time
                  _InfoRow(
                    icon: Icons.calendar_today_outlined,
                    text: '${event.formattedDate} · ${event.formattedTime}',
                  ),
                  const SizedBox(height: 8),

                  // Venue
                  if (event.venueName != null) ...[
                    _InfoRow(
                      icon: Icons.location_on_outlined,
                      text: [
                        event.venueName!,
                        if (event.venueAddress != null) event.venueAddress!,
                      ].join(', '),
                    ),
                    const SizedBox(height: 8),
                  ],

                  // Retailer
                  if (event.retailerName != null) ...[
                    _InfoRow(
                      icon: Icons.storefront_outlined,
                      text: 'By ${event.retailerName}',
                    ),
                    const SizedBox(height: 8),
                  ],

                  // End time
                  if (event.endAt != null) ...[
                    _InfoRow(
                      icon: Icons.access_time_outlined,
                      text: 'Ends ${Event._formattedTimeFrom(event.endAt!)}',
                    ),
                    const SizedBox(height: 8),
                  ],

                  const SizedBox(height: 16),

                  // Description
                  if (event.description != null &&
                      event.description!.isNotEmpty) ...[
                    const Divider(),
                    const SizedBox(height: 16),
                    SelectableText(
                      event.description!,
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppColors.textPrimary,
                        height: 1.6,
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // Booking button
                  if (event.bookingUrl != null &&
                      event.bookingUrl!.isNotEmpty) ...[
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: () => _launchBooking(event.bookingUrl!),
                        icon: const Icon(Icons.open_in_new, size: 18),
                        label: const Text('Book / Get Tickets'),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.accent,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Reminder toggle
                  if (profileId != null) ...[
                    _ReminderButton(eventId: event.id, profileId: profileId),
                    const SizedBox(height: 12),
                  ],

                  // Follow retailer CTA
                  if (event.retailerName != null &&
                      event.retailerId.isNotEmpty) ...[
                    OutlinedButton.icon(
                      onPressed: () => context.push(
                        RouteNames.retailerDetail
                            .replaceAll(':retailerId', event.retailerId),
                      ),
                      icon: const Icon(Icons.storefront_outlined, size: 18),
                      label: Text('View ${event.retailerName}'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: const BorderSide(color: AppColors.primary),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 12),
                      ),
                    ),
                    const SizedBox(height: 32),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _launchBooking(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

// ---------------------------------------------------------------------------
// Reminder toggle button — loads state, toggles on tap.
// ---------------------------------------------------------------------------

class _ReminderButton extends ConsumerStatefulWidget {
  const _ReminderButton({required this.eventId, required this.profileId});

  final String eventId;
  final String profileId;

  @override
  ConsumerState<_ReminderButton> createState() => _ReminderButtonState();
}

class _ReminderButtonState extends ConsumerState<_ReminderButton> {
  bool? _localOverride; // null = use provider value
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    final reminderAsync = ref.watch(
      eventReminderProvider((
        eventId: widget.eventId,
        profileId: widget.profileId,
      )),
    );

    return reminderAsync.when(
      loading: () => const SizedBox(
        height: 48,
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (hasReminder) {
        final isSet = _localOverride ?? hasReminder;
        return SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _loading ? null : () => _toggle(isSet),
            icon: Icon(
              isSet ? Icons.notifications_active : Icons.notifications_outlined,
              size: 18,
              color: isSet ? AppColors.success : AppColors.primary,
            ),
            label: Text(
              isSet ? 'Reminder set ✓' : 'Remind me',
              style: TextStyle(
                color: isSet ? AppColors.success : AppColors.primary,
              ),
            ),
            style: OutlinedButton.styleFrom(
              side: BorderSide(
                color: isSet ? AppColors.success : AppColors.primary,
              ),
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
          ),
        );
      },
    );
  }

  Future<void> _toggle(bool current) async {
    setState(() => _loading = true);
    try {
      final ds = ref.read(eventsDataSourceProvider);
      if (current) {
        await ds.removeReminder(widget.eventId, widget.profileId);
        setState(() => _localOverride = false);
      } else {
        await ds.setReminder(widget.eventId, widget.profileId);
        setState(() => _localOverride = true);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: AppTextStyles.bodyMedium.copyWith(
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}

class _EventTypeBadge extends StatelessWidget {
  const _EventTypeBadge({required this.eventType});

  final String eventType;

  String get _label => switch (eventType) {
        'workshop' => 'Workshop',
        'exhibition' => 'Exhibition',
        'performance' => 'Performance',
        'market' => 'Market',
        'sports' => 'Sports',
        'food_drink' => 'Food & Drink',
        'community' => 'Community',
        _ => 'Event',
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.accent,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        _label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _EventHeroPlaceholder extends StatelessWidget {
  const _EventHeroPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.background,
      child: const Center(
        child: Icon(Icons.event_outlined, size: 48, color: AppColors.border),
      ),
    );
  }
}

// Extension to allow access to static helper from within file.
extension on Event {
  static String _formattedTimeFrom(DateTime dt) {
    final d = dt.toLocal();
    final h = d.hour > 12 ? d.hour - 12 : (d.hour == 0 ? 12 : d.hour);
    final m = d.minute.toString().padLeft(2, '0');
    final ampm = d.hour >= 12 ? 'pm' : 'am';
    return '$h:${m}$ampm';
  }
}
