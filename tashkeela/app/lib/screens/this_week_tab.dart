import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../group_post.dart';
import '../l10n.dart';
import '../models.dart';
import '../roster_line.dart';
import '../services/services.dart';
import '../theme.dart';
import '../widgets.dart';
import 'home_shell.dart';
import 'result_screen.dart';
import 'storage_photo.dart';

class ThisWeekTab extends StatelessWidget {
  const ThisWeekTab({super.key, required this.view, required this.onSwitchGroup, required this.onOpenSquad});

  final GroupView view;
  final ValueChanged<String> onSwitchGroup;
  final VoidCallback onOpenSquad;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final game = view.game;
    return ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
      _Header(view: view, onSwitchGroup: onSwitchGroup),
      const SizedBox(height: 16),
      if (game == null)
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Text(s.t('Setting up this week…', 'بنجهز ماتش الأسبوع…')),
          ),
        )
      else ...[
        _MatchCard(view: view, game: game, onOpenSquad: onOpenSquad),
        const SizedBox(height: 12),
        _ActionArea(view: view, game: game),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => SharePlus.instance.share(ShareParams(
            text: squadPost(
              s: s,
              group: view.group,
              game: game,
              line: view.line,
              members: view.membersById,
              link: appUrl,
            ),
          )),
          icon: const Icon(Icons.ios_share),
          label: Text(s.t('Share the list to the group', 'شارك القائمة في الجروب')),
        ),
        if (view.isAdmin && game.status == GameStatus.scheduled) ...[
          const SizedBox(height: 8),
          BusyButton(
            style: BusyStyle.outlined,
            icon: Icons.how_to_vote_outlined,
            label: s.t('Open the poll now', 'افتح التصويت دلوقتي'),
            onPressed: () => runAction(context, () => context.services.api.openPollNow(view.group.id)),
          ),
        ],
        _Changes(view: view),
      ],
      _ChampionsCard(view: view),
    ]);
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.view, required this.onSwitchGroup});

  final GroupView view;
  final ValueChanged<String> onSwitchGroup;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final week = view.game?.weekNumber;
    return Row(children: [
      StoragePhoto(path: view.group.lastChampions?.photoPath, size: 52),
      const SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(view.group.name, style: display(26), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 4),
          Text(
            [
              if (week != null) s.t('Week ${s.n(week)}', 'الأسبوع ${s.n(week)}'),
              view.members.length == 1
                  ? s.t('1 member', 'عضو واحد')
                  : s.t('${s.n(view.members.length)} members', '${s.n(view.members.length)} عضو'),
            ].join(s.sep),
            style: const TextStyle(color: Palette.muted, fontSize: 13),
          ),
        ]),
      ),
      if (view.groupIds.length > 1)
        PopupMenuButton<String>(
          tooltip: s.t('Switch group', 'غيّر الجروب'),
          icon: const Icon(Icons.swap_horiz),
          onSelected: onSwitchGroup,
          itemBuilder: (_) => [
            for (final id in view.groupIds)
              PopupMenuItem(value: id, child: _GroupName(groupId: id, current: id == view.group.id)),
          ],
        ),
    ]);
  }
}

class _GroupName extends StatelessWidget {
  const _GroupName({required this.groupId, required this.current});

  final String groupId;
  final bool current;

  @override
  Widget build(BuildContext context) => StreamBuilder<Group?>(
        stream: context.services.repo.group(groupId),
        builder: (_, snap) => Text(snap.data?.name ?? '…',
            style: TextStyle(fontWeight: current ? FontWeight.w700 : FontWeight.w400)),
      );
}

class _MatchCard extends StatelessWidget {
  const _MatchCard({required this.view, required this.game, required this.onOpenSquad});

