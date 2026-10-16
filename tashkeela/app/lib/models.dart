// Read-only views of the Firestore documents written by Cloud Functions.
// See functions/src/model.ts for the authoritative shapes.

import 'package:cloud_firestore/cloud_firestore.dart';

import 'kits.dart';

export 'kits.dart';

DateTime? _date(Object? v) => v is Timestamp ? v.toDate() : null;

class Schedule {
  const Schedule({
    required this.timeZone,
    required this.matchWeekday,
    required this.matchTime,
    required this.matchDurationMinutes,
    required this.pollOpenWeekday,
    required this.pollOpenTime,
    this.enabled = true,
  });

  final String timeZone;
  final int matchWeekday; // ISO: 1 = Monday ... 7 = Sunday
  final String matchTime; // "HH:mm"
  final int matchDurationMinutes;
  final int pollOpenWeekday;
  final String pollOpenTime;

  /// Off: no weekly poll; the organizer makes each poll.
  final bool enabled;

  factory Schedule.fromMap(Map<String, dynamic> m) => Schedule(
        timeZone: m['timeZone'] as String? ?? 'Africa/Cairo',
        matchWeekday: m['matchWeekday'] as int? ?? 4,
        matchTime: m['matchTime'] as String? ?? '21:00',
        matchDurationMinutes: m['matchDurationMinutes'] as int? ?? 90,
        pollOpenWeekday: m['pollOpenWeekday'] as int? ?? 7,
        pollOpenTime: m['pollOpenTime'] as String? ?? '12:00',
        enabled: m['enabled'] as bool? ?? true,
      );
}

class QuietHours {
  const QuietHours(this.start, this.end);
  final String start;
  final String end;
}

class Rules {
  const Rules({
    required this.squadSize,
    required this.kits,
    required this.confirmWindowMinutes,
    required this.matchDayConfirmWindowMinutes,
    required this.lateDropOutHours,
    required this.quietHours,
  });

  /// Squad size for new polls.
  final int squadSize;

  /// The kits teams play in.
  final List<Kit> kits;
  final int confirmWindowMinutes;
  final int matchDayConfirmWindowMinutes;
  final int lateDropOutHours;
  final QuietHours? quietHours;

  factory Rules.fromMap(Map<String, dynamic> m) {
    final q = m['quietHours'] as Map<String, dynamic>?;
    return Rules(
      squadSize: m['squadSize'] as int? ?? 18,
      kits: [for (final k in (m['kits'] as List?) ?? const []) Kit.fromMap((k as Map).cast<String, dynamic>())].nonEmptyOr(Kit.base),
      confirmWindowMinutes: m['confirmWindowMinutes'] as int? ?? 120,
      matchDayConfirmWindowMinutes: m['matchDayConfirmWindowMinutes'] as int? ?? 30,
      lateDropOutHours: m['lateDropOutHours'] as int? ?? 24,
      quietHours: q == null ? null : QuietHours(q['start'] as String, q['end'] as String),
    );
  }
}

class Reminders {
  const Reminders({
    required this.pollOpening,
    required this.promotion,
    required this.matchDay,
    required this.matchDayHoursBefore,
  });

  final bool pollOpening;
  final bool promotion;
  final bool matchDay;
  final int matchDayHoursBefore;

  factory Reminders.fromMap(Map<String, dynamic> m) => Reminders(
        pollOpening: m['pollOpening'] as bool? ?? true,
        promotion: m['promotion'] as bool? ?? true,
        matchDay: m['matchDay'] as bool? ?? true,
        matchDayHoursBefore: m['matchDayHoursBefore'] as int? ?? 4,
      );
}

class Champions {
  const Champions({required this.gameId, required this.weekNumber, required this.winner, this.photoPath});
  final String gameId;
  final int weekNumber;
  final String winner;
  final String? photoPath;
}

class Group {
  const Group({
    required this.id,
    required this.name,
    required this.venue,
    required this.schedule,
    required this.rules,
    required this.reminders,
    required this.adminUids,
    required this.currentGameId,
    required this.lastChampions,
    required this.pitchFee,
  });

  final String id;
  final String name;
  final String venue;
  final Schedule schedule;
  final Rules rules;
  final Reminders reminders;
  final List<String> adminUids;
  final String? currentGameId;
  final Champions? lastChampions;
  final num? pitchFee;

  bool isAdmin(String? uid) => uid != null && adminUids.contains(uid);

  factory Group.fromDoc(DocumentSnapshot<Map<String, dynamic>> d) {
    final m = d.data() ?? const {};
    final c = m['lastChampions'] as Map<String, dynamic>?;
    return Group(
      id: d.id,
      name: m['name'] as String? ?? '',
      venue: m['venue'] as String? ?? '',
      schedule: Schedule.fromMap((m['schedule'] as Map<String, dynamic>?) ?? const {}),
      rules: Rules.fromMap((m['rules'] as Map<String, dynamic>?) ?? const {}),
      reminders: Reminders.fromMap((m['reminders'] as Map<String, dynamic>?) ?? const {}),
      adminUids: (m['adminUids'] as List?)?.cast<String>() ?? const [],
      currentGameId: m['currentGameId'] as String?,
      lastChampions: c == null
          ? null
          : Champions(
              gameId: c['gameId'] as String,
              weekNumber: c['weekNumber'] as int? ?? 0,
              winner: c['winner'] as String,
              photoPath: c['photoPath'] as String?,
            ),
      pitchFee: m['pitchFee'] as num?,
    );
  }
}

