import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../group_post.dart';
import '../l10n.dart';
import '../levels.dart';
import '../models.dart';
import '../services/services.dart';
import '../teams.dart';
import '../theme.dart';
import '../widgets.dart';
import 'home_shell.dart';
import 'kit_picker.dart';

/// The teams on the Polls tab: everyone sees who plays in which kit.
/// Organizers can make or change them.
class TeamsSection extends StatelessWidget {
  const TeamsSection({super.key, required this.view, required this.game});

  final GroupView view;
  final Game game;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final teams = game.teams;
    final squad = view.line.squad.map((e) => e.memberId).toSet();
    final editable = game.status != GameStatus.cancelled && game.status != GameStatus.played;
    void open() => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TeamsScreen(view: view, game: game)));

    if (teams == null) {
      if (!view.isAdmin || !editable || squad.length < 2) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: OutlinedButton.icon(
          onPressed: open,
          icon: const Icon(Icons.groups_2_outlined),
          label: Text(s.t('Make teams', 'قسّم الفرق')),
        ),
      );
    }

    final onTeams = teams.expand((t) => t.memberIds).toSet();
    final changed = !squad.containsAll(onTeams) || !onTeams.containsAll(squad);
    final meId = view.me?.id;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionTitle(
        s.t('Teams', 'الفرق'),
        trailing: IconButton(
          tooltip: s.t('Share the teams to the group', 'شارك الفرق في الجروب'),
          onPressed: () => SharePlus.instance.share(
            ShareParams(text: teamsPost(s: s, group: view.group, game: game, teams: teams, members: view.membersById)),
          ),
          icon: const Icon(Icons.ios_share, size: 20),
        ),
      ),
      for (final team in teams)
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                KitDot(team.kit, size: 22),
                const SizedBox(width: 10),
                Expanded(child: Text(team.kit.label(s).toUpperCase(), style: display(22))),
                if (team.memberIds.contains(meId)) Pill(s.t('Your team', 'فريقك'), filled: true),
                const SizedBox(width: 8),
                Text(s.n(team.memberIds.length), style: display(20, color: Palette.muted)),
              ]),
              const SizedBox(height: 8),
              Text(
                team.memberIds.map((id) {
                  final m = view.membersById[id];
                  final gk = m?.isGoalkeeper ?? false;
                  return '${view.nameOf(id)}${gk ? s.t(' (GK)', ' (حارس)') : ''}';
                }).join(s.isAr ? '، ' : ', '),
                style: const TextStyle(height: 1.4),
              ),
            ]),
          ),
        ),
      if (view.isAdmin && editable) ...[
        if (changed)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Text(
              s.t('The list changed since the teams were made.', 'القائمة اتغيرت من ساعة ما الفرق اتقسمت.'),
              style: const TextStyle(color: Palette.amber),
            ),
          ),
        OutlinedButton.icon(
          onPressed: open,
          icon: const Icon(Icons.edit_outlined),
          label: Text(changed ? s.t('Update teams', 'حدّث الفرق') : s.t('Edit teams', 'عدّل الفرق')),
        ),
      ],
    ]);
  }
}

/// Organizer only: balanced teams from the squad, by level, in the group's kits.
/// Shuffle for another balanced split, move players by hand, change a team's kit.
class TeamsScreen extends StatefulWidget {
  const TeamsScreen({super.key, required this.view, required this.game});

  final GroupView view;
  final Game game;

  @override
  State<TeamsScreen> createState() => _TeamsScreenState();
}

class _TeamsScreenState extends State<TeamsScreen> {
  late List<Kit> _kits;
  late List<List<String>> _teams;
  int _seed = 0;

  GroupView get view => widget.view;

  List<TeamPlayer> get _players => [
        for (final e in view.line.squad)
          TeamPlayer(
            memberId: e.memberId,
            level: view.levelOf(e.memberId),
            isGoalkeeper: view.membersById[e.memberId]?.isGoalkeeper ?? false,
          ),
      ];

  @override
  void initState() {
    super.initState();
    final saved = widget.game.teams;
    if (saved != null) {
      _kits = saved.map((t) => t.kit).toList();
      _teams = fillGaps(saved.map((t) => t.memberIds).toList(), _players);
    } else {
      final kits = view.group.rules.kits;
      // Six a side by default: 18 players make three teams.
      final count = (view.line.squad.length / 6).round().clamp(2, kits.length.clamp(2, 6));
      _kits = kits.take(count).toList();
      _teams = balanceTeams(_players, _kits.length, seed: _seed);
    }
  }

  void _shuffle() => setState(() => _teams = balanceTeams(_players, _kits.length, seed: ++_seed));

  void _setTeamCount(int count) {
    setState(() {
      final kits = [..._kits];
      while (kits.length > count) {
        kits.removeLast();
      }
      // New teams take the group's next kits, then any color not in use.
      final spare = [...view.group.rules.kits, ...Kit.base, for (final w in kitSwatches) Kit.other(w)];
      for (final k in spare) {
        if (kits.length >= count) break;
        if (!kits.any((x) => x.name.toLowerCase() == k.name.toLowerCase())) kits.add(k);
      }
      _kits = kits;
      _teams = balanceTeams(_players, _kits.length, seed: _seed);
    });
  }

