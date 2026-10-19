// Everything the real app gets from Firebase, simulated on the phone for the
// demo build: one group of 22, a poll that opens a minute after you sign in,
// and 21 scripted players who race you for the 18 spots, drop out and answer
// offers. The list rules are the server's (see roster.dart). Nothing leaves
// the phone, and everything starts over when the app is closed.

import 'dart:async';
import 'dart:math' show max;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../l10n.dart';
import '../models.dart';
import '../phone.dart';
import '../roster_line.dart';
import '../services/api.dart';
import '../services/auth.dart';
import '../services/photos.dart';
import '../services/push.dart';
import '../services/repo.dart';
import '../services/services.dart';
import 'demo_panel.dart';
import 'roster.dart' as roster;

const demoUid = 'demo-user';
const demoGroupId = 'demo';
const _meId = 'm00';

class _Bot {
  const _Bot(this.id, this.name, this.language, this.level, {this.whatsapp = false, this.goalkeeper = false});
  final String id;
  final String name;
  final String language;

  /// The organizer's rating of them (see levels.dart), so the team maker has something to balance.
  final int level;

  /// Votes by tapping the WhatsApp button instead of using the app.
  final bool whatsapp;
  final bool goalkeeper;
}

/// The first 17 vote within seconds of the poll opening; the next three are
/// a little slower and end up as reserves unless you are slower still.
/// Fady never votes.
const _bots = [
  _Bot('m01', 'Mostafa H.', 'ar', 2, goalkeeper: true),
  _Bot('m02', 'Mahmoud R.', 'ar', 1, whatsapp: true),
  _Bot('m03', 'Ali F.', 'en', 2),
  _Bot('m04', 'Amr G.', 'ar', 3, whatsapp: true),
  _Bot('m05', 'Ziad E.', 'en', 3, goalkeeper: true),
  _Bot('m06', 'Sherif L.', 'ar', 1),
  _Bot('m07', 'Khaled W.', 'ar', 2, whatsapp: true),
  _Bot('m08', 'Hassan T.', 'ar', 4, whatsapp: true),
  _Bot('m09', 'Mido A.', 'en', 2),
  _Bot('m10', 'Seif O.', 'ar', 2, goalkeeper: true),
  _Bot('m11', 'Nour E.', 'ar', 3, whatsapp: true),
  _Bot('m12', 'Omar K.', 'en', 1),
  _Bot('m13', 'Adham S.', 'ar', 3),
  _Bot('m14', 'Ramy H.', 'ar', 2, whatsapp: true),
  _Bot('m15', 'Hany B.', 'en', 0),
  _Bot('m16', 'Tarek N.', 'ar', 3, whatsapp: true),
  _Bot('m17', 'Islam D.', 'ar', 2),
  _Bot('m18', 'Karim M.', 'ar', 1, whatsapp: true),
  _Bot('m19', 'Bassem K.', 'en', 3),
  _Bot('m20', 'Youssef A.', 'en', 0),
  _Bot('m21', 'Fady M.', 'ar', 4, whatsapp: true),
];

const _fastBots = 17;
const _slowBotDelays = {'m18': Duration(seconds: 12), 'm19': Duration(seconds: 15), 'm20': Duration(seconds: 18)};

/// Karim passes when offered a spot; every other player confirms.
const _passer = 'm18';

/// Islam drops out a while after the squad fills, so the reserves get a turn.
const _dropper = 'm17';
const _dropAfterOpen = Duration(seconds: 30);

/// Marked as regulars: they get the head start when the organizer turns it on.
const _regulars = {_meId, 'm01', 'm02', 'm03', 'm06', 'm09', 'm12'};

/// Man of the match voting stays open this long after kick-off.
const _mvpWindow = Duration(hours: 24);

const _formerMember = 'Former member';

const _defaultRules = Rules(
  squadSize: 18,
  kits: Kit.base,
  confirmWindowMinutes: 120,
  matchDayConfirmWindowMinutes: 30,
  lateDropOutHours: 24,
  quietHours: QuietHours('00:00', '08:00'),
);
const _defaultReminders = Reminders(pollOpening: true, promotion: true, matchDay: true, matchDayHoursBefore: 4);

/// One game of the season, as the table counts it.
class _Record {
  const _Record(this.at,
      {required this.squad, this.winners = const [], this.mvp = const [], this.dropOuts = const [], this.lateDropOuts = const []});
  final DateTime at;
  final List<String> squad;
  final List<String> winners;
  final List<String> mvp;
  final List<String> dropOuts;
  final List<String> lateDropOuts;
}

class _GroupState {
  _GroupState({
    required this.id,
    required this.name,
    required this.venue,
    required this.schedule,
    this.pitchFee,
  });

  final String id;
  String name;
  String venue;
  Schedule schedule;
  Rules rules = _defaultRules;
  Reminders reminders = _defaultReminders;
  num? pitchFee;
  PayTo payTo = const PayTo();
  Season season = const Season(id: 's1', name: 'Season 1');

  /// Games of the season played before the demo starts.
  final history = <_Record>[];
  final adminUids = <String>[];
  final members = <String, Member>{};
  final games = <String, _GameState>{};

  /// Organizers only: member id to level (0-4).
  final levels = <String, int>{};
  String? currentGameId;
  Champions? lastChampions;
  int memberCounter = 100;
  int gameCounter = 0;

  _GameState? get currentGame => games[currentGameId];

  /// The poll the app opens on, like pickCurrentGame on the server.
  void refreshCurrent() {
    final all = games.values.toList();
    final ahead = all.where((x) => x.isAhead).toList()..sort((a, b) => a.kickoffAt.compareTo(b.kickoffAt));
    final past = all.where((x) => x.status == GameStatus.closed || x.status == GameStatus.played).toList()
      ..sort((a, b) => b.kickoffAt.compareTo(a.kickoffAt));
    currentGameId = ahead.firstOrNull?.id ?? past.firstOrNull?.id;
  }

  Group view() => Group(
        id: id,
        name: name,
        venue: venue,
        schedule: schedule,
        rules: rules,
        reminders: reminders,
        adminUids: List.unmodifiable(adminUids),
        currentGameId: currentGameId,
        lastChampions: lastChampions,
        pitchFee: pitchFee,
        payTo: payTo,
        season: season,
      );
}

class _GameState {
  _GameState({
    required this.id,
    required this.weekNumber,
    required this.kickoffAt,
    required this.pollOpensAt,
    required this.venue,
    required this.squadSize,
    this.kind = 'weekly',
    this.durationMinutes = 90,
  });

  final String id;
  final int weekNumber;
  final String kind;
  DateTime kickoffAt;
  DateTime pollOpensAt;
  String venue;
  int squadSize;
  int durationMinutes;
  GameStatus status = GameStatus.scheduled;
  int nextSeq = 1;
  List<Entry> entries = const [];
  final log = <LogItem>[];
  List<Team>? teams;
  String? winner;
  String? photoPath;
  GamePayments? payments;
  bool earlyNotified = false;

  /// Man of the match: null until kick-off. Ballots stay here; only who voted is shown.
  List<String>? mvpVoters;
  final ballots = <String, String>{};
  List<String>? mvpWinners;
  int? mvpWinnerVotes;
  DateTime? mvpClosesAt;

  bool get isAhead => status == GameStatus.scheduled || status == GameStatus.open;

  bool hasOnList(String memberId) => entries.any((e) => e.memberId == memberId && e.state != EntryState.out);

  Game view() {
    final line = RosterLine.from(entries, squadSize);
    return Game(
      id: id,
      weekNumber: weekNumber,
      kickoffAt: kickoffAt,
      pollOpensAt: pollOpensAt,
      status: status,
      squadSize: squadSize,
      squadCount: line.squad.length,
      reserveCount: line.reserves.length,
      winner: winner,
      photoPath: photoPath,
      kind: kind,
      venue: venue,
      durationMinutes: durationMinutes,
      teams: teams,
      payments: payments,
      mvp: mvpVoters == null
          ? null
          : Mvp(voters: List.of(mvpVoters!), winners: mvpWinners, winnerVotes: mvpWinnerVotes, closesAt: mvpClosesAt),
    );
  }

