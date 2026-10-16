// Everything the real app gets from Firebase, simulated on the phone for the
// demo build: one group of 22, a poll that opens a minute after you sign in,
// and 21 scripted players who race you for the 18 spots, drop out and answer
// offers. The list rules are the server's (see roster.dart). Nothing leaves
// the phone, and everything starts over when the app is closed.

import 'dart:async';

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

const _defaultRules = Rules(
  squadSize: 18,
  kits: Kit.base,
  confirmWindowMinutes: 120,
  matchDayConfirmWindowMinutes: 30,
  lateDropOutHours: 24,
  quietHours: QuietHours('00:00', '08:00'),
);
const _defaultReminders = Reminders(pollOpening: true, promotion: true, matchDay: true, matchDayHoursBefore: 4);

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
    );
  }
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

Member _member(Member m, {String? name, bool? isAdmin, bool? isGoalkeeper, bool? whatsappOptIn, String? language, bool? active}) =>
    Member(
      id: m.id,
      name: name ?? m.name,
      phone: m.phone,
      uid: m.uid,
      isAdmin: isAdmin ?? m.isAdmin,
      isGoalkeeper: isGoalkeeper ?? m.isGoalkeeper,
      whatsappOptIn: whatsappOptIn ?? m.whatsappOptIn,
      language: language ?? m.language,
      active: active ?? m.active,
    );

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
    g.adminUids.add(demoUid);
    g.levels[_meId] = 2;
    g.members[_meId] = Member(
      id: _meId,
      name: 'Ahmed S.',
      phone: '+201000000001',
      uid: demoUid,
      isAdmin: true,
      isGoalkeeper: false,
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
        whatsappOptIn: true,
        language: b.language,
        active: true,
      );
    }
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
    if (game.status == GameStatus.scheduled) _at(game.pollOpensAt, () => _openPoll(g, game));
    _at(game.kickoffAt, () => _close(g, game));
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
    g.refreshCurrent();
    _changed();
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
    if (action != 'expire') {
      if (game.status == GameStatus.scheduled) throw ApiException('poll_not_open');
      if (game.status != GameStatus.open || !t.isBefore(game.kickoffAt)) throw ApiException('game_closed');
    }
    final ctx = roster.RosterContext(now: t, kickoffAt: game.kickoffAt, rules: _rulesFor(g.rules, game.squadSize));
    final roster.RosterResult result;
    try {
      switch (action) {
        case 'join':
          final m = g.members[memberId];
          if (m == null || !m.active) throw ApiException('not_member');
          result = roster.join(game.entries, memberId: m.id, name: m.name, seq: game.nextSeq, source: source, ctx: ctx);
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
    if (!b._groups.containsKey(demoGroupId)) b._startWeek();
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
      g.rules = Rules(
        squadSize: squad,
        kits: kits,
        confirmWindowMinutes: r['confirmWindowMinutes'] as int? ?? old.confirmWindowMinutes,
        matchDayConfirmWindowMinutes: r['matchDayConfirmWindowMinutes'] as int? ?? old.matchDayConfirmWindowMinutes,
        lateDropOutHours: r['lateDropOutHours'] as int? ?? old.lateDropOutHours,
        quietHours: r.containsKey('quietHours')
            ? (q == null ? null : QuietHours(q['start'] as String, q['end'] as String))
            : old.quietHours,
      );
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
  Future<void> updateMember(String groupId, String memberId, {String? name, String? role, bool? isGoalkeeper}) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final m = g.members[memberId] ?? (throw ApiException('not_found'));
    bool? isAdmin;
    if (role != null) {
      if (role != 'admin' && role != 'player') throw ApiException('invalid_argument');
      isAdmin = role == 'admin';
      final uid = m.uid;
      if (uid != null) {
        if (!isAdmin && g.adminUids.length == 1 && g.adminUids.first == uid) throw ApiException('invalid_argument');
        g.adminUids.remove(uid);
        if (isAdmin) g.adminUids.add(uid);
      }
    }
    g.members[memberId] =
        _member(m, name: name == null ? null : _text(name, max: 40), isAdmin: isAdmin, isGoalkeeper: isGoalkeeper);
    b._changed();
  }

  @override
  Future<void> removeMember(String groupId, String memberId) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final m = g.members[memberId] ?? (throw ApiException('not_found'));
    if (m.uid != null && g.adminUids.contains(m.uid) && g.adminUids.length == 1) throw ApiException('invalid_argument');
    for (final game in g.games.values.where((x) => x.isAhead)) {
      try {
        b._applyRoster(g, game, 'remove', memberId, 'admin');
      } on ApiException catch (e) {
        // Not on that poll's list, or it isn't open: nothing to undo.
        if (!const {'not_in', 'poll_not_open', 'game_closed'}.contains(e.code)) rethrow;
      }
    }
    g.members[memberId] = _member(m, active: false);
    g.adminUids.remove(m.uid);
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
}
