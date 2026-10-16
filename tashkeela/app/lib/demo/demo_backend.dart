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
  const _Bot(this.id, this.name, this.language, {this.whatsapp = false, this.goalkeeper = false});
  final String id;
  final String name;
  final String language;

  /// Votes by tapping the WhatsApp button instead of using the app.
  final bool whatsapp;
  final bool goalkeeper;
}

/// The first 17 vote within seconds of the poll opening; the next three are
/// a little slower and end up as reserves unless you are slower still.
/// Fady never votes.
const _bots = [
  _Bot('m01', 'Mostafa H.', 'ar', goalkeeper: true),
  _Bot('m02', 'Mahmoud R.', 'ar', whatsapp: true),
  _Bot('m03', 'Ali F.', 'en'),
  _Bot('m04', 'Amr G.', 'ar', whatsapp: true),
  _Bot('m05', 'Ziad E.', 'en', goalkeeper: true),
  _Bot('m06', 'Sherif L.', 'ar'),
  _Bot('m07', 'Khaled W.', 'ar', whatsapp: true),
  _Bot('m08', 'Hassan T.', 'ar', whatsapp: true),
  _Bot('m09', 'Mido A.', 'en'),
  _Bot('m10', 'Seif O.', 'ar', goalkeeper: true),
  _Bot('m11', 'Nour E.', 'ar', whatsapp: true),
  _Bot('m12', 'Omar K.', 'en'),
  _Bot('m13', 'Adham S.', 'ar'),
  _Bot('m14', 'Ramy H.', 'ar', whatsapp: true),
  _Bot('m15', 'Hany B.', 'en'),
  _Bot('m16', 'Tarek N.', 'ar', whatsapp: true),
  _Bot('m17', 'Islam D.', 'ar'),
  _Bot('m18', 'Karim M.', 'ar', whatsapp: true),
  _Bot('m19', 'Bassem K.', 'en'),
  _Bot('m20', 'Youssef A.', 'en'),
  _Bot('m21', 'Fady M.', 'ar', whatsapp: true),
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
  teamNames: ['Lime', 'Orange', 'Sky'],
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
  String? currentGameId;
  Champions? lastChampions;
  int memberCounter = 100;

  _GameState? get currentGame => games[currentGameId];

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
  _GameState({required this.id, required this.weekNumber, required this.kickoffAt, required this.pollOpensAt});

  final String id;
  final int weekNumber;
  DateTime kickoffAt;
  DateTime pollOpensAt;
  GameStatus status = GameStatus.scheduled;
  int nextSeq = 1;
  List<Entry> entries = const [];
  final log = <LogItem>[];
  String? winner;
  String? photoPath;

  Game view(int squadSize) {
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
    );
  }
}

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
    final game = _GameState(id: 'week-12', weekNumber: 12, kickoffAt: kickoff, pollOpensAt: opens);
    g.games[game.id] = game;
    g.currentGameId = game.id;
    g.lastChampions = const Champions(gameId: 'week-11', weekNumber: 11, winner: 'Orange');
    _groups[demoGroupId] = g;
    _schedule(g, game);
    _changed();
  }

  /// Timers for the poll opening and kick-off.
  void _schedule(_GroupState g, _GameState game) {
    if (game.status == GameStatus.scheduled) _at(game.pollOpensAt, () => _openPoll(g, game));
    _at(game.kickoffAt, () => _close(g, game));
  }

  void _openPoll(_GroupState g, _GameState game) {
    if (game.status != GameStatus.scheduled) return;
    final t = now();
    game.status = GameStatus.open;
    if (game.pollOpensAt.isAfter(t)) game.pollOpensAt = t;
    _notify(g, (s) => (
          s.t('Poll is open: ${g.name}', 'التصويت مفتوح: ${g.name}'),
          s.t('${s.when(game.kickoffAt)} · ${s.n(g.rules.squadSize)} spots. Tap to grab yours.',
              '${s.when(game.kickoffAt)} – ${s.n(g.rules.squadSize)} مكان. اضغط عشان تحجز مكانك.'),
        ));
    _changed();
    if (g.id != demoGroupId) return;

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
    if (game.status == GameStatus.open) _applyRoster(g, game, 'expire', null, 'app');
    game.status = GameStatus.closed;
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
    final squad = RosterLine.from(game.entries, g.rules.squadSize).squad;
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
    final ctx = roster.RosterContext(now: t, kickoffAt: game.kickoffAt, rules: g.rules);
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
    return _GameState(id: 'week-$weekNumber', weekNumber: weekNumber, kickoffAt: kickoff, pollOpensAt: opens);
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
  Stream<Game?> game(String groupId, String gameId) => b._watch(() {
        final g = b._groups[groupId];
        return g?.games[gameId]?.view(g.rules.squadSize);
      });

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
    final played = g.games.values.where((x) => !x.kickoffAt.isAfter(t)).toList()
      ..sort((x, y) => y.kickoffAt.compareTo(x.kickoffAt));
    return played.firstOrNull?.view(g.rules.squadSize);
  }
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
    final game = b._nextGame(g.schedule, 1);
    g.games[game.id] = game;
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
      );
      // Like the server: a game whose poll hasn't opened yet moves to the new times.
      final game = g.currentGame;
      if (game != null && game.status == GameStatus.scheduled) {
        final next = b._nextGame(g.schedule, game.weekNumber);
        game
          ..kickoffAt = next.kickoffAt
          ..pollOpensAt = next.pollOpensAt;
        if (g.id == demoGroupId) b._cancelTimers();
        b._schedule(g, game);
      }
    }
    final r = patch['rules'] as Map<String, dynamic>?;
    if (r != null) {
      final old = g.rules;
      final teams = (r['teamNames'] as List?)?.cast<String>() ?? old.teamNames;
      final squad = r['squadSize'] as int? ?? old.squadSize;
      if (teams.isEmpty || squad < 2 || squad > 40) throw ApiException('invalid_argument');
      final q = r.containsKey('quietHours') ? r['quietHours'] as Map<String, dynamic>? : null;
      g.rules = Rules(
        squadSize: squad,
        teamNames: teams,
        confirmWindowMinutes: r['confirmWindowMinutes'] as int? ?? old.confirmWindowMinutes,
        matchDayConfirmWindowMinutes: r['matchDayConfirmWindowMinutes'] as int? ?? old.matchDayConfirmWindowMinutes,
        lateDropOutHours: r['lateDropOutHours'] as int? ?? old.lateDropOutHours,
        quietHours: r.containsKey('quietHours')
            ? (q == null ? null : QuietHours(q['start'] as String, q['end'] as String))
            : old.quietHours,
      );
      // A new squad size moves the line between squad and reserves.
      final game = g.currentGame;
      if (game != null && game.status == GameStatus.open) b._applyRoster(g, game, 'expire', null, 'admin');
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
    final game = g.currentGame;
    if (game != null) {
      try {
        b._applyRoster(g, game, 'remove', memberId, 'admin');
      } on ApiException catch (e) {
        // Not on this week's list, or the poll is closed: nothing to undo.
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
    final line = RosterLine.from(result.entries, g.rules.squadSize);
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
  Future<void> openPollNow(String groupId) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    final game = g.currentGame ?? (throw ApiException('not_found'));
    if (game.status != GameStatus.scheduled) throw ApiException('invalid_argument');
    b._openPoll(g, game);
  }

  @override
  Future<void> recordResult(String groupId, String gameId, {required String winner, String? photoPath}) async {
    final g = b._group(groupId);
    b._requireAdmin(g);
    if (!g.rules.teamNames.contains(winner)) throw ApiException('invalid_argument');
    if (photoPath != null && !photoPath.startsWith('groups/$groupId/champions/')) throw ApiException('invalid_argument');
    final game = b._game(g, gameId);
    if (b.now().isBefore(game.kickoffAt)) throw ApiException('invalid_argument');
    game
      ..status = GameStatus.played
      ..winner = winner
      ..photoPath = photoPath;
    g.lastChampions = Champions(gameId: gameId, weekNumber: game.weekNumber, winner: winner, photoPath: photoPath);
    b._changed();
  }
}