class Member {
  const Member({
    required this.id,
    required this.name,
    required this.phone,
    required this.uid,
    required this.isAdmin,
    required this.isGoalkeeper,
    required this.whatsappOptIn,
    required this.language,
    required this.active,
  });

  final String id;
  final String name;
  final String phone;
  final String? uid;
  final bool isAdmin;
  final bool isGoalkeeper;
  final bool whatsappOptIn;
  final String language;
  final bool active;

  factory Member.fromDoc(DocumentSnapshot<Map<String, dynamic>> d) {
    final m = d.data() ?? const {};
    return Member(
      id: d.id,
      name: m['name'] as String? ?? '',
      phone: m['phone'] as String? ?? '',
      uid: m['uid'] as String?,
      isAdmin: m['role'] == 'admin',
      isGoalkeeper: m['isGoalkeeper'] as bool? ?? false,
      whatsappOptIn: m['whatsappOptIn'] as bool? ?? true,
      language: m['language'] as String? ?? 'ar',
      active: m['active'] as bool? ?? true,
    );
  }
}

enum GameStatus { scheduled, open, closed, played, cancelled }

/// One poll: a game with its own date, place and squad. Weekly polls come
/// from the group's schedule; custom ones an organizer made.
class Game {
  const Game({
    required this.id,
    required this.weekNumber,
    required this.kickoffAt,
    required this.pollOpensAt,
    required this.status,
    required this.squadSize,
    required this.squadCount,
    required this.reserveCount,
    required this.winner,
    required this.photoPath,
    this.kind = 'weekly',
    this.venue,
    this.durationMinutes = 90,
    this.teams,
  });

  final String id;
  final int weekNumber;
  final DateTime kickoffAt;
  final DateTime pollOpensAt;
  final GameStatus status;
  final int squadSize;
  final int squadCount;
  final int reserveCount;
  final String? winner;
  final String? photoPath;

  /// weekly or custom.
  final String kind;

  /// Where it's played; null for older games (use the group's venue).
  final String? venue;
  final int durationMinutes;

  /// The teams the organizer made, if any.
  final List<Team>? teams;

  bool get isCustom => kind == 'custom';

  /// Still ahead: votes can come in (or will, once the poll opens).
  bool get isAhead => status == GameStatus.scheduled || status == GameStatus.open;

  factory Game.fromDoc(DocumentSnapshot<Map<String, dynamic>> d) {
    final m = d.data() ?? const {};
    final result = m['result'] as Map<String, dynamic>?;
    return Game(
      id: d.id,
      weekNumber: m['weekNumber'] as int? ?? 0,
      kickoffAt: _date(m['kickoffAt']) ?? DateTime.now(),
      pollOpensAt: _date(m['pollOpensAt']) ?? DateTime.now(),
      status: GameStatus.values.asNameMap()[m['status']] ?? GameStatus.scheduled,
      squadSize: m['squadSize'] as int? ?? 18,
      squadCount: m['squadCount'] as int? ?? 0,
      reserveCount: m['reserveCount'] as int? ?? 0,
      winner: result?['winner'] as String?,
      photoPath: result?['photoPath'] as String?,
      kind: m['kind'] as String? ?? 'weekly',
      venue: m['venue'] as String?,
      durationMinutes: m['durationMinutes'] as int? ?? 90,
      teams: switch (m['teams']) {
        {'teams': final List<dynamic> list} => [for (final t in list) Team.fromMap((t as Map).cast<String, dynamic>())],
        _ => null,
      },
    );
  }
}

enum EntryState { confirmed, waiting, offered, out }

class Entry {
  const Entry({
    required this.memberId,
    required this.name,
    required this.seq,
    required this.joinedAt,
    required this.state,
    required this.source,
    this.offerExpiresAt,
    this.outReason,
    this.lateDropOut = false,
  });

  final String memberId;
  final String name;
  final int seq;
  final DateTime joinedAt;
  final EntryState state;
  final String source;
  final DateTime? offerExpiresAt;
  final String? outReason;
  final bool lateDropOut;

  bool get active => state != EntryState.out;

  factory Entry.fromDoc(DocumentSnapshot<Map<String, dynamic>> d) {
    final m = d.data() ?? const {};
    return Entry(
      memberId: m['memberId'] as String? ?? d.id,
      name: m['name'] as String? ?? '',
      seq: m['seq'] as int? ?? 0,
      joinedAt: _date(m['joinedAt']) ?? DateTime.now(),
      state: EntryState.values.asNameMap()[m['state']] ?? EntryState.out,
      source: m['source'] as String? ?? 'app',
      offerExpiresAt: _date(m['offerExpiresAt']),
      outReason: m['outReason'] as String?,
      lateDropOut: m['lateDropOut'] as bool? ?? false,
    );
  }
}

/// One line of the vote log ("Islam dropped out", "Adham was offered the spot").
class LogItem {
  const LogItem({required this.type, required this.memberId, required this.at, this.late = false});
  final String type;
  final String? memberId;
  final DateTime at;
  final bool late;

  factory LogItem.fromDoc(DocumentSnapshot<Map<String, dynamic>> d) {
    final m = d.data() ?? const {};
    return LogItem(
      type: m['type'] as String? ?? '',
      memberId: m['memberId'] as String?,
      at: _date(m['at']) ?? DateTime.now(),
      late: m['late'] as bool? ?? false,
    );
  }
}

extension _NonEmptyOr<T> on List<T> {
  List<T> nonEmptyOr(List<T> fallback) => isEmpty ? fallback : this;
}
