import 'package:flutter/material.dart';

import '../l10n.dart';
import '../services/services.dart';
import '../widgets.dart';
import 'create_group_screen.dart';
import 'home_shell.dart';

/// Picks the group to show: none yet, one, or the one chosen from several.
class GroupGate extends StatefulWidget {
  const GroupGate({super.key, required this.uid});

  final String uid;

  @override
  State<GroupGate> createState() => _GroupGateState();
}

class _GroupGateState extends State<GroupGate> {
  String? _selected;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final services = context.services;
    return StreamBuilder<List<String>>(
      stream: services.repo.groupIdsOf(widget.uid),
      builder: (context, snap) {
        if (!snap.hasData) return const Scaffold(body: Loading());
        final ids = snap.data!;
        if (ids.isEmpty) {
          return Scaffold(
            body: SafeArea(
              child: Message(
                icon: Icons.groups_outlined,
                title: s.t('No group yet', 'لسه مفيش جروب'),
                body: s.t(
                  'Ask your organizer to add your number, then open the app again. Or start a group for your own game.',
                  'اطلب من المنظم يضيف رقمك وافتح التطبيق تاني. أو اعمل جروب لماتشك.',
                ),
                action: Column(children: [
                  FilledButton.icon(
                    onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CreateGroupScreen())),
                    icon: const Icon(Icons.add),
                    label: Text(s.t('Start a group', 'اعمل جروب')),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () async {
                      await services.push.unregister(widget.uid);
                      await services.auth.signOut();
                    },
                    child: Text(s.t('Sign out', 'خروج')),
                  ),
                ]),
              ),
            ),
          );
        }
        final groupId = ids.contains(_selected) ? _selected! : ids.first;
        return HomeShell(
          key: ValueKey(groupId),
          groupId: groupId,
          uid: widget.uid,
          groupIds: ids,
          onSwitchGroup: (id) => setState(() => _selected = id),
        );
      },
    );
  }
}
