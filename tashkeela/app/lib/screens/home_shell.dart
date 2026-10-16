import 'dart:async';

import 'package:flutter/material.dart';

import '../l10n.dart';
import '../models.dart';
import '../roster_line.dart';
import '../services/services.dart';
import '../widgets.dart';
import 'group_tab.dart';
import 'squad_tab.dart';
import 'this_week_tab.dart';

/// Everything the tabs show, from one consistent set of live streams.
class GroupView {
  const GroupView({
    required this.uid,
    required this.group,
    required this.members,
    required this.game,
    required this.entries,
    required this.log,
    required this.groupIds,
    this.games = const [],
    this.levels = const {},
  });

  final String uid;
  final Group group;
  final List<Member> members;

  /// The poll on screen.
  final Game? game;
  final List<Entry> entries;
  final List<LogItem> log;
  final List<String> groupIds;

  /// Polls from the last two weeks and ahead, earliest first (cancelled ones included).
  final List<Game> games;

  /// Organizers only: member id to level (0-4). Empty for players.
  final Map<String, int> levels;

  /// The polls to pick from: everything not cancelled.
  List<Game> get polls => games.where((g) => g.status != GameStatus.cancelled).toList();
  int levelOf(String memberId) => levels[memberId] ?? 0;
  String venueOf(Game g) => g.venue ?? group.venue;

  bool get isAdmin => group.isAdmin(uid);
  Member? get me => members.where((m) => m.uid == uid).firstOrNull;
  Map<String, Member> get membersById => {for (final m in members) m.id: m};
  RosterLine get line => RosterLine.from(entries, game?.squadSize ?? group.rules.squadSize);
  MyStatus get myStatus => line.statusOf(me?.id);
  String nameOf(String? memberId) =>
      membersById[memberId]?.name ?? entries.where((e) => e.memberId == memberId).firstOrNull?.name ?? '';
}

class HomeShell extends StatefulWidget {
  const HomeShell({
    super.key,
    required this.groupId,
    required this.uid,
    required this.groupIds,
    required this.onSwitchGroup,
  });

  final String groupId;
  final String uid;
  final List<String> groupIds;
  final ValueChanged<String> onSwitchGroup;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  final _subs = <StreamSubscription<Object?>>[];
  final _gameSubs = <StreamSubscription<Object?>>[];
  Group? _group;
  List<Member>? _members;
  List<Game> _games = const [];
  Map<String, int> _levels = const {};
  List<Entry> _entries = const [];
  List<LogItem> _log = const [];
  String? _gameId;

  /// The poll the person picked; otherwise the group's current one.
  String? _picked;
  bool _languageAdopted = false;
  bool _missing = false;
  int _tab = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_subs.isNotEmpty) return;
    final repo = context.services.repo;
    _subs
      ..add(repo.group(widget.groupId).listen((g) {
        setState(() {
          _group = g;
          _missing = g == null;
        });
        _followSelection();
      }))
      ..add(repo.games(widget.groupId).listen((games) {
        setState(() => _games = games);
        _followSelection();
      }))
      // Only organizers may read levels; for everyone else this stays empty.
      ..add(repo.levels(widget.groupId).listen((l) => setState(() => _levels = l), onError: (Object _) {}))
      ..add(repo.members(widget.groupId).listen((m) {
        setState(() => _members = m);
        _adoptLanguage(m);
      }))
      ..add(context.services.push.messages.listen((m) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text([m.title, m.body].whereType<String>().join('\n'))));
      }));
  }

  /// The poll to show: the one picked if it's still listed, else the group's current one, else the first.
  String? get _selectedId {
    final listed = _games.where((g) => g.status != GameStatus.cancelled).map((g) => g.id).toList();
    if (_picked != null && listed.contains(_picked)) return _picked;
    final current = _group?.currentGameId;
    if (current != null && listed.contains(current)) return current;
    return listed.firstOrNull ?? current;
  }

  void _followSelection() {
    final id = _selectedId;
    if (id != _gameId) _watchGame(id);
  }

  void _selectGame(String gameId) {
    setState(() => _picked = gameId);
    _followSelection();
  }

  void _watchGame(String? gameId) {
    for (final s in _gameSubs) {
      s.cancel();
    }
    _gameSubs.clear();
    _gameId = gameId;
    setState(() {
      _entries = const [];
      _log = const [];
    });
    if (gameId == null) return;
    final repo = context.services.repo;
    _gameSubs
      ..add(repo.entries(widget.groupId, gameId).listen((e) => setState(() => _entries = e)))
      ..add(repo.log(widget.groupId, gameId).listen((l) => setState(() => _log = l)));
  }

  /// Use the language the member chose (on any device) the first time we see it.
  void _adoptLanguage(List<Member> members) {
    if (_languageAdopted) return;
    final me = members.where((m) => m.uid == widget.uid).firstOrNull;
    if (me == null) return;
    _languageAdopted = true;
    final language = LanguageScope.of(context);
    if (language.value != me.language) language.value = me.language;
  }

  @override
  void dispose() {
    for (final s in [..._subs, ..._gameSubs]) {
      s.cancel();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    if (_missing) {
      return Scaffold(body: Message(icon: Icons.error_outline, title: s.t('Group not found', 'الجروب مش موجود')));
    }
    final group = _group;
    final members = _members;
    if (group == null || members == null) return const Scaffold(body: Loading());
    final view = GroupView(
      uid: widget.uid,
      group: group,
      members: members,
      game: _games.where((g) => g.id == _gameId).firstOrNull,
      entries: _entries,
      log: _log,
      groupIds: widget.groupIds,
      games: _games,
      levels: _levels,
    );
    final tabs = [
      ThisWeekTab(
        view: view,
        onSwitchGroup: widget.onSwitchGroup,
        onOpenSquad: () => setState(() => _tab = 1),
        onSelectGame: _selectGame,
      ),
      SquadTab(view: view),
      GroupTab(view: view),
    ];
    return Scaffold(
      body: SafeArea(child: IndexedStack(index: _tab, children: tabs)),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home), label: s.t('Polls', 'الماتشات')),
          NavigationDestination(icon: const Icon(Icons.groups_outlined), selectedIcon: const Icon(Icons.groups), label: s.t('Squad', 'التشكيلة')),
          NavigationDestination(icon: const Icon(Icons.settings_outlined), selectedIcon: const Icon(Icons.settings), label: s.t('Group', 'الجروب')),
        ],
      ),
    );
  }
}