  Future<void> _changeKit(int i) async {
    final taken = {for (final (j, k) in _kits.indexed) if (j != i) k.name.toLowerCase()};
    final kit = await pickKit(context, current: _kits[i], taken: taken);
    if (kit != null) setState(() => _kits[i] = kit);
  }

  Future<void> _move(String memberId, int from) async {
    final s = context.s;
    final to = await showModalBottomSheet<int>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(s.t('MOVE ${view.nameOf(memberId).toUpperCase()} TO', 'انقل ${view.nameOf(memberId)} لـ'), style: display(22)),
          ),
          for (final (i, kit) in _kits.indexed)
            if (i != from)
              ListTile(
                leading: KitDot(kit, size: 24),
                title: Text(kit.label(s)),
                trailing: Text(s.n(_teams[i].length)),
                onTap: () => Navigator.of(sheet).pop(i),
              ),
        ]),
      ),
    );
    if (to == null) return;
    setState(() {
      _teams[from].remove(memberId);
      _teams[to].add(memberId);
    });
  }

  Future<void> _save({required bool share}) async {
    final s = context.s;
    final navigator = Navigator.of(context);
    final teams = [for (final (i, kit) in _kits.indexed) Team(kit: kit, memberIds: _teams[i])];
    final ok = await runAction(
      context,
      () => context.services.api.saveTeams(view.group.id, widget.game.id, teams).then((_) => true),
      success: s.t('Teams saved. Everyone can see them in the app.', 'الفرق اتحفظت. الكل يقدر يشوفها في التطبيق.'),
    );
    if (ok != true) return;
    if (share) {
      await SharePlus.instance.share(ShareParams(
        text: teamsPost(s: s, group: view.group, game: widget.game, teams: teams, members: view.membersById),
      ));
    }
    navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final players = view.line.squad.length;
    final maxTeams = (players ~/ 2).clamp(2, 6);
    return Scaffold(
      appBar: AppBar(title: Text(s.t('TEAMS', 'الفرق'))),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 32), children: [
        Text(
          s.t('Balanced by level, goalkeepers spread out. Only you see the levels.',
              'متقسمة حسب المستوى، والحراس متوزعين. إنت بس اللي بتشوف المستويات.'),
          style: const TextStyle(color: Palette.muted, fontSize: 13),
        ),
        const SizedBox(height: 12),
        Row(children: [
          Text(s.t('Teams', 'عدد الفرق')),
          const SizedBox(width: 12),
          Expanded(
            child: Wrap(spacing: 6, children: [
              for (var n = 2; n <= maxTeams; n++)
                ChoiceChip(label: Text(s.n(n)), selected: _kits.length == n, onSelected: (_) => _setTeamCount(n)),
            ]),
          ),
          IconButton.outlined(
            tooltip: s.t('Shuffle', 'قسّم تاني'),
            onPressed: _shuffle,
            icon: const Icon(Icons.shuffle),
          ),
        ]),
        const SizedBox(height: 8),
        for (final (i, kit) in _kits.indexed)
          Card(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              ListTile(
                leading: KitDot(kit, size: 26),
                title: Text(kit.label(s).toUpperCase(), style: display(22)),
                subtitle: Text(s.t(
                  '${s.n(_teams[i].length)} players${s.sep}level ${s.n(teamRating(_teams[i], view.levels))}%',
                  '${s.n(_teams[i].length)} لعيبة${s.sep}المستوى ${s.n(teamRating(_teams[i], view.levels))}٪',
                )),
                trailing: TextButton(onPressed: () => _changeKit(i), child: Text(s.t('Kit', 'الفانلة'))),
              ),
              const Divider(height: 1),
              for (final id in _teams[i])
                ListTile(
                  dense: true,
                  title: Text(view.nameOf(id)),
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (view.membersById[id]?.isGoalkeeper ?? false) ...[Pill(s.t('GK', 'حارس'), color: Palette.sky), const SizedBox(width: 6)],
                    Pill(levelBadge(s, view.levelOf(id)), color: levelColor(view.levelOf(id))),
                    const Icon(Icons.swap_horiz, size: 18, color: Palette.muted),
                  ]),
                  onTap: () => _move(id, i),
                ),
              if (_teams[i].isEmpty)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(s.t('Nobody yet.', 'لسه محدش.'), style: const TextStyle(color: Palette.muted)),
                ),
            ]),
          ),
        const SizedBox(height: 16),
        BusyButton(icon: Icons.ios_share, label: s.t('Save & share to the group', 'احفظ وشارك في الجروب'), onPressed: () => _save(share: true)),
        const SizedBox(height: 8),
        BusyButton(style: BusyStyle.outlined, label: s.t('Save', 'احفظ'), onPressed: () => _save(share: false)),
      ]),
    );
  }
}
