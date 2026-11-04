import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pos_mobile/main.dart';
import '../../providers/auth_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_outlined),
          onPressed: openAppDrawer,
          tooltip: 'Open menu',
        ),
        title: const Text('Settings'),
      ),
      body: ListView(
        children: [
          // Profile card
          if (user != null)
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF6C63FF), Color(0xFF4A90D9)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: Colors.white24,
                    child: Text(
                      user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user.name,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          user.email,
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 13),
                        ),
                        if (user.outletName != null) ...[
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(Icons.store,
                                  color: Colors.white70, size: 14),
                              const SizedBox(width: 4),
                              Text(
                                user.outletName!,
                                style: const TextStyle(
                                    color: Colors.white70, fontSize: 13),
                              ),
                            ],
                          ),
                        ],
                        if (user.roles.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 6,
                            children: user.roles
                                .map((r) => Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: Colors.white24,
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: Text(r,
                                          style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 11)),
                                    ))
                                .toList(),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),

          const Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Text('Account',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey,
                    letterSpacing: 1)),
          ),

          ListTile(
            leading: const Icon(Icons.person_outline),
            title: const Text('Profile'),
            subtitle: user != null ? Text(user.email) : null,
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              // Future: navigate to edit profile
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Profile editing coming soon')),
              );
            },
          ),

          const Divider(indent: 16, endIndent: 16),

          const Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Text('App',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey,
                    letterSpacing: 1)),
          ),

          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('Version'),
            trailing: const Text('1.0.0',
                style: TextStyle(color: Colors.grey)),
          ),

          const Divider(indent: 16, endIndent: 16),

          const Padding(
            padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Text('Report Access',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey,
                    letterSpacing: 1)),
          ),

          Builder(builder: (context) {
            final perms = auth.user?.permissions ?? [];
            final canContractor = perms.isEmpty || perms.contains('VIEW_CONTRACTOR_COSTS');
            return Column(children: [
              _PermTile(
                icon: Icons.precision_manufacturing_outlined,
                label: 'Fabrication Report',
                granted: canContractor,
              ),
              _PermTile(
                icon: Icons.format_paint_outlined,
                label: 'Coating Report',
                granted: canContractor,
              ),
              _PermTile(
                icon: Icons.rotate_right_outlined,
                label: 'Spinning Report',
                granted: canContractor,
              ),
            ]);
          }),

          const Divider(indent: 16, endIndent: 16),
          const SizedBox(height: 8),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton.icon(
              icon: const Icon(Icons.logout, color: Colors.red),
              label: const Text('Logout',
                  style: TextStyle(color: Colors.red, fontSize: 16)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.red),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () async {
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Logout'),
                    content: const Text('Are you sure you want to logout?'),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Cancel')),
                      TextButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Logout',
                              style: TextStyle(color: Colors.red))),
                    ],
                  ),
                );
                if (confirmed == true) {
                  await ref.read(authProvider.notifier).logout();
                }
              },
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _PermTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool granted;

  const _PermTile({required this.icon, required this.label, required this.granted});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon,
          color: granted ? const Color(0xFF10B981) : Colors.grey),
      title: Text(label),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: granted
              ? const Color(0xFF10B981).withValues(alpha: 0.1)
              : Colors.grey.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          granted ? 'Allowed' : 'Restricted',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: granted ? const Color(0xFF10B981) : Colors.grey,
          ),
        ),
      ),
    );
  }
}