  final GroupView view;
  final Game game;
  final VoidCallback onOpenSquad;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final line = view.line;
    final status = view.myStatus;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onOpenSquad,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text(s.day(game.kickoffAt).toUpperCase(), style: display(28)),
              ),
              Text(s.time(game.kickoffAt), style: display(28, color: Palette.lime)),
            ]),
            const SizedBox(height: 6),
            Row(children: [
              const Icon(Icons.place_outlined, size: 16, color: Palette.muted),
              const SizedBox(width: 4),
              Expanded(child: Text(view.group.venue, style: const TextStyle(color: Palette.muted))),
            ]),
            // Only while the game is still ahead; a closed, played or cancelled game has nothing to count down to.
            if ((game.status == GameStatus.scheduled || game.status == GameStatus.open) && DateTime.now().isBefore(game.kickoffAt)) ...[
              const SizedBox(height: 4),
              Countdown(
                target: game.kickoffAt,
                builder: (_, left) => Text(s.t('Kick-off in ${s.countdown(left)}', 'الماتش بعد ${s.countdown(left)}'),
                    style: const TextStyle(color: Palette.muted)),
              ),
            ],
            const SizedBox(height: 14),
            _StatusPill(status: status, line: line),
            const SizedBox(height: 14),
            _CapacityBar(line: line),
            const SizedBox(height: 8),
            Row(children: [
              Text(s.t('${s.n(line.squad.length)} / ${s.n(line.squadSize)} in', '${s.n(line.squad.length)} / ${s.n(line.squadSize)} جوه'),
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              const Spacer(),
              if (line.reserves.isNotEmpty)
                Text(s.t('${s.n(line.reserves.length)} ${line.reserves.length == 1 ? 'reserve' : 'reserves'}', '${s.n(line.reserves.length)} احتياطي'),
                    style: const TextStyle(color: Palette.amber, fontWeight: FontWeight.w700)),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status, required this.line});

  final MyStatus status;
  final RosterLine line;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    return switch (status.kind) {
      MyStatusKind.squad => Pill(
          s.t("You're in${s.sep}#${s.n(status.position!)} of ${s.n(line.squadSize)}",
              'إنت جوه${s.sep}رقم ${s.n(status.position!)} من ${s.n(line.squadSize)}'),
          icon: Icons.check_circle,
        ),
      MyStatusKind.offered => Pill(s.t('A spot is waiting for you', 'فيه مكان مستنيك'), color: Palette.amber, icon: Icons.bolt),
      MyStatusKind.reserve =>
        Pill(s.t('Reserve #${s.n(status.reserveNumber!)}', 'احتياطي رقم ${s.n(status.reserveNumber!)}'), color: Palette.amber),
      MyStatusKind.out => Pill(s.t('Not playing this week', 'مش لاعب الأسبوع ده'), color: Palette.muted),
      MyStatusKind.notIn => Pill(s.t('Not on the list', 'مش في القائمة'), color: Palette.muted),
    };
  }
}

class _CapacityBar extends StatelessWidget {
  const _CapacityBar({required this.line});

  final RosterLine line;

  @override
  Widget build(BuildContext context) {
    final cells = line.squadSize + line.reserves.length;
    return Semantics(
      label: '${line.squad.length} of ${line.squadSize}, ${line.reserves.length} ${line.reserves.length == 1 ? 'reserve' : 'reserves'}',
      child: Row(children: [
        for (var i = 0; i < cells; i++)
          Expanded(
            child: Container(
              height: 8,
              margin: const EdgeInsetsDirectional.only(end: 2),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                color: i < line.squad.length
                    ? (line.squad[i].state == EntryState.offered ? Palette.amber : Palette.lime)
                    : i < line.squadSize
                        ? Palette.line
                        : Palette.amber.withValues(alpha: 0.6),
              ),
            ),
          ),
      ]),
    );
  }
}

/// The one thing to do right now, depending on the poll and your place in it.
class _ActionArea extends StatelessWidget {
  const _ActionArea({required this.view, required this.game});

  final GroupView view;
  final Game game;

