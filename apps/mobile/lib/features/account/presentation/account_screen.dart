import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../../auth/providers/auth_providers.dart';
import '../../memberships/domain/membership.dart';
import '../../memberships/providers/membership_providers.dart';
import '../../profile/providers/profile_providers.dart';

class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  bool _signingOut = false;
  bool _uploadingAvatar = false;

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileProvider);
    final membershipAsync = ref.watch(currentMembershipProvider);

    final profile = profileAsync.valueOrNull;
    final membership = membershipAsync.valueOrNull;

    return Scaffold(
      backgroundColor: AppColors.cream,
      appBar: AppBar(
        backgroundColor: AppColors.cream,
        elevation: 0,
        title: const Text('Account'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Settings',
            onPressed: () => context.go(RouteNames.settings),
          ),
        ],
      ),
      body: ListView(
        children: [
          // ── Profile ─────────────────────────────────────────────────────────
          _SectionCard(
            children: [
              _ProfileTile(
                name: profile?.fullName,
                email: profile?.email,
                avatarUrl: profile?.avatarUrl,
                loading: profileAsync.isLoading,
                uploadingAvatar: _uploadingAvatar,
                onEditName: () => _editName(currentName: profile?.fullName ?? ''),
                onChangeAvatar: _pickAndUploadAvatar,
                onChangeEmail: _changeEmail,
              ),
            ],
          ),

          // ── Membership ──────────────────────────────────────────────────────
          const _SectionLabel('Membership'),
          _SectionCard(
            children: [
              _MembershipTile(
                membership: membership,
                loading: membershipAsync.isLoading,
                onViewPass: () => context.go(RouteNames.card),
                onSubscribe: () => context.push(RouteNames.paywall),
                onManagePlan: _managePlan,
              ),
            ],
          ),

          // ── Activity ────────────────────────────────────────────────────────
          const _SectionLabel('Activity'),
          _SectionCard(
            children: [
              _NavTile(
                icon: Icons.favorite_border,
                label: 'Favourites',
                onTap: () => context.push(RouteNames.favourites),
              ),
              const _Divider(),
              const _Divider(),
              _NavTile(
                icon: Icons.receipt_long_outlined,
                label: 'Redemption history',
                onTap: () => context.push(RouteNames.redemptionHistory),
              ),
              const _Divider(),
              _NavTile(
                icon: Icons.savings_outlined,
                label: 'My savings',
                onTap: () => context.push(RouteNames.savings),
              ),
            ],
          ),

          // ── Account ─────────────────────────────────────────────────────────
          const _SectionLabel('Account'),
          _SectionCard(
            children: [
              _NavTile(
                icon: Icons.settings_outlined,
                label: 'Settings',
                onTap: () => context.go(RouteNames.settings),
              ),
              const _Divider(),
              ListTile(
                leading: _signingOut
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.logout, color: AppColors.error, size: 20),
                title: const Text(
                  'Sign out',
                  style: TextStyle(color: AppColors.error, fontSize: 14),
                ),
                dense: true,
                onTap: _signingOut ? null : _confirmSignOut,
              ),
            ],
          ),

          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
            child: Text(
              'Version ${AppConstants.appVersion}',
              style: const TextStyle(fontSize: 11, color: AppColors.textDisabled),
              textAlign: TextAlign.center,
            ),
          ),

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Avatar
  // ---------------------------------------------------------------------------

  Future<void> _pickAndUploadAvatar() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 400,
      maxHeight: 400,
      imageQuality: 85,
    );
    if (picked == null || !mounted) return;

    final session = ref.read(sessionProvider).valueOrNull;
    if (session == null) return;

    final bytes = await picked.readAsBytes();
    if (!mounted) return;

    if (bytes.length > 5 * 1024 * 1024) {
      _showError('Image must be under 5 MB.');
      return;
    }

    final ext = picked.path.split('.').last.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].contains(ext)) {
      _showError('Please pick a JPG, PNG, or WebP image.');
      return;
    }

    setState(() => _uploadingAvatar = true);

    try {
      final supabase = ref.read(supabaseClientProvider);
      final ts = DateTime.now().millisecondsSinceEpoch;
      final storagePath = '${session.user.id}/avatar-$ts.$ext';
      final contentType = ext == 'jpg' ? 'image/jpeg' : 'image/$ext';

      await supabase.storage.from('consumer-assets').uploadBinary(
        storagePath,
        bytes,
        fileOptions: FileOptions(contentType: contentType, upsert: true),
      );

      final url = supabase.storage
          .from('consumer-assets')
          .getPublicUrl(storagePath);

      await ref.read(profileRepositoryProvider).updateProfile(
            userId: session.user.id,
            avatarUrl: url,
          );

      if (!mounted) return;
      ref.invalidate(profileProvider);
    } catch (e) {
      if (mounted) _showError('Upload failed. Please try again.');
    } finally {
      if (mounted) setState(() => _uploadingAvatar = false);
    }
  }

  // ---------------------------------------------------------------------------
  // Name edit
  // ---------------------------------------------------------------------------

  Future<void> _editName({required String currentName}) async {
    final controller = TextEditingController(text: currentName);
    final confirmed = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit name'),
        content: TextField(
          controller: controller,
          autofocus: true,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(
            hintText: 'Your full name',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    controller.dispose();

    if (confirmed == null || confirmed.isEmpty || !mounted) return;
    final session = ref.read(sessionProvider).valueOrNull;
    if (session == null) return;

    await ref.read(profileRepositoryProvider).updateProfile(
          userId: session.user.id,
          fullName: confirmed,
        );

    // Guard mounted before touching ref after the async gap.
    if (!mounted) return;
    ref.invalidate(profileProvider);
  }

  // ---------------------------------------------------------------------------
  // Email change
  // ---------------------------------------------------------------------------

  Future<void> _changeEmail() async {
    final controller = TextEditingController();
    final newEmail = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Change email'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enter your new email address. A confirmation link will be sent to it before the change takes effect.',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                hintText: 'new@example.com',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Send confirmation'),
          ),
        ],
      ),
    );
    controller.dispose();

    if (newEmail == null || newEmail.isEmpty || !mounted) return;

    try {
      final supabase = ref.read(supabaseClientProvider);
      await supabase.auth.updateUser(UserAttributes(email: newEmail));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Confirmation sent to $newEmail. Check your inbox.'),
          duration: const Duration(seconds: 4),
        ),
      );
    } catch (e) {
      if (mounted) _showError('Could not update email. Please try again.');
    }
  }

  // ---------------------------------------------------------------------------
  // Manage plan → Stripe Customer Portal
  // ---------------------------------------------------------------------------

  Future<void> _managePlan() async {
    if (!mounted) return;
    final scaffold = ScaffoldMessenger.of(context);

    try {
      final url = await ref
          .read(membershipRepositoryProvider)
          .createPortalSession();
      if (!mounted) return;
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      scaffold.showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Sign out
  // ---------------------------------------------------------------------------

  Future<void> _confirmSignOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign out',
                style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      setState(() => _signingOut = true);
      await ref.read(authRepositoryProvider).signOut();
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.error,
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Profile tile — avatar (editable) + name (editable) + email (changeable)
// ---------------------------------------------------------------------------

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    this.name,
    this.email,
    this.avatarUrl,
    required this.loading,
    required this.uploadingAvatar,
    required this.onEditName,
    required this.onChangeAvatar,
    required this.onChangeEmail,
  });

  final String? name;
  final String? email;
  final String? avatarUrl;
  final bool loading;
  final bool uploadingAvatar;
  final VoidCallback onEditName;
  final VoidCallback onChangeAvatar;
  final VoidCallback onChangeEmail;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    final initials = (name ?? email ?? '?')
        .trim()
        .split(RegExp(r'\s+'))
        .map((w) => w.isNotEmpty ? w[0].toUpperCase() : '')
        .take(2)
        .join();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
      child: Row(
        children: [
          // Avatar — tappable to change
          GestureDetector(
            onTap: uploadingAvatar ? null : onChangeAvatar,
            child: Stack(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: AppColors.primary,
                  backgroundImage: avatarUrl != null
                      ? NetworkImage(avatarUrl!)
                      : null,
                  child: avatarUrl == null
                      ? Text(
                          initials,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 18,
                          ),
                        )
                      : null,
                ),
                // Camera badge
                Positioned(
                  right: 0,
                  bottom: 0,
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      color: uploadingAvatar ? Colors.grey : AppColors.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                    child: uploadingAvatar
                        ? const Padding(
                            padding: EdgeInsets.all(3),
                            child: CircularProgressIndicator(
                              strokeWidth: 1.5,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.camera_alt,
                            size: 11, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 14),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Name row
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        name ?? 'Add your name',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: name != null
                              ? AppColors.textPrimary
                              : AppColors.textDisabled,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: onEditName,
                      child: const Padding(
                        padding: EdgeInsets.all(4),
                        child: Icon(Icons.edit_outlined,
                            size: 16, color: AppColors.textDisabled),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                // Email row
                if (email != null)
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          email!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: onChangeEmail,
                        child: const Padding(
                          padding: EdgeInsets.all(4),
                          child: Icon(Icons.edit_outlined,
                              size: 16, color: AppColors.textDisabled),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Membership tile
// ---------------------------------------------------------------------------

class _MembershipTile extends StatelessWidget {
  const _MembershipTile({
    required this.membership,
    required this.loading,
    required this.onViewPass,
    required this.onSubscribe,
    required this.onManagePlan,
  });

  final Membership? membership;
  final bool loading;
  final VoidCallback onViewPass;
  final VoidCallback onSubscribe;
  final VoidCallback onManagePlan;

  String _formatDate(DateTime? dt) =>
      dt == null ? '—' : DateFormat('d MMM yyyy').format(dt.toLocal());

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (membership == null || !membership!.isEntitled) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'No active membership',
              style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onSubscribe,
                child: const Text('Subscribe'),
              ),
            ),
          ],
        ),
      );
    }

    final m = membership!;
    final (statusLabel, statusColor) = switch (m.status) {
      MembershipStatus.active   => ('Active',   AppColors.success),
      MembershipStatus.trialing => ('Trial',    AppColors.info),
      MembershipStatus.pastDue  => ('Past due', AppColors.warning),
      MembershipStatus.cancelled=> ('Cancelled',AppColors.error),
      MembershipStatus.expired  => ('Expired',  AppColors.error),
      MembershipStatus.inactive => ('Inactive', AppColors.textDisabled),
    };

    final planLabel = m.planInterval == MembershipPlanInterval.annual
        ? 'Annual plan'
        : 'Monthly plan';
    final renewLabel = m.cancelAtPeriodEnd ? 'Ends' : 'Renews';

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                planLabel,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '$renewLabel ${_formatDate(m.currentPeriodEnd)}',
            style: const TextStyle(fontSize: 12, color: AppColors.textDisabled),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onViewPass,
                  icon: const Icon(Icons.credit_card_outlined, size: 16),
                  label: const Text('View pass'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: onManagePlan,
                  child: const Text('Manage plan'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared layout primitives
// ---------------------------------------------------------------------------

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 6),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: AppColors.textDisabled,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: children,
        ),
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textSecondary, size: 20),
      title: Text(label, style: const TextStyle(fontSize: 14)),
      trailing: const Icon(Icons.chevron_right,
          size: 18, color: AppColors.textDisabled),
      dense: true,
      onTap: onTap,
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    return const Divider(
      height: 1,
      indent: 52,
      endIndent: 0,
      color: AppColors.border,
    );
  }
}
