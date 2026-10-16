import 'package:flutter/material.dart';

import '../l10n.dart';
import '../levels.dart';
import '../models.dart';
import '../services/services.dart';
import '../theme.dart';
import '../widgets.dart';
import 'home_shell.dart';

class SquadTab extends StatelessWidget {
  const SquadTab({super.key, required this.view});

  final GroupView view;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final game = view.game;
    final line = view.line;
    final members = view.membersById;
    final meId = view.me?.id;
    final canEdit = view.isAdmin && game?.status == GameStatus.open;

    Widget row(Entry e, String number, {Color numberColor = Palette.text}) {
      final member = members[e.memberId];
      final isMe = e.memberId == meId;
      return ListTile(
        leading: SizedBox(
          width: 36,
          child: Text(number, textAlign: TextAlign.center, style: display(22, color: numberColor)),
        ),
        title: Text(e.name,
            style: TextStyle(fontWeight: isMe ? FontWeight.w700 : FontWeight.w500, color: isMe ? Palette.lime : null)),
        subtitle: e.source == 'whatsapp' ? Text(s.t('via WhatsApp', 'من واتساب'), style: const TextStyle(fontSize: 12)) : null,
        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
          if (view.isAdmin) ...[
            Pill(levelBadge(s, view.levelOf(e.memberId)), color: levelColor(view.levelOf(e.memberId))),
            const SizedBox(width: 6),
          ],
          if (member?.isGoalkeeper ?? false) Pill(s.t('GK', 'حارس'), color: Palette.sky),
          if (e.state == EntryState.offered) ...[
            const SizedBox(width: 6),
            Pill(s.t('Confirming', 'بيأكد'), color: Palette.amber),
          ],
          if (isMe) ...[const SizedBox(width: 6), Pill(s.t('You', 'إنت'), filled: true)],
          if (canEdit)
            PopupMenuButton<String>(
              tooltip: s.t('Organizer actions', 'إجراءات المنظم'),
              onSelected: (_) => runAction(
                context,
                () => context.services.api.adminRosterAction(view.group.id, game!.id, e.memberId, 'remove'),
                success: s.t('${e.name} was taken off the list.', '${e.name} اتشال من القائمة.'),
              ),
              itemBuilder: (_) => [PopupMenuItem(value: 'remove', child: Text(s.t('Take off the list', 'شيله من القائمة')))],
            ),
        ]),
      );
    }

    if (game == null) return const Loading();

    return ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
      Row(children: [
        Expanded(child: Text(s.t('SQUAD', 'التشكيلة'), style: display(30))),
        Text('${s.n(line.squad.length)} / ${s.n(line.squadSize)}', style: display(30, color: Palette.lime)),
      ]),
      Text(s.when(game.kickoffAt), style: const TextStyle(color: Palette.muted)),
      const SizedBox(height: 12),
      Card(
        child: Column(children: [
          if (line.squad.isEmpty)
            Padding(
              padding: const EdgeInsets.all(20),
              child: Text(s.t('Nobody yet.', 'لسه محدش.'), style: const TextStyle(color: Palette.muted)),
            ),
          for (final (i, e) in line.squad.indexed) row(e, s.n(i + 1)),
          if (line.squad.isNotEmpty && line.openSpots > 0)
            ListTile(
              leading: const SizedBox(width: 36, child: Icon(Icons.add_circle_outline, color: Palette.muted)),
              title: Text(s.t('${s.n(line.openSpots)} open spots', 'فاضل ${s.n(line.openSpots)} مكان'),
                  style: const TextStyle(color: Palette.muted)),
            ),
        ]),
      ),
      SectionTitle(s.t('Reserve queue', 'طابور الاحتياطي'), trailing: Text(s.n(line.reserves.length), style: display(18, color: Palette.amber))),
      Card(
        child: Column(children: [
          if (line.reserves.isEmpty)
            Padding(
              padding: const EdgeInsets.all(20),
              child: Text(s.t('No reserves.', 'مفيش احتياطي.'), style: const TextStyle(color: Palette.muted)),
            ),
          for (final (i, e) in line.reserves.indexed) row(e, '${s.t('R', 'ح')}${s.n(i + 1)}', numberColor: Palette.amber),
        ]),
      ),
      if (line.out.isNotEmpty) ...[
        SectionTitle(s.t('Not playing', 'مش لاعبين')),
        Card(
          child: Column(children: [
            for (final e in line.out)
              ListTile(
                dense: true,
                title: Text(e.name, style: const TextStyle(color: Palette.muted)),
                trailing: Text(
                  switch (e.outReason) {
                    'dropped' => e.lateDropOut ? s.t('Late drop-out', 'اعتذار متأخر') : s.t('Dropped out', 'اعتذر'),
                    'passed' => s.t('Passed', 'عدّى'),
                    'expired' => s.t('Offer expired', 'وقته خلص'),
                    'removed' => s.t('Removed', 'اتشال'),
                    _ => '',
                  },
                  style: TextStyle(color: e.lateDropOut ? Palette.coral : Palette.muted, fontSize: 12),
                ),
              ),
          ]),
        ),
      ],
      if (canEdit) ...[
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: () => _addToList(context),
          icon: const Icon(Icons.person_add_alt),
          label: Text(s.t('Add a player to the list', 'ضيف لعيب للقائمة')),
        ),
      ],
    ]);
  }

  /// For players who asked the organizer directly.
  Future<void> _addToList(BuildContext context) async {
    final s = context.s;
    final listed = view.line.squad.followedBy(view.line.reserves).map((e) => e.memberId).toSet();
    final candidates = view.members.where((m) => !listed.contains(m.id)).toList();
    final picked = await showModalBottomSheet<Member>(
      context: context,
      isScrollControlled: true,
      builder: (sheet) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * 0.7),
          child: ListView(shrinkWrap: true, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text(s.t('ADD TO THE LIST', 'ضيف للقائمة'), style: display(24)),
            ),
            if (candidates.isEmpty)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Text(s.t('Everyone is already on the list.', 'كله في القائمة.')),
              ),
            for (final m in candidates)
              ListTile(leading: Avatar(m.name), title: Text(m.name), onTap: () => Navigator.of(sheet).pop(m)),
          ]),
        ),
      ),
    );
    if (picked == null || !context.mounted) return;
    await runAction(
      context,
      () => context.services.api.adminRosterAction(view.group.id, view.game!.id, picked.id, 'join'),
      success: s.t('${picked.name} was added.', '${picked.name} اتضاف.'),
    );
  }
}