  List<String> get squad => RosterLine.from(entries, squadSize).squad.map((e) => e.memberId).toList();
}

/// The group's rules with one poll's squad size.
Rules _rulesFor(Rules r, int squadSize) => Rules(
      squadSize: squadSize,
      kits: r.kits,
      confirmWindowMinutes: r.confirmWindowMinutes,
      matchDayConfirmWindowMinutes: r.matchDayConfirmWindowMinutes,
      lateDropOutHours: r.lateDropOutHours,
      quietHours: r.quietHours,
    );

const _keep = Object();

Member _member(Member m,
        {String? name,
        String? phone,
        Object? uid = _keep,
        bool? isAdmin,
        bool? isGoalkeeper,
        bool? isRegular,
        bool? whatsappOptIn,
        String? language,
        bool? active,
        Object? reserveAfter = _keep}) =>
    Member(
      id: m.id,
      name: name ?? m.name,
      phone: phone ?? m.phone,
      uid: identical(uid, _keep) ? m.uid : uid as String?,
      isAdmin: isAdmin ?? m.isAdmin,
      isGoalkeeper: isGoalkeeper ?? m.isGoalkeeper,
      isRegular: isRegular ?? m.isRegular,
      whatsappOptIn: whatsappOptIn ?? m.whatsappOptIn,
      language: language ?? m.language,
      active: active ?? m.active,
      reserveAfterGameId: identical(reserveAfter, _keep) ? m.reserveAfterGameId : reserveAfter as String?,
    );

/// The fee split over the players; anyone already on the list keeps their state (like splitFee on the server).
GamePayments _split(num fee, List<String> squad, GamePayments? before) => GamePayments(
      fee: fee,
      perPlayer: squad.isEmpty ? 0 : (fee / squad.length).ceil(),
      players: {for (final id in squad) id: before?.players[id] ?? PaymentState.unpaid},
    );

void _setPayment(_GameState game, String memberId, PaymentState state) {
  final p = game.payments!;
  game.payments = GamePayments(fee: p.fee, perPlayer: p.perPlayer, players: {...p.players, memberId: state});
}

/// Weeks 1 to 11 of the season, before the demo week, so the table has something in it.
List<_Record> _seasonSoFar(DateTime week12, Map<String, int> levels) {
  final everyone = [_meId, for (final b in _bots) b.id];
  int mix(String id, int w) => id.codeUnits.fold(w * 31, (h, c) => (h * 17 + c) % 1009);
  return [
    for (var w = 1; w <= 11; w++)
      () {
        // Fady hardly ever comes; three others sit out each week, in turn.
        final missing = {'m21', everyone[(w * 3) % 21], everyone[(w * 3 + 7) % 21], everyone[(w * 3 + 14) % 21]};
        final squad = everyone.where((id) => !missing.contains(id)).take(18).toList()
          ..sort((a, b) => mix(a, w).compareTo(mix(b, w)));
        final winners = squad.sublist((w % 3) * 6, (w % 3) * 6 + 6);
        int rank(String id) => switch (levels[id] ?? 0) { 0 => 3, final l => l };
        final best = [...winners]..sort((a, b) => rank(a).compareTo(rank(b)));
        // One of the players who sat out had said yes, then dropped out.
        final dropper = missing.firstWhere((id) => id != 'm21' && id != _meId);
        return _Record(
          week12.subtract(Duration(days: 7 * (12 - w))),
          squad: squad,
          winners: winners,
          mvp: [best[w % 2]],
          dropOuts: [dropper],
          lateDropOuts: [if (w % 3 == 0) dropper],
        );
      }(),
  ];
}


