import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:tashkeela/l10n.dart';
import 'package:tashkeela/models.dart';
import 'package:tashkeela/screens/home_shell.dart';

final kickoff = DateTime.now().add(const Duration(days: 3));

const tnf = Group(
  id: 'g1',
  name: 'Thursday Night Football',
  venue: 'New Cairo Arena',
  schedule: Schedule(
    timeZone: 'Africa/Cairo',
    matchWeekday: 4,
    matchTime: '21:00',
    matchDurationMinutes: 90,
    pollOpenWeekday: 7,
    pollOpenTime: '12:00',
  ),
  rules: Rules(
    squadSize: 18,
    teamNames: ['Lime', 'Orange', 'Sky'],
    confirmWindowMinutes: 120,
    matchDayConfirmWindowMinutes: 30,
    lateDropOutHours: 24,
    quietHours: QuietHours('00:00', '08:00'),
  ),
  reminders: Reminders(pollOpening: true, promotion: true, matchDay: true, matchDayHoursBefore: 4),
  adminUids: ['org'],
  currentGameId: 'game1',
  lastChampions: null,
  pitchFee: 2160,
);

Member member(int i, {String? uid, bool goalkeeper = false}) => Member(
      id: 'm$i',
      name: 'Player $i',
      phone: '+2010000000${i.toString().padLeft(2, '0')}',
      uid: uid,
      isAdmin: uid == 'org',
      isGoalkeeper: goalkeeper,
      whatsappOptIn: true,
      language: 'en',
      active: true,
    );

Entry entry(int i, {EntryState state = EntryState.confirmed, DateTime? offerExpiresAt, String? outReason}) => Entry(
      memberId: 'm$i',
      name: 'Player $i',
      seq: i,
      joinedAt: DateTime(2026, 10, 18, 12),
      state: state,
      source: i == 2 ? 'whatsapp' : 'app',
      offerExpiresAt: offerExpiresAt,
      outReason: outReason,
    );

Game game({GameStatus status = GameStatus.open, int squadCount = 18, int reserveCount = 2}) => Game(
      id: 'game1',
      weekNumber: 12,
      kickoffAt: kickoff,
      pollOpensAt: kickoff.subtract(const Duration(days: 4)),
      status: status,
      squadSize: 18,
      squadCount: squadCount,
      reserveCount: reserveCount,
      winner: null,
      photoPath: null,
    );

/// 20 entries: 18 confirmed, 2 waiting. Override single entries with [overrides].
List<Entry> line20([Map<int, Entry> overrides = const {}]) => [
      for (var i = 1; i <= 20; i++) overrides[i] ?? entry(i, state: i <= 18 ? EntryState.confirmed : EntryState.waiting),
    ];

GroupView view({String uid = 'u7', List<Entry>? entries, Game? currentGame, bool admin = false}) => GroupView(
      uid: admin ? 'org' : uid,
      group: tnf,
      members: [for (var i = 1; i <= 21; i++) member(i, uid: admin && i == 1 ? 'org' : (i == 7 ? 'u7' : null), goalkeeper: i == 3)],
      game: currentGame ?? game(),
      entries: entries ?? line20(),
      log: const [],
      groupIds: const ['g1'],
    );

Widget host(Widget child, {String lang = 'en'}) => LanguageScope(
      language: ValueNotifier(lang),
      child: MaterialApp(
        locale: Locale(lang),
        supportedLocales: const [Locale('ar'), Locale('en')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        home: Scaffold(body: child),
      ),
    );