  Future<void> _act(BuildContext context, String action) async {
    final s = context.s;
    final r = await runAction(context, () => context.services.api.rosterAction(view.group.id, game.id, action));
    if (r == null || !context.mounted) return;
    final text = switch ((action, r.state)) {
      ('join', 'confirmed') => s.t("You're in! #${s.n(r.position ?? 0)}", 'إنت جوه! رقم ${s.n(r.position ?? 0)}'),
      ('join', _) => s.t('Squad is full. You\'re reserve #${s.n((r.position ?? 0) - view.line.squadSize)}',
          'التشكيلة كاملة. إنت احتياطي رقم ${s.n((r.position ?? 0) - view.line.squadSize)}'),
      ('confirm', _) => s.t('Spot confirmed. See you there!', 'اتأكد مكانك. نشوفك!'),
      ('pass', _) => s.t('The spot goes to the next reserve.', 'المكان راح للي بعدك.'),
      _ => s.t("Done. You're off the list.", 'تمام، اتشلت من القائمة.'),
    };
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final status = view.myStatus;

    if (view.me == null) {
      return Text(s.t("You're not a member of this group.", 'إنت مش عضو في الجروب ده.'),
          style: const TextStyle(color: Palette.muted));
    }

    switch (game.status) {
      case GameStatus.scheduled:
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              const Icon(Icons.schedule, color: Palette.muted),
              const SizedBox(width: 12),
              Expanded(
                child: Countdown(
                  target: game.pollOpensAt,
                  builder: (_, left) => Text(
                    s.t('Poll opens ${s.when(game.pollOpensAt)}${s.sep}in ${s.countdown(left)}',
                        'التصويت يفتح ${s.when(game.pollOpensAt)}${s.sep}بعد ${s.countdown(left)}'),
                  ),
                ),
              ),
            ]),
          ),
        );
      case GameStatus.closed || GameStatus.played || GameStatus.cancelled:
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(
            game.status == GameStatus.played
                ? s.t('Full time.', 'الماتش خلص.')
                : s.t('The poll for this game is closed.', 'التصويت للماتش ده اتقفل.'),
            style: const TextStyle(color: Palette.muted),
          ),
          if (view.isAdmin && game.status == GameStatus.closed) ...[
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ResultScreen(group: view.group))),
              icon: const Icon(Icons.emoji_events_outlined),
              label: Text(s.t('Record the winners', 'سجّل الفريق الكسبان')),
            ),
          ],
        ]);
      case GameStatus.open:
        break;
    }

    switch (status.kind) {
      case MyStatusKind.notIn || MyStatusKind.out:
        return SizedBox(
          height: 64,
          child: BusyButton(
            icon: Icons.sports_soccer,
            label: s.t("I'M IN", 'أنا جاي'),
            onPressed: () => _act(context, 'join'),
          ),
        );
      case MyStatusKind.squad:
        return BusyButton(
          style: BusyStyle.danger,
          icon: Icons.event_busy,
          label: s.t("Can't make it", 'مش هقدر آجي'),
          onPressed: () => _confirmDropOut(context),
        );
      case MyStatusKind.reserve:
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(
            s.t("We'll message you on WhatsApp and here as soon as a spot opens.",
                'هنبعتلك على واتساب وهنا أول ما يفضى مكان.'),
            style: const TextStyle(color: Palette.muted),
          ),
          const SizedBox(height: 8),
          BusyButton(
            style: BusyStyle.outlined,
            label: s.t('Leave the queue', 'اخرج من الطابور'),
            onPressed: () => _act(context, 'drop'),
          ),
        ]);
      case MyStatusKind.offered:
        return _OfferCard(
          expiresAt: status.offerExpiresAt,
          onConfirm: () => _act(context, 'confirm'),
          onPass: () => _act(context, 'pass'),
          nextReserve: view.line.nextReserve?.name,
        );
    }
  }

  Future<void> _confirmDropOut(BuildContext context) async {
    final s = context.s;
    final line = view.line;
    final next = line.nextReserve;
    final lateFrom = game.kickoffAt.subtract(Duration(hours: view.group.rules.lateDropOutHours));
    final late = DateTime.now().isAfter(lateFrom);
    final window = DateUtils.isSameDay(DateTime.now(), game.kickoffAt.toLocal())
        ? view.group.rules.matchDayConfirmWindowMinutes
        : view.group.rules.confirmWindowMinutes;
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(s.t("CAN'T MAKE IT?", 'مش هتقدر تيجي؟'), style: display(28)),
          const SizedBox(height: 12),
          Text(next == null
              ? s.t('There are no reserves, so the squad will be one short.', 'مفيش احتياطي، التشكيلة هتبقى ناقصة واحد.')
              : s.t(
                  '${next.name} (reserve #1) will be offered your spot and has ${_window(s, window)} to confirm.',
                  'المكان هيتعرض على ${next.name} (احتياطي رقم ١) وقدامه ${_window(s, window)} يأكد.')),
          if (late) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Palette.amber.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                const Icon(Icons.warning_amber_rounded, color: Palette.amber),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(s.t(
                    'Less than ${s.n(view.group.rules.lateDropOutHours)} hours to kick-off: this counts as a late drop-out.',
                    'فاضل أقل من ${s.n(view.group.rules.lateDropOutHours)} ساعة على الماتش: ده اعتذار متأخر.',
                  )),
                ),
              ]),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Palette.coral),
            onPressed: () => Navigator.of(sheet).pop(true),
            child: Text(s.t('Confirm drop-out', 'أكد الاعتذار')),
          ),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: () => Navigator.of(sheet).pop(false), child: Text(s.t('Keep my spot', 'خليني في مكاني'))),
        ]),
      ),
    );
    if (confirmed == true && context.mounted) await _act(context, 'drop');
  }

  static String _window(S s, int minutes) => minutes % 60 == 0
      ? s.t('${s.n(minutes ~/ 60)} hours', '${s.n(minutes ~/ 60)} ساعة')
      : s.t('${s.n(minutes)} minutes', '${s.n(minutes)} دقيقة');
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.expiresAt, required this.onConfirm, required this.onPass, this.nextReserve});

  final DateTime? expiresAt;
  final Future<void> Function() onConfirm;
  final Future<void> Function() onPass;
  final String? nextReserve;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Palette.amber.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Palette.amber),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(s.t('A SPOT OPENED UP', 'فيه مكان فضي'), style: display(30, color: Palette.amber)),
        const SizedBox(height: 6),
        Text(s.t("Someone dropped out and you're next in line.", 'حد اعتذر وإنت الدور عليك.')),
        if (expiresAt != null) ...[
          const SizedBox(height: 12),
          Countdown(
            target: expiresAt!,
            builder: (_, left) => Text(
              s.t('${s.countdown(left)} left to confirm (until ${s.time(expiresAt!)})',
                  'فاضل ${s.countdown(left)} للتأكيد (لحد ${s.time(expiresAt!)})'),
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
        const SizedBox(height: 16),
        BusyButton(icon: Icons.check, label: s.t("Confirm, I'm in", 'أكد، أنا جاي'), onPressed: onConfirm),
        const SizedBox(height: 8),
        BusyButton(
          style: BusyStyle.outlined,
          label: nextReserve == null
              ? s.t('Pass', 'عدّي')
              : s.t('Pass to $nextReserve', 'سيبها لـ$nextReserve'),
          onPressed: onPass,
        ),
      ]),
    );
  }
}