String _clock(DateTime t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

class DemoBackend {
  DemoBackend({DateTime Function()? clock, String? language})
      : now = clock ?? DateTime.now,
        _language = language ?? (PlatformDispatcher.instance.locale.languageCode == 'en' ? 'en' : 'ar');

  /// The clock everything here runs on (tests pass their own).
  final DateTime Function() now;
  final String _language;

  final _changes = StreamController<void>.broadcast(sync: true);
  final _authChanges = StreamController<void>.broadcast(sync: true);
  final _push = StreamController<PushMessage>.broadcast();
  final _groups = <String, _GroupState>{};
  final _photos = <String, Uint8List>{};
  final _images = <String, Future<ImageProvider>>{};
  final _timers = <Timer>[];
  String? _uid;
  int _groupCounter = 0;

  late final Services services = Services(
    auth: _DemoAuth(this),
    api: _DemoApi(this),
    repo: _DemoRepo(this),
    push: _DemoPush(this),
    photos: _DemoPhotos(this),
    demoPanel: (context) => DemoPanel(backend: this),
  );

  void dispose() {
    _cancelTimers();
    _changes.close();
    _authChanges.close();
    _push.close();
  }

  // --- The demo week --------------------------------------------------------

  _GroupState get _demo => _groups[demoGroupId]!;

  /// Builds the demo group from scratch: the poll opens in a minute and the
  /// game is tomorrow at 9 pm.
  void _startWeek() {
    _cancelTimers();
    final t = now();
    final kickoff = DateTime(t.year, t.month, t.day + 1, 21);
    final opens = t.add(const Duration(minutes: 1));
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    final g = _GroupState(
      id: demoGroupId,
      name: '${days[kickoff.weekday - 1]} Night Football',
      venue: 'New Cairo Arena · Pitch 3',
      pitchFee: 2160,
      schedule: Schedule(
        timeZone: 'Africa/Cairo',
        matchWeekday: kickoff.weekday,
        matchTime: '21:00',
        matchDurationMinutes: 90,
        pollOpenWeekday: opens.weekday,
        pollOpenTime: _clock(opens),
      ),
    );
    g.rules = const Rules(
      squadSize: 18,
      kits: Kit.base,
      confirmWindowMinutes: 120,
      matchDayConfirmWindowMinutes: 30,
      lateDropOutHours: 24,
      quietHours: QuietHours('00:00', '08:00'),
      lateDropOutsStartAsReserves: true,
    );
    g.payTo = const PayTo(instapay: 'ahmed.s@instapay', wallet: '010 0000 0001');
    g.adminUids.add(demoUid);
    g.levels[_meId] = 2;
    g.members[_meId] = Member(
      id: _meId,
      name: 'Ahmed S.',
      phone: '+201000000001',
      uid: demoUid,
      isAdmin: true,
      isGoalkeeper: false,
      isRegular: true,
      whatsappOptIn: true,
      language: _language,
      active: true,
    );
    for (final (i, b) in _bots.indexed) {
      g.levels[b.id] = b.level;
      g.members[b.id] = Member(
        id: b.id,
        name: b.name,
        phone: '+2010000000${(i + 2).toString().padLeft(2, '0')}',
        uid: null,
        isAdmin: false,
        isGoalkeeper: b.goalkeeper,
        isRegular: _regulars.contains(b.id),
        whatsappOptIn: true,
        language: b.language,
        active: true,
      );
    }
    final history = _seasonSoFar(kickoff, g.levels);
    g.history.addAll(history);
    g.season = Season(id: 's1', name: 'Season 1', startedAt: history.first.at.subtract(const Duration(days: 1)));
    final game = _GameState(
      id: 'week-12',
      weekNumber: 12,
      kickoffAt: kickoff,
      pollOpensAt: opens,
      venue: g.venue,
      squadSize: 18,
    );
    g.games[game.id] = game;
    g.gameCounter = 12;
    g.currentGameId = game.id;
    g.lastChampions = const Champions(gameId: 'week-11', weekNumber: 11, winner: 'Black');
    _groups[demoGroupId] = g;
    _schedule(g, game);
    _changed();
  }

  /// Timers for the poll opening and kick-off.
  void _schedule(_GroupState g, _GameState game) {
    if (game.status == GameStatus.scheduled) {
      _at(game.pollOpensAt, () => _openPoll(g, game));
      final head = g.rules.regularsHeadStartMinutes;
      if (head > 0) _at(game.pollOpensAt.subtract(Duration(minutes: head)), () => _openEarly(g, game));
    }
    _at(game.kickoffAt, () => _close(g, game));
  }

  /// The regulars' head start: they hear first, and may vote from now on.
  void _openEarly(_GroupState g, _GameState game) {
    final head = g.rules.regularsHeadStartMinutes;
    final t = now();
    if (game.status != GameStatus.scheduled || game.earlyNotified || head == 0) return;
    if (t.isBefore(game.pollOpensAt.subtract(Duration(minutes: head, seconds: 1))) || !t.isBefore(game.pollOpensAt)) return;
    game.earlyNotified = true;
    if (_myMember(g)?.isRegular ?? false) {
      _notify(g, (s) => (
            s.t("Regulars' head start: ${g.name}", 'أولوية الأساسيين: ${g.name}'),
            s.t('You can vote now, ${s.n(head)} minutes before everyone else.', 'تقدر تصوت دلوقتي، قبل الكل بـ${s.n(head)} دقيقة.'),
          ));
    }
    _changed();
    if (g.id != demoGroupId) return;
    final regulars = _bots.where((b) => g.members[b.id]?.isRegular ?? false).toList();
    for (final (i, b) in regulars.indexed) {
      _after(Duration(milliseconds: 1200 + i * 700), () => _botJoin(g, game, b));
    }
  }

  void _openPoll(_GroupState g, _GameState game, {bool early = false}) {
    if (game.status != GameStatus.scheduled) return;
    final t = now();
    // A timer for an opening time that has since moved.
    if (!early && t.isBefore(game.pollOpensAt.subtract(const Duration(seconds: 1)))) return;
    game.status = GameStatus.open;
    if (game.pollOpensAt.isAfter(t)) game.pollOpensAt = t;
    _notify(g, (s) => (
          s.t('Poll is open: ${g.name}', 'التصويت مفتوح: ${g.name}'),
          s.t('${s.when(game.kickoffAt)} · ${s.n(game.squadSize)} spots. Tap to grab yours.',
              '${s.when(game.kickoffAt)} – ${s.n(game.squadSize)} مكان. اضغط عشان تحجز مكانك.'),
        ));
    _changed();
    if (g.id != demoGroupId) return;
    if (game.id != 'week-12') {
      // Extra polls: the players vote over a few seconds until the squad is full, plus two reserves.
      final keen = [..._bots]..sort((a, b) => (a.id.hashCode ^ game.id.hashCode).compareTo(b.id.hashCode ^ game.id.hashCode));
      for (final (i, b) in keen.take(game.squadSize + 2).indexed) {
        _after(Duration(milliseconds: 800 + i * 450), () => _botJoin(g, game, b));
      }
      return;
    }

    // The race: most players vote within ten seconds, the rest a little later.
    for (final (i, b) in _bots.take(_fastBots).indexed) {
      _after(Duration(milliseconds: 1000 + i * 520 + (i % 3) * 140), () => _botJoin(g, game, b));
    }
    for (final MapEntry(key: id, value: delay) in _slowBotDelays.entries) {
      _after(delay, () => _botJoin(g, game, _bots.firstWhere((b) => b.id == id)));
    }
    _after(_dropAfterOpen, () => _botAct(g, game, _dropper, 'drop'));
  }

  /// Kick-off: the poll closes and open offers lapse.
  void _close(_GroupState g, _GameState game) {
    if (game.status != GameStatus.open && game.status != GameStatus.scheduled) return;
    // A timer for a kick-off that has since moved.
    if (now().isBefore(game.kickoffAt.subtract(const Duration(seconds: 1)))) return;
    if (game.status == GameStatus.open) _applyRoster(g, game, 'expire', null, 'app');
    game.status = GameStatus.closed;
    _onKickoff(g, game);
    g.refreshCurrent();
    _changed();
  }

  /// Like onKickoff on the server: split the pitch fee, open man-of-the-match
  /// voting, and lift last week's late-drop-out penalties.
  void _onKickoff(_GroupState g, _GameState game) {
    final squad = game.squad;
    final fee = g.pitchFee;
    if (fee != null && fee > 0 && game.payments == null && squad.isNotEmpty) game.payments = _split(fee, squad, null);
    if (game.mvpVoters == null) {
      game.mvpVoters = [];
      game.mvpClosesAt = game.kickoffAt.add(_mvpWindow);
      _at(game.mvpClosesAt!, () => _closeMvp(g, game));
    }
    for (final m in [...g.members.values]) {
      final after = m.reserveAfterGameId;
      if (after == null || after == game.id) continue;
      if (g.games[after]?.kickoffAt.isBefore(game.kickoffAt) ?? true) g.members[m.id] = _member(m, reserveAfter: null);
    }
    if (g.id == demoGroupId) _afterTheGame(g, game);
  }

  /// The players vote for man of the match (most for the best-rated) and about half pay within seconds.
  void _afterTheGame(_GroupState g, _GameState game) {
    final bots = game.squad.where((id) => id != _meId).toList();
    if (bots.length < 3) return;
    int rank(String id) => switch (g.levels[id] ?? 0) { 0 => 3, final l => l };
    final favourites = [...bots]..sort((a, b) => rank(a) != rank(b) ? rank(a).compareTo(rank(b)) : a.compareTo(b));
    for (final (i, id) in bots.indexed) {
      final pick = i % 3 == 0 ? favourites[1] : favourites[0];
      final choice = pick != id ? pick : (pick == favourites[0] ? favourites[1] : favourites[0]);
      _after(Duration(milliseconds: 1500 + i * 600), () => _botVote(g, game, id, choice));
    }
    for (final (i, id) in bots.where((id) => id.codeUnitAt(id.length - 1).isEven).indexed) {
      _after(Duration(milliseconds: 2000 + i * 900), () => _botClaim(game, id));
    }
  }

  void _botVote(_GroupState g, _GameState game, String voter, String choice) {
    final voters = game.mvpVoters;
    if (voters == null || game.mvpWinners != null) return;
    game.ballots[voter] = choice;
    if (!voters.contains(voter)) voters.add(voter);
    _changed();
  }

  void _botClaim(_GameState game, String memberId) {
    if (game.payments?.players[memberId] != PaymentState.unpaid) return;
    _setPayment(game, memberId, PaymentState.claimed);
    _changed();
  }

  /// Count the votes, like closeMvp on the server.
  void _closeMvp(_GroupState g, _GameState game) {
    if (game.mvpVoters == null || game.mvpWinners != null) return;
    final counts = <String, int>{};
    for (final c in game.ballots.values) {
      counts[c] = (counts[c] ?? 0) + 1;
    }
    final top = counts.values.fold(0, max);
    game
      ..mvpWinners = ([for (final MapEntry(:key, :value) in counts.entries) if (top > 0 && value == top) key]..sort())
      ..mvpWinnerVotes = top
      ..mvpClosesAt = null;
    _changed();
  }

  /// The season table, rebuilt from the season's games like rebuildSeasonStats on the server.
  SeasonTable _table(_GroupState g) {
    final from = g.season.startedAt;
    bool inSeason(DateTime at) => from == null || !at.isBefore(from);
    final records = [
      ...g.history.where((r) => inSeason(r.at)),
      for (final game in g.games.values)
        if ((game.status == GameStatus.closed || game.status == GameStatus.played) && inSeason(game.kickoffAt))
          _Record(
            game.kickoffAt,
            squad: game.squad,
            winners: game.teams?.where((t) => t.kit.name == game.winner).firstOrNull?.memberIds ?? const [],
            mvp: game.mvpWinners ?? const [],
            dropOuts: [for (final e in game.entries) if (e.state == EntryState.out && e.outReason == 'dropped') e.memberId],
            lateDropOuts: [for (final e in game.entries) if (e.state == EntryState.out && e.lateDropOut) e.memberId],
          ),
    ];
    final rows = <String, List<int>>{};
    List<int> row(String id) => rows.putIfAbsent(id, () => [0, 0, 0, 0, 0]);
    for (final r in records) {
      for (final id in r.squad) {
        row(id)[0]++;
      }
      for (final id in r.winners.where(r.squad.contains)) {
        row(id)[1]++;
      }
      for (final id in r.mvp) {
        row(id)[2]++;
      }
      for (final id in r.dropOuts) {
        row(id)[3]++;
      }
      for (final id in r.lateDropOuts) {
        row(id)[4]++;
      }
    }
    return SeasonTable(
      seasonId: g.season.id,
      name: g.season.name,
      games: records.length,
      players: [
        for (final MapEntry(key: id, value: n) in rows.entries)
          PlayerStats(
            memberId: id,
            name: g.members[id]?.name ?? '?',
            played: n[0],
            wins: n[1],
            mvp: n[2],
            dropOuts: n[3],
            lateDropOuts: n[4],
          ),
      ],
    );
  }

  /// Off every poll ahead and out of the group (removed, leaving or deleting the account).
  void _takeOut(_GroupState g, Member m) {
    if (m.uid != null && g.adminUids.contains(m.uid) && g.adminUids.length == 1) throw ApiException('last_organizer');
    for (final game in g.games.values.where((x) => x.isAhead)) {
      try {
        _applyRoster(g, game, 'remove', m.id, 'admin');
      } on ApiException catch (e) {
        // Not on that poll's list, or it isn't open: nothing to undo.
        if (!const {'not_in', 'poll_not_open', 'game_closed'}.contains(e.code)) rethrow;
      }
    }
    g.members[m.id] = _member(m, active: false);
    g.adminUids.remove(m.uid);
  }

  void _botJoin(_GroupState g, _GameState game, _Bot b) => _botAct(g, game, b.id, 'join');

  void _botAct(_GroupState g, _GameState game, String memberId, String action) {
    final bot = _bots.where((b) => b.id == memberId).firstOrNull;
    try {
      _applyRoster(g, game, action, memberId, bot?.whatsapp == true ? 'whatsapp' : 'app');
    } on ApiException {
      // The game moved on (closed, or the offer is gone): nothing to do.
    }
  }

  /// Reacts to what just happened: bots answer offers, and you get the
  /// notifications the real server would send you.
  void _onEvents(_GroupState g, _GameState game, List<roster.RosterEvent> events) {
    final me = _myMember(g);
    for (final e in events) {
      switch (e.type) {
        case 'offered':
          if (e.memberId == me?.id) {
            final expires = e.expiresAt!;
            _notify(g, (s) => (
                  s.t('A spot opened up for you!', 'فيه مكان فضي ليك!'),
                  s.t('${s.when(game.kickoffAt)}. Confirm by ${s.time(expires)} or it goes to the next reserve.',
                      'ماتش ${s.when(game.kickoffAt)}. أكد قبل ${s.time(expires)} وإلا هيروح للي بعدك.'),
                ));
          } else if (_bots.any((b) => b.id == e.memberId)) {
            final passes = e.memberId == _passer;
            _after(Duration(seconds: passes ? 6 : 5), () => _botAct(g, game, e.memberId, passes ? 'pass' : 'confirm'));
          }
          // Offers nobody answers lapse at their deadline, as on the server.
          _at(e.expiresAt!, () {
            if (game.status == GameStatus.open) _applyRoster(g, game, 'expire', null, 'app');
          });
        case 'dropped':
          if (me == null || !me.isAdmin || e.memberId == me.id || !e.wasInSquad) break;
          final name = g.members[e.memberId]?.name ?? '';
          final offered = events.where((x) => x.type == 'offered').firstOrNull;
          final replacement = offered == null ? null : g.members[offered.memberId]?.name;
          final lateNote = e.late ? (' (late drop-out)', ' (اعتذار متأخر)') : ('', '');
          _notify(g, (s) => (
                s.t('$name dropped out${lateNote.$1}', '$name اعتذر${lateNote.$2}'),
                replacement != null
                    ? s.t('$replacement has been offered the spot.', 'اتعرض المكان على $replacement.')
                    : s.t('No reserves left; the squad is one short.', 'مفيش احتياطي، التشكيلة ناقصة واحد.'),
              ));
        case 'expired':
          if (e.memberId != me?.id) break;
          _notify(g, (s) => (
                s.t('Your offer expired', 'انتهى وقت التأكيد'),
                s.t('The spot went to the next reserve. You can rejoin the queue.',
                    'المكان راح للاحتياطي اللي بعدك. تقدر تدخل الطابور تاني.'),
              ));
      }
    }
  }

  // --- Demo panel actions ---------------------------------------------------

  /// A player in the squad (never you) can't make it any more.
  Future<String> dropSomeone() async {
    final g = _demo;
    final game = g.currentGame!;
    if (game.status == GameStatus.scheduled) throw ApiException('poll_not_open');
    if (game.status != GameStatus.open) throw ApiException('game_closed');
    final squad = RosterLine.from(game.entries, game.squadSize).squad;
    final candidates = squad.where((e) => e.memberId != _meId && e.state == EntryState.confirmed).toList();
    if (candidates.isEmpty) throw ApiException('not_in');
    final pick = candidates[now().millisecond % candidates.length];
    _applyRoster(g, game, 'drop', pick.memberId, 'app');
    return pick.name;
  }

  /// Jump past kick-off: the poll closes and the organizer can record the winners.
  Future<void> skipToAfterTheGame() async {
    final g = _demo;
    final game = g.currentGame!;
    if (game.status == GameStatus.played) return;
    _cancelTimers();
    final kickoff = now().subtract(const Duration(minutes: 1));
    game.kickoffAt = kickoff;
    if (game.pollOpensAt.isAfter(kickoff)) game.pollOpensAt = kickoff;
    // No offer outlives kick-off, so open offers lapse now.
    game.entries = [
      for (final e in game.entries)
        e.state == EntryState.offered
            ? Entry(
                memberId: e.memberId,
                name: e.name,
                seq: e.seq,
                joinedAt: e.joinedAt,
                state: e.state,
                source: e.source,
                offerExpiresAt: kickoff,
              )
            : e,
    ];
    if (game.status == GameStatus.open) _applyRoster(g, game, 'expire', null, 'app');
    game.status = GameStatus.closed;
    _onKickoff(g, game);
    _changed();
  }

  /// Back to the countdown before the poll opens, with a fresh list.
  Future<void> restartWeek() async {
    final g = _groups[demoGroupId];
    _startWeek();
    // Keep the language the player picked.
    final previous = g?.members[_meId];
    if (previous != null) _demo.members[_meId] = _member(_demo.members[_meId]!, language: previous.language);
    _changed();
  }

  bool get isOrganizer => _groups[demoGroupId]?.adminUids.contains(demoUid) ?? true;

  /// Switch between the organizer's view and a regular player's.
  void setOrganizer(bool value) {
    final g = _demo;
    g.adminUids.remove(demoUid);
    if (value) g.adminUids.add(demoUid);
    g.members[_meId] = _member(g.members[_meId]!, isAdmin: value);
    _changed();
  }

  // --- Plumbing -------------------------------------------------------------

  void _changed() {
    if (!_changes.isClosed) _changes.add(null);
  }

  void _after(Duration d, void Function() f) {
    late final Timer timer;
    timer = Timer(d, () {
      _timers.remove(timer);
      f();
    });
    _timers.add(timer);
  }

  void _at(DateTime t, void Function() f) {
    final d = t.difference(now());
    _after(d.isNegative ? Duration.zero : d, f);
  }

  void _cancelTimers() {
    for (final t in _timers) {
      t.cancel();
    }
    _timers.clear();
  }

  /// A notification for you, in your language, shown in the app like a push.
  void _notify(_GroupState g, (String, String) Function(S s) text) {
    final me = _myMember(g);
    if (_uid == null || me == null || _push.isClosed) return;
    final (title, body) = text(S(me.language));
    _push.add(PushMessage(title: title, body: body));
  }

  Member? _myMember(_GroupState g) => g.members.values.where((m) => m.uid == demoUid && m.active).firstOrNull;

  _GroupState _group(String id) => _groups[id] ?? (throw ApiException('not_found'));

  _GameState _game(_GroupState g, String id) => g.games[id] ?? (throw ApiException('not_found'));

  void _requireAdmin(_GroupState g) {
    if (!g.adminUids.contains(_uid)) throw ApiException('permission_denied');
  }

  /// One change to the list, like applyRosterAction on the server.
  roster.RosterResult _applyRoster(_GroupState g, _GameState game, String action, String? memberId, String source) {
    final t = now();
    final member = memberId == null ? null : g.members[memberId];
    // Regulars may vote during the head start, before the poll opens for everyone.
    final head = g.rules.regularsHeadStartMinutes;
    final early = game.status == GameStatus.scheduled &&
        head > 0 &&
        (member?.isRegular ?? false) &&
        !t.isBefore(game.pollOpensAt.subtract(Duration(minutes: head)));
    if (action != 'expire') {
      if (game.status == GameStatus.scheduled && !early) throw ApiException('poll_not_open');
      if ((game.status != GameStatus.open && !early) || !t.isBefore(game.kickoffAt)) throw ApiException('game_closed');
    }
    final ctx = roster.RosterContext(now: t, kickoffAt: game.kickoffAt, rules: _rulesFor(g.rules, game.squadSize));
    final roster.RosterResult result;
    try {
      switch (action) {
        case 'join':
          final m = member;
          if (m == null || !m.active) throw ApiException('not_member');
          // A late drop-out last time starts this poll behind everyone who votes normally.
          final after = m.reserveAfterGameId;
          final penalized = g.rules.lateDropOutsStartAsReserves &&
              after != null &&
              after != game.id &&
              (g.games[after]?.kickoffAt.isBefore(game.kickoffAt) ?? true);
          final seq = (penalized ? roster.penaltySeq : 0) + game.nextSeq;
          result = roster.join(game.entries, memberId: m.id, name: m.name, seq: seq, source: source, ctx: ctx);
          game.nextSeq++;
        case 'drop':
          result = roster.dropOut(game.entries, memberId!, ctx);
        case 'confirm':
          result = roster.confirm(game.entries, memberId!, ctx);
        case 'pass':
          result = roster.pass(game.entries, memberId!, ctx);
        case 'remove':
          result = roster.remove(game.entries, memberId!, ctx);
        default:
          result = roster.expireOffers(game.entries, ctx);
      }
    } on roster.RosterError catch (e) {
      throw ApiException(e.code);
    }
    game.entries = result.entries;
    for (final e in result.events) {
      game.log.add(LogItem(type: e.type, memberId: e.memberId, at: t, late: e.late));
      // Late drop-outs start the next poll as reserves, when the group uses that rule.
      if (e.type == 'dropped' && e.late && g.rules.lateDropOutsStartAsReserves) {
        final m = g.members[e.memberId];
        if (m != null) g.members[m.id] = _member(m, reserveAfter: game.id);
      }
    }
    _onEvents(g, game, result.events);
    _changed();
    return result;
  }

  /// The next game for a weekly schedule, after now.
  _GameState _nextGame(Schedule s, int weekNumber) {
    final t = now();
    final match = s.matchTime.split(':').map(int.parse).toList();
    var kickoff = DateTime(t.year, t.month, t.day + (s.matchWeekday - t.weekday) % 7, match[0], match[1]);
    if (!kickoff.isAfter(t)) kickoff = DateTime(kickoff.year, kickoff.month, kickoff.day + 7, match[0], match[1]);
    final poll = s.pollOpenTime.split(':').map(int.parse).toList();
    var back = (s.matchWeekday - s.pollOpenWeekday) % 7;
    if (back == 0) back = 7;
    final opens = DateTime(kickoff.year, kickoff.month, kickoff.day - back, poll[0], poll[1]);
    return _GameState(
      id: 'week-$weekNumber',
      weekNumber: weekNumber,
      kickoffAt: kickoff,
      pollOpensAt: opens,
      venue: '',
      squadSize: 18,
      durationMinutes: s.matchDurationMinutes,
    );
  }

  Stream<T> _watch<T>(T Function() read) {
    late final StreamController<T> c;
    StreamSubscription<void>? sub;
    c = StreamController<T>(
      onListen: () {
        c.add(read());
        sub = _changes.stream.listen((_) {
          if (!c.isClosed) c.add(read());
        });
      },
      onCancel: () => sub?.cancel(),
    );
    return c.stream;
  }
}

class _DemoAuth implements AuthService {
  _DemoAuth(this.b);
  final DemoBackend b;

  @override
  Stream<String?> uidChanges() {
    late final StreamController<String?> c;
    StreamSubscription<void>? sub;
    c = StreamController<String?>(
      onListen: () {
        c.add(b._uid);
        sub = b._authChanges.stream.listen((_) => c.add(b._uid));
      },
      onCancel: () => sub?.cancel(),
    );
    return c.stream;
  }

  @override
  Future<PhoneVerification> sendCode(String phone) async => _DemoVerification(b);

  @override
  Future<void> signOut() async {
    b._uid = null;
    b._authChanges.add(null);
  }
}

class _DemoVerification implements PhoneVerification {
  _DemoVerification(this.b);
  final DemoBackend b;

  @override
  Future<void> confirm(String code) async {
    if (!RegExp(r'^\d{6}$').hasMatch(code)) throw AuthFailure('invalid-verification-code');
    // A fresh demo week, also after leaving the group or deleting the account.
    if (!b._groups.containsKey(demoGroupId) || b._myMember(b._demo) == null) b._startWeek();
    b._uid = demoUid;
    b._authChanges.add(null);
    // After the home screen is up and listening.
    b._after(const Duration(milliseconds: 1500), () {
      final game = b._demo.currentGame;
      if (game == null || game.status != GameStatus.scheduled) return;
      b._notify(b._demo, (s) => (
            s.t('Demo week', 'أسبوع تجريبي'),
            s.t('The poll opens in a minute. 21 players on this phone will race you for the 18 spots.',
                'التصويت هيفتح بعد دقيقة. ٢١ لعيب على الموبايل ده هيسابقوك على الـ١٨ مكان.'),
          ));
    });
  }
}

class _DemoPush implements PushService {
  _DemoPush(this.b);
  final DemoBackend b;

  @override
  Stream<PushMessage> get messages => b._push.stream;

  @override
  Future<void> register(String uid) async {}

  @override
  Future<void> unregister(String uid) async {}
}

class _DemoPhotos implements PhotoStore {
  _DemoPhotos(this.b);
  final DemoBackend b;

  @override
  Future<void> putPng(String path, Uint8List bytes) async {
    b._photos[path] = bytes;
    b._images.remove(path);
  }

  @override
  Future<ImageProvider> image(String path) => b._images.putIfAbsent(path, () {
        final bytes = b._photos[path];
        return bytes == null ? Future.error(StateError('no photo at $path')) : SynchronousFuture(MemoryImage(bytes));
      });
}

class _DemoRepo implements Repo {
  _DemoRepo(this.b);
  final DemoBackend b;

  @override
  Stream<List<String>> groupIdsOf(String uid) => b._watch(() => [
        for (final g in b._groups.values)
          if (g.members.values.any((m) => m.uid == uid && m.active)) g.id,
      ]);

  @override
  Stream<Group?> group(String id) => b._watch(() => b._groups[id]?.view());

  @override
  Stream<List<Member>> members(String groupId) => b._watch(() {
        final list = b._groups[groupId]?.members.values.where((m) => m.active).toList() ?? <Member>[];
        return list..sort((x, y) => x.name.compareTo(y.name));
      });

  @override
  Stream<Game?> game(String groupId, String gameId) => b._watch(() => b._groups[groupId]?.games[gameId]?.view());

  @override
  Stream<List<Entry>> entries(String groupId, String gameId) =>
      b._watch(() => List<Entry>.of(b._groups[groupId]?.games[gameId]?.entries ?? const []));

  @override
  Stream<List<LogItem>> log(String groupId, String gameId, {int limit = 8}) =>
      b._watch(() => (b._groups[groupId]?.games[gameId]?.log ?? const <LogItem>[]).reversed.take(limit).toList());

  @override
  Future<Game?> lastPlayedGame(String groupId) async {
    final g = b._groups[groupId];
    if (g == null) return null;
    final t = b.now();
    final played = g.games.values.where((x) => !x.kickoffAt.isAfter(t) && x.status != GameStatus.cancelled).toList()
      ..sort((x, y) => y.kickoffAt.compareTo(x.kickoffAt));
    return played.firstOrNull?.view();
  }

  @override
  Stream<List<Game>> games(String groupId) => b._watch(() {
        final since = b.now().subtract(const Duration(days: 14));
        final list = (b._groups[groupId]?.games.values ?? const <_GameState>[])
            .where((x) => !x.kickoffAt.isBefore(since))
            .map((x) => x.view())
            .toList();
        return list..sort((x, y) => x.kickoffAt.compareTo(y.kickoffAt));
      });

  @override
  Stream<Map<String, int>> levels(String groupId) => b._watch(() => Map.of(b._groups[groupId]?.levels ?? const {}));

  @override
  Stream<SeasonTable?> stats(String groupId, String seasonId) => b._watch(() {
        final g = b._groups[groupId];
        return g == null || g.season.id != seasonId ? null : b._table(g);
      });
}

class _DemoApi implements Api {
  _DemoApi(this.b);
  final DemoBackend b;

  String _text(Object? v, {int max = 80}) {
    final s = v is String ? v.trim() : '';
    if (s.isEmpty || s.length > max) throw ApiException('invalid_argument');
    return s;
  }

  @override
  Future<List<String>> claimMemberships() async => [
        for (final g in b._groups.values)
          if (g.members.values.any((m) => m.uid == b._uid && m.active)) g.id,
      ];

  @override
  Future<String> createGroup(
      {required String name, required String venue, required String organizerName, required String language}) async {
    final id = 'group-${++b._groupCounter}';
    final g = _GroupState(
      id: id,
      name: _text(name),
      venue: _text(venue),
      schedule: const Schedule(
        timeZone: 'Africa/Cairo',
        matchWeekday: 4,
        matchTime: '21:00',
        matchDurationMinutes: 90,
        pollOpenWeekday: 7,
        pollOpenTime: '12:00',
      ),
    );
    g.season = Season(id: 's1', name: 'Season 1', startedAt: b.now());
    g.adminUids.add(demoUid);
    g.members['m00'] = Member(
      id: 'm00',
      name: _text(organizerName, max: 40),
      phone: '+201000000001',
      uid: demoUid,
      isAdmin: true,
      isGoalkeeper: false,
      whatsappOptIn: true,
      language: language == 'en' ? 'en' : 'ar',
      active: true,
    );
    final game = b._nextGame(g.schedule, 1)..venue = g.venue;
    g.games[game.id] = game;
    g.gameCounter = 1;
    g.currentGameId = game.id;
    b._groups[id] = g;
    b._schedule(g, game);
    b._changed();
    return id;
  }

  @override
  Future<void> updateGroupSettings(String groupId, Map<String, dynamic> patch) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    if (patch['name'] != null) g.name = _text(patch['name']);
    if (patch['venue'] != null) g.venue = _text(patch['venue']);
    if (patch.containsKey('pitchFee')) g.pitchFee = patch['pitchFee'] as num?;
    if (patch.containsKey('payTo')) {
      final p = (patch['payTo'] as Map?)?.cast<String, dynamic>() ?? const {};
      String? field(Object? v) {
        final s = v is String ? v.trim() : '';
        if (s.length > 60) throw ApiException('invalid_argument');
        return s.isEmpty ? null : s;
      }

      g.payTo = PayTo(instapay: field(p['instapay']), wallet: field(p['wallet']), note: field(p['note']));
    }
    final sch = patch['schedule'] as Map<String, dynamic>?;
    if (sch != null) {
      final old = g.schedule;
      g.schedule = Schedule(
        timeZone: old.timeZone,
        matchWeekday: sch['matchWeekday'] as int? ?? old.matchWeekday,
        matchTime: sch['matchTime'] as String? ?? old.matchTime,
        matchDurationMinutes: sch['matchDurationMinutes'] as int? ?? old.matchDurationMinutes,
        pollOpenWeekday: sch['pollOpenWeekday'] as int? ?? old.pollOpenWeekday,
        pollOpenTime: sch['pollOpenTime'] as String? ?? old.pollOpenTime,
        enabled: sch['enabled'] as bool? ?? old.enabled,
      );
      // Like the server: a weekly poll that hasn't opened yet moves to the new times, or goes if the weekly poll is off.
      for (final game in [...g.games.values]) {
        if (game.kind != 'weekly' || game.status != GameStatus.scheduled) continue;
        if (!g.schedule.enabled) {
          g.games.remove(game.id);
          continue;
        }
        final next = b._nextGame(g.schedule, game.weekNumber);
        game
          ..kickoffAt = next.kickoffAt
          ..pollOpensAt = next.pollOpensAt;
        b._schedule(g, game);
      }
      g.refreshCurrent();
    }
    if (patch['venue'] != null) {
      for (final game in g.games.values.where((x) => x.kind == 'weekly' && x.isAhead)) {
        game.venue = g.venue;
      }
    }
    final r = patch['rules'] as Map<String, dynamic>?;
    if (r != null) {
      final old = g.rules;
      final kits = r['kits'] == null
          ? old.kits
          : _kits([for (final k in r['kits'] as List) Kit.fromMap((k as Map).cast<String, dynamic>())]);
      final squad = r['squadSize'] as int? ?? old.squadSize;
      if (squad < 2 || squad > 60) throw ApiException('invalid_argument');
      final q = r.containsKey('quietHours') ? r['quietHours'] as Map<String, dynamic>? : null;
      final head = r['regularsHeadStartMinutes'] as int? ?? old.regularsHeadStartMinutes;
      if (head < 0 || head > 240) throw ApiException('invalid_argument');
      g.rules = Rules(
        squadSize: squad,
        kits: kits,
        confirmWindowMinutes: r['confirmWindowMinutes'] as int? ?? old.confirmWindowMinutes,
        matchDayConfirmWindowMinutes: r['matchDayConfirmWindowMinutes'] as int? ?? old.matchDayConfirmWindowMinutes,
        lateDropOutHours: r['lateDropOutHours'] as int? ?? old.lateDropOutHours,
        quietHours: r.containsKey('quietHours')
            ? (q == null ? null : QuietHours(q['start'] as String, q['end'] as String))
            : old.quietHours,
        regularsHeadStartMinutes: head,
        lateDropOutsStartAsReserves: r['lateDropOutsStartAsReserves'] as bool? ?? old.lateDropOutsStartAsReserves,
      );
      // A new head start can open the regulars' window on a poll that hasn't opened yet.
      for (final game in g.games.values.where((x) => x.status == GameStatus.scheduled)) {
        b._schedule(g, game);
      }
      // A new squad size applies to this week's poll too, and moves its line between squad and reserves.
      for (final game in g.games.values.where((x) => x.kind == 'weekly' && x.isAhead && x.squadSize != squad)) {
        game.squadSize = squad;
        if (game.status == GameStatus.open) b._applyRoster(g, game, 'expire', null, 'admin');
      }
    }
    final rem = patch['reminders'] as Map<String, dynamic>?;
    if (rem != null) {
      final old = g.reminders;
      g.reminders = Reminders(
        pollOpening: rem['pollOpening'] as bool? ?? old.pollOpening,
        promotion: rem['promotion'] as bool? ?? old.promotion,
        matchDay: rem['matchDay'] as bool? ?? old.matchDay,
        matchDayHoursBefore: rem['matchDayHoursBefore'] as int? ?? old.matchDayHoursBefore,
      );
    }
    b._changed();
  }

  @override
  Future<void> addMember(String groupId,
      {required String name, required String phone, bool isGoalkeeper = false, String language = 'ar'}) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final n = _text(name, max: 40);
    final p = toE164(phone);
    if (p == null) throw ApiException('invalid_argument');
    final existing = g.members.values.where((m) => m.phone == p).firstOrNull;
    if (existing != null && existing.active) throw ApiException('already_exists');
    final id = existing?.id ?? 'm${g.memberCounter++}';
    g.members[id] = Member(
      id: id,
      name: n,
      phone: p,
      uid: null,
      isAdmin: false,
      isGoalkeeper: isGoalkeeper,
      whatsappOptIn: true,
      language: language == 'en' ? 'en' : 'ar',
      active: true,
    );
    b._changed();
  }

  @override
  Future<void> updateMember(String groupId, String memberId,
      {String? name, String? role, bool? isGoalkeeper, bool? isRegular}) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final m = g.members[memberId] ?? (throw ApiException('not_found'));
    bool? isAdmin;
    if (role != null) {
      if (role != 'admin' && role != 'player') throw ApiException('invalid_argument');
      isAdmin = role == 'admin';
      final uid = m.uid;
      if (uid != null) {
        if (!isAdmin && g.adminUids.length == 1 && g.adminUids.first == uid) throw ApiException('last_organizer');
        g.adminUids.remove(uid);
        if (isAdmin) g.adminUids.add(uid);
      }
    }
    g.members[memberId] = _member(m,
        name: name == null ? null : _text(name, max: 40), isAdmin: isAdmin, isGoalkeeper: isGoalkeeper, isRegular: isRegular);
    b._changed();
  }

  @override
  Future<void> removeMember(String groupId, String memberId) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final m = g.members[memberId] ?? (throw ApiException('not_found'));
    b._takeOut(g, m);
    b._changed();
  }

  @override
  Future<void> updateMyPreferences(String groupId, {bool? whatsappOptIn, String? language}) async {
    final g = b._group(groupId);
    final me = b._myMember(g) ?? (throw ApiException('not_member'));
    g.members[me.id] = _member(me, whatsappOptIn: whatsappOptIn, language: language);
    b._changed();
  }

  @override
  Future<({String? state, int? position})> rosterAction(String groupId, String gameId, String action) async {
    final g = b._group(groupId);
    final game = b._game(g, gameId);
    final me = b._myMember(g) ?? (throw ApiException('not_member'));
    if (!const {'join', 'drop', 'confirm', 'pass'}.contains(action)) throw ApiException('invalid_argument');
    final result = b._applyRoster(g, game, action, me.id, 'app');
    final entry = result.entries.where((e) => e.memberId == me.id).firstOrNull;
    final line = RosterLine.from(result.entries, game.squadSize);
    final index = [...line.squad, ...line.reserves].indexWhere((e) => e.memberId == me.id);
    return (state: entry?.state.name, position: index < 0 ? null : index + 1);
  }

  @override
  Future<void> adminRosterAction(String groupId, String gameId, String memberId, String action) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    if (action != 'join' && action != 'remove') throw ApiException('invalid_argument');
    b._applyRoster(g, b._game(g, gameId), action, memberId, 'admin');
  }

  @override
  Future<void> openPollNow(String groupId, String gameId) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final game = b._game(g, gameId);
    if (game.status != GameStatus.scheduled) throw ApiException('invalid_argument');
    b._openPoll(g, game, early: true);
  }

  @override
  Future<void> recordResult(String groupId, String gameId, {required String winner, String? photoPath}) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    if (photoPath != null && !photoPath.startsWith('groups/$groupId/champions/')) throw ApiException('invalid_argument');
    final game = b._game(g, gameId);
    if (game.status == GameStatus.cancelled || b.now().isBefore(game.kickoffAt)) throw ApiException('invalid_argument');
    final kits = game.teams?.map((t) => t.kit) ?? g.rules.kits;
    if (!kits.any((k) => k.name == winner)) throw ApiException('invalid_argument');
    game
      ..status = GameStatus.played
      ..winner = winner
      ..photoPath = photoPath;
    g.lastChampions = Champions(gameId: gameId, weekNumber: game.weekNumber, winner: winner, photoPath: photoPath);
    b._changed();
  }

  /// 2 to 6 kits with different names, like normalizeKits on the server.
  List<Kit> _kits(List<Kit> kits) {
    final names = kits.map((k) => k.name.toLowerCase()).toSet();
    if (kits.length < 2 || kits.length > 6 || names.length != kits.length) throw ApiException('invalid_argument');
    return [for (final k in kits) Kit.base.where((x) => x.color == k.color).firstOrNull ?? k];
  }

  @override
  Future<String> createPoll(String groupId, PollDraft poll) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final t = b.now();
    final opens = poll.pollOpensAt ?? t;
    if (!poll.kickoffAt.isAfter(t) || !opens.isBefore(poll.kickoffAt)) throw ApiException('invalid_argument');
    final game = _GameState(
      id: 'poll-${++g.gameCounter}',
      weekNumber: g.gameCounter,
      kind: 'custom',
      kickoffAt: poll.kickoffAt,
      pollOpensAt: opens.isBefore(t) ? t : opens,
      venue: _text(poll.venue),
      squadSize: poll.squadSize,
      durationMinutes: poll.durationMinutes,
    );
    g.games[game.id] = game;
    b._schedule(g, game);
    if (!opens.isAfter(t)) b._openPoll(g, game, early: true);
    g.refreshCurrent();
    b._changed();
    return game.id;
  }

  @override
  Future<void> updatePoll(String groupId, String gameId, PollDraft poll) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final game = b._game(g, gameId);
    if (!game.isAhead) throw ApiException('invalid_argument');
    final t = b.now();
    if (!poll.kickoffAt.isAfter(t)) throw ApiException('invalid_argument');
    final opens = game.status == GameStatus.scheduled ? (poll.pollOpensAt ?? t) : game.pollOpensAt;
    if (!opens.isBefore(poll.kickoffAt)) throw ApiException('invalid_argument');
    final venue = _text(poll.venue);
    final moved = game.status == GameStatus.open && (poll.kickoffAt != game.kickoffAt || venue != game.venue);
    final resized = poll.squadSize != game.squadSize;
    game
      ..kickoffAt = poll.kickoffAt
      ..pollOpensAt = opens
      ..venue = venue
      ..durationMinutes = poll.durationMinutes
      ..squadSize = poll.squadSize;
    b._schedule(g, game);
    if (game.status == GameStatus.scheduled && !opens.isAfter(t)) b._openPoll(g, game, early: true);
    if (resized && game.status == GameStatus.open) b._applyRoster(g, game, 'expire', null, 'admin');
    final me = b._myMember(g);
    if (moved && me != null && game.hasOnList(me.id)) {
      b._notify(g, (s) => (
            s.t('Game details changed', 'الماتش اتغير'),
            s.t('Now ${s.when(game.kickoffAt)} at ${game.venue}. Your place on the list stays.',
                'المعاد الجديد ${s.when(game.kickoffAt)} في ${game.venue}. مكانك في القائمة زي ما هو.'),
          ));
    }
    g.refreshCurrent();
    b._changed();
  }

  @override
  Future<void> cancelPoll(String groupId, String gameId) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final game = b._game(g, gameId);
    if (game.status == GameStatus.played || game.status == GameStatus.cancelled) throw ApiException('invalid_argument');
    final wasOpen = game.status == GameStatus.open;
    game.status = GameStatus.cancelled;
    final me = b._myMember(g);
    if (wasOpen && me != null && game.hasOnList(me.id)) {
      b._notify(g, (s) => (
            s.t('Game called off', 'الماتش اتلغى'),
            s.t("The game on ${s.when(game.kickoffAt)} is cancelled. We'll let you know about the next one.",
                'ماتش ${s.when(game.kickoffAt)} اتلغى. هنبلغك بالماتش الجاي.'),
          ));
    }
    g.refreshCurrent();
    b._changed();
  }

  @override
  Future<void> setMemberLevel(String groupId, String memberId, int level) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    if (level < 0 || level > 4 || !g.members.containsKey(memberId)) throw ApiException('invalid_argument');
    g.levels[memberId] = level;
    b._changed();
  }

  @override
  Future<void> saveTeams(String groupId, String gameId, List<Team>? teams) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final game = b._game(g, gameId);
    if (game.status == GameStatus.cancelled || game.status == GameStatus.played) throw ApiException('invalid_argument');
    if (teams != null) {
      final kits = _kits([for (final t in teams) t.kit]);
      final seen = <String>{};
      for (final id in teams.expand((t) => t.memberIds)) {
        if (!(g.members[id]?.active ?? false) || !seen.add(id)) throw ApiException('invalid_argument');
      }
      teams = [for (final (i, t) in teams.indexed) Team(kit: kits[i], memberIds: List.of(t.memberIds))];
    }
    game.teams = teams;
    b._changed();
  }

  _GameState _afterKickoff(_GroupState g, String gameId) {
    final game = b._game(g, gameId);
    if (game.status != GameStatus.closed && game.status != GameStatus.played) throw ApiException('invalid_argument');
    return game;
  }

  @override
  Future<void> setGameFee(String groupId, String gameId, num? fee) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final game = _afterKickoff(g, gameId);
    if (fee != null && (fee < 0 || fee >= 1000000)) throw ApiException('invalid_argument');
    game.payments = fee == null || fee == 0 ? null : _split(fee, game.squad, game.payments);
    b._changed();
  }

  @override
  Future<void> setPayment(String groupId, String gameId, String memberId, {required bool paid}) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final game = b._game(g, gameId);
    if (game.payments?.players[memberId] == null) throw ApiException('not_in');
    _setPayment(game, memberId, paid ? PaymentState.paid : PaymentState.unpaid);
    b._changed();
  }

  @override
  Future<void> claimPayment(String groupId, String gameId) async {
    final g = b._group(groupId);
    final me = b._myMember(g) ?? (throw ApiException('not_member'));
    final game = b._game(g, gameId);
    final state = game.payments?.players[me.id] ?? (throw ApiException('not_in'));
    if (state != PaymentState.unpaid) return;
    _setPayment(game, me.id, PaymentState.claimed);
    b._changed();
    // In the player's view the organizer is simulated too: they check and confirm.
    if (g.id == demoGroupId && !g.adminUids.contains(demoUid)) {
      b._after(const Duration(seconds: 4), () {
        if (game.payments?.players[me.id] != PaymentState.claimed) return;
        _setPayment(game, me.id, PaymentState.paid);
        b._notify(g, (s) => (
              s.t('Payment confirmed', 'الدفع اتأكد'),
              s.t('The organizer got your ${s.money(game.payments!.perPlayer)}. Thanks!', 'المنظم استلم ${s.money(game.payments!.perPlayer)}. شكرًا!'),
            ));
        b._changed();
      });
    }
  }

  @override
  Future<int> remindUnpaid(String groupId, String gameId) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final game = b._game(g, gameId);
    final p = game.payments ?? (throw ApiException('not_found'));
    final unpaid = [for (final MapEntry(:key, :value) in p.players.entries) if (value == PaymentState.unpaid) key];
    if (unpaid.contains(b._myMember(g)?.id)) {
      b._notify(g, (s) => (
            s.t('Pitch fee due: ${g.name}', 'فلوس الملعب: ${g.name}'),
            s.t('Your share for ${s.shortDay(game.kickoffAt)} is ${s.money(p.perPlayer)}.',
                'نصيبك من ماتش ${s.shortDay(game.kickoffAt)} ${s.money(p.perPlayer)}.'),
          ));
    }
    // A few of the players pay as soon as they're reminded.
    if (g.id == demoGroupId) {
      for (final (i, id) in unpaid.where((id) => id != _meId).take(3).indexed) {
        b._after(Duration(seconds: 3 + i * 2), () => b._botClaim(game, id));
      }
    }
    return unpaid.length;
  }

  @override
  Future<void> voteMvp(String groupId, String gameId, String memberId) async {
    final g = b._group(groupId);
    final me = b._myMember(g) ?? (throw ApiException('not_member'));
    final game = b._game(g, gameId);
    final voters = game.mvpVoters;
    final closes = game.mvpClosesAt;
    if (voters == null || game.mvpWinners != null || closes == null || !b.now().isBefore(closes)) {
      throw ApiException('invalid_argument');
    }
    final squad = game.squad;
    if (!squad.contains(me.id) || !squad.contains(memberId) || memberId == me.id) throw ApiException('invalid_argument');
    game.ballots[me.id] = memberId;
    if (!voters.contains(me.id)) voters.add(me.id);
    b._changed();
  }

  @override
  Future<void> closeMvpVoting(String groupId, String gameId) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    b._closeMvp(g, b._game(g, gameId));
  }

  @override
  Future<String> startSeason(String groupId, String name) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final t = b.now();
    g.season = Season(id: 's${t.millisecondsSinceEpoch}', name: _text(name, max: 40), startedAt: t);
    b._changed();
    return g.season.id;
  }

  @override
  Future<void> leaveGroup(String groupId) async {
    final g = b._group(groupId);
    b._takeOut(g, b._myMember(g) ?? (throw ApiException('not_member')));
    b._changed();
  }

  @override
  Future<void> deleteAccount() async {
    final mine = [for (final g in b._groups.values) if (b._myMember(g) != null) g];
    if (mine.any((g) => g.adminUids.length == 1 && g.adminUids.first == demoUid)) throw ApiException('last_organizer');
    for (final g in mine) {
      final me = b._myMember(g)!;
      b._takeOut(g, me);
      // Records keep the numbers, never the name or number.
      g.members[me.id] = _member(g.members[me.id]!, name: _formerMember, phone: '', uid: null);
      for (final game in g.games.values) {
        game.entries = [
          for (final e in game.entries)
            e.memberId != me.id
                ? e
                : Entry(
                    memberId: e.memberId,
                    name: _formerMember,
                    seq: e.seq,
                    joinedAt: e.joinedAt,
                    state: e.state,
                    source: e.source,
                    offerExpiresAt: e.offerExpiresAt,
                    outReason: e.outReason,
                    lateDropOut: e.lateDropOut,
                  ),
        ];
      }
      g.levels.remove(me.id);
    }
    b._changed();
  }
}