/// Recent list changes, so everyone sees what happened and why.
class _Changes extends StatelessWidget {
  const _Changes({required this.view});

  final GroupView view;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final items = view.log.where((l) => l.type != 'joined').take(5).toList();
    if (items.isEmpty) return const SizedBox.shrink();
    String text(LogItem l) {
      final name = view.nameOf(l.memberId);
      return switch (l.type) {
        'dropped' => l.late ? s.t('$name dropped out (late)', '$name اعتذر (متأخر)') : s.t('$name dropped out', '$name اعتذر'),
        'offered' => s.t('$name was offered a spot', 'اتعرض مكان على $name'),
        'confirmed' => s.t('$name confirmed', '$name أكد'),
        'passed' => s.t('$name passed', '$name عدّى'),
        'expired' => s.t("$name's offer expired", 'وقت $name خلص'),
        'removed' => s.t('$name was taken off the list', '$name اتشال من القائمة'),
        _ => name,
      };
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionTitle(s.t('Latest changes', 'آخر التغييرات')),
      Card(
        child: Column(children: [
          for (final (i, l) in items.indexed) ...[
            if (i > 0) const Divider(),
            ListTile(
              dense: true,
              title: Text(text(l)),
              trailing: Text(s.time(l.at), style: const TextStyle(color: Palette.muted, fontSize: 12)),
            ),
          ],
        ]),
      ),
    ]);
  }
}

class _ChampionsCard extends StatelessWidget {
  const _ChampionsCard({required this.view});

  final GroupView view;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final c = view.group.lastChampions;
    if (c == null) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionTitle(s.t('Last champions', 'أبطال آخر ماتش')),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            StoragePhoto(path: c.photoPath, size: 64),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(s.t('TEAM ${c.winner.toUpperCase()}', 'فريق ${c.winner}'), style: display(24, color: Palette.lime)),
                const SizedBox(height: 4),
                Text(s.t('Week ${s.n(c.weekNumber)} champions', 'أبطال الأسبوع ${s.n(c.weekNumber)}'),
                    style: const TextStyle(color: Palette.muted)),
              ]),
            ),
          ]),
        ),
      ),
    ]);
  }
}
