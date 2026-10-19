// The demo build end to end: sign in, race the scripted players, watch a
// drop-out go down the reserve list, take an offer, record the winners, pay
// the pitch, vote for man of the match, and the priority and privacy rules.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:tashkeela/app.dart';
import 'package:tashkeela/demo/demo_backend.dart';
import 'package:tashkeela/models.dart';
import 'package:tashkeela/roster_line.dart';
import 'package:tashkeela/services/api.dart';

Future<void> signIn(WidgetTester tester) async {
  await tester.enterText(find.byType(TextField), '010 0123 4567');
  await tester.tap(find.text('Send code'));
  await tester.pump();
  await tester.enterText(find.byType(TextField), '123456');
  await tester.tap(find.text('Sign in'));
  // Sign-in, group list, then the group's own streams: a few frames.
  for (var i = 0; i < 4; i++) {
    await tester.pump(const Duration(milliseconds: 500));
  }
}

Future<void> wait(WidgetTester tester, int seconds) async {
  for (var i = 0; i < seconds; i++) {
    await tester.pump(const Duration(seconds: 1));
  }
}

/// A route push or pop: one frame to start it, then time for the transition.
Future<void> navigate(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(seconds: 1));
}

Future<void> tapText(WidgetTester tester, String text) => tapOn(tester, find.text(text));

Future<void> tapOn(WidgetTester tester, Finder target) async {
  await scrollTo(tester, target);
  // Notifications show as snack bars and can sit over the target.
  tester.state<ScaffoldMessengerState>(find.byType(ScaffoldMessenger).first)
    ..clearSnackBars()
    ..removeCurrentSnackBar();
  await tester.pump();
  await tester.tap(target);
  await tester.pump();
}

/// The current value of a demo stream. Read outside the test's fake clock, or the next frame never comes.
Future<T> latest<T>(WidgetTester tester, Stream<T> stream) async => (await tester.runAsync(() => stream.first)) as T;

Future<void> toTop(WidgetTester tester) async {
  tester.state<ScrollableState>(find.byType(Scrollable).first).position.jumpTo(0);
  await tester.pump();
}

/// Scrolls the tab from the top until [target] is on screen, then lays the new position out.
Future<void> scrollTo(WidgetTester tester, Finder target) async {
  await toTop(tester);
  await tester.scrollUntilVisible(target, 200, scrollable: find.byType(Scrollable).first);
  await tester.pump();
}

void main() {
  setUpAll(initializeDateFormatting);

  late DemoBackend backend;
  var finished = false;

  Future<void> finish(WidgetTester tester) async {
    if (finished) return;
    finished = true;
    await tester.pumpWidget(const SizedBox());
    backend.dispose();
    await tester.pump();
  }

  Future<void> start(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.6;
    addTearDown(tester.view.reset);
    // The screens read the real clock, so the demo runs on real time plus the test's fake time.
    final realStart = DateTime.now();
    final fakeStart = tester.binding.clock.now();
    backend = DemoBackend(clock: () => realStart.add(tester.binding.clock.now().difference(fakeStart)), language: 'en');
    finished = false;
    // Also when a test fails: the countdowns' timers would otherwise keep it running.
    addTearDown(() => finish(tester));
    await tester.pumpWidget(TashkeelaApp(services: backend.services));
    await tester.pump();
  }

  testWidgets('you race the others, and a drop-out goes down the reserve list', (tester) async {
    await start(tester);
    expect(find.textContaining('any mobile number works'), findsOneWidget);
    await signIn(tester);

    expect(find.textContaining('Night Football'), findsWidgets);
    expect(find.textContaining('Poll opens'), findsOneWidget);
    await tester.tap(find.text('Open the poll now'));
    await tester.pump(const Duration(seconds: 2));

    // Two players are in by now; you're third.
    await tester.tap(find.text("I'M IN"));
    await tester.pump();
    expect(find.text("You're in · #3 of 18"), findsOneWidget);

    await wait(tester, 20);
    expect(find.text('18 / 18 in'), findsOneWidget);

    // Islam drops out at 30 s (late only if kick-off is within a day); Karim passes, Bassem takes the spot.
    await wait(tester, 22);
    await tester.scrollUntilVisible(find.text('Bassem K. confirmed'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.textContaining('Islam D. dropped out'), findsOneWidget);
    expect(find.text('Karim M. passed'), findsOneWidget);
    expect(find.text('Bassem K. confirmed'), findsOneWidget);
    await finish(tester);
  });

  testWidgets('a slow vote makes you a reserve, and the next free spot is offered to you', (tester) async {
    await start(tester);
    await signIn(tester);
    await tester.tap(find.text('Open the poll now'));
    await wait(tester, 20);

    // Seventeen fast players and Karim filled the squad; Bassem and Youssef are reserves.
    await tester.tap(find.text("I'M IN"));
    await tester.pump();
    expect(find.text("Squad is full. You're reserve #3"), findsOneWidget);

    // Islam's spot goes to Bassem at 30 s. Two more drop-outs and the next spot is yours.
    await wait(tester, 16);
    await backend.dropSomeone();
    await wait(tester, 6);
    await backend.dropSomeone();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('A SPOT OPENED UP'), findsOneWidget);
    await tester.tap(find.text("Confirm, I'm in"));
    await tester.pump();
    expect(find.text("You're in · #18 of 18"), findsOneWidget);
    expect(find.text('A SPOT OPENED UP'), findsNothing);
    await finish(tester);
  });

  testWidgets('after the game the organizer records the winners', (tester) async {
    await start(tester);
    await signIn(tester);
    await tester.tap(find.text('Group'));
    await tester.pump();
    expect(find.text('Someone drops out'), findsOneWidget);
    await tapText(tester, 'Skip to after the game');
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.text('Polls'));
    await tester.pump();
    expect(find.text('The poll for this game is closed.'), findsOneWidget);
    expect(find.text('Record the winners'), findsOneWidget);

    await backend.services.api.recordResult(demoGroupId, 'week-12', winner: 'White');
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Full time.'), findsOneWidget);
    expect(find.textContaining('TEAM WHITE'), findsOneWidget);
    expect((await backend.services.repo.lastPlayedGame(demoGroupId))?.status, GameStatus.played);

    // A regular player doesn't get the organizer's controls.
    await tester.tap(find.text('Group'));
    await tester.pump();
    await tapText(tester, 'Organizer controls');
    await tester.pump();
    expect(find.text('Game settings'), findsNothing);
    await finish(tester);
  });

  testWidgets('an organizer makes an extra poll and balanced teams in red, black and white', (tester) async {
    await start(tester);
    await signIn(tester);

    await tester.tap(find.text('New poll'));
    await navigate(tester);
    expect(find.text('NEW POLL'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Zayed Club · Pitch 2');
    await tapText(tester, 'Create poll');
    await navigate(tester);

    // Voting opened at once, and the players vote within seconds.
    await wait(tester, 12);
    expect(find.text('Zayed Club · Pitch 2'), findsOneWidget);
    expect(find.text('18 / 18 in'), findsOneWidget);

    await tapText(tester, 'Make teams');
    await navigate(tester);
    expect(find.text('RED'), findsOneWidget);
    expect(find.text('BLACK'), findsOneWidget);
    expect(find.textContaining('6 players'), findsWidgets);
    await tester.scrollUntilVisible(find.text('WHITE'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.textContaining('6 players'), findsWidgets);
    await tapText(tester, 'Save');
    await navigate(tester);

    // Everyone sees the teams on the poll.
    await tester.scrollUntilVisible(find.text('WHITE'), 200, scrollable: find.byType(Scrollable).first);
    expect(find.text('RED'), findsOneWidget);
    expect(find.text('BLACK'), findsOneWidget);

    // Only organizers see levels: badges in the member list.
    await tester.tap(find.text('Group'));
    await tester.pump();
    await tester.scrollUntilVisible(find.text('Bassem K.'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('L3'), findsWidgets);
    await finish(tester);
  });

  testWidgets('after the game everyone pays their share and votes for man of the match', (tester) async {
    await start(tester);
    await signIn(tester);
    await tester.tap(find.text('Open the poll now'));
    await tester.pump(const Duration(seconds: 2));
    await tester.tap(find.text("I'M IN"));
    await wait(tester, 20);
    await backend.skipToAfterTheGame();
    await wait(tester, 3);

    // A secret vote for someone else who played.
    await tapOn(tester, find.widgetWithText(ActionChip, 'Omar K.'));
    await scrollTo(tester, find.text('Your vote is in'));

    // 2,160 EGP between 18 players, and where to send it.
    await scrollTo(tester, find.text("I've paid"));
    expect(find.text('120 EGP'), findsOneWidget);
    expect(find.text('You owe 120 EGP'), findsOneWidget);
    expect(find.textContaining('ahmed.s@instapay'), findsOneWidget);
    await tester.tap(find.text("I've paid"));
    await tester.pump();
    expect(find.text('Waiting for the organizer to confirm'), findsOneWidget);

    // The organizer confirms from the list.
    await tapOn(tester, find.widgetWithText(ListTile, 'Ahmed S.'));
    await tester.pump();
    await toTop(tester);
    await scrollTo(tester, find.text('You paid. Thanks!'));

    // Everyone else votes within seconds; the organizer closes the vote.
    await wait(tester, 12);
    await toTop(tester);
    await scrollTo(tester, find.textContaining('18 of 18 players voted'));
    final before = await latest(tester, backend.services.repo.stats(demoGroupId, 's1'));
    await tapText(tester, 'Close voting now');
    await tester.pump(const Duration(seconds: 1));
    await toTop(tester);
    await scrollTo(tester, find.text('MAHMOUD R.'));
    expect(find.text('10 votes'), findsOneWidget);

    // The season table: 11 earlier weeks plus this one.
    final after = await latest(tester, backend.services.repo.stats(demoGroupId, 's1'));
    int mvps(SeasonTable? t) => t!.players.firstWhere((p) => p.memberId == 'm02').mvp;
    expect(after!.games, 12);
    expect(mvps(after), mvps(before) + 1);
    await tester.tap(find.text('Table'));
    await tester.pump();
    expect(find.text('SEASON 1'), findsOneWidget);
    expect(find.textContaining('12 games'), findsOneWidget);
    await scrollTo(tester, find.text('Ahmed S. (you)'));

    // Reminding whoever hasn't paid.
    await tester.tap(find.text('Polls'));
    await tester.pump();
    await tapOn(tester, find.textContaining("who haven't paid"));
    await tester.pump();
    expect(find.textContaining('on WhatsApp and in the app'), findsOneWidget);
    await finish(tester);
  });

  testWidgets('regulars vote early, and a late drop-out starts the next poll behind', (tester) async {
    await start(tester);
    await signIn(tester);
    final api = backend.services.api;

    // A 15-minute head start: the poll opens in a minute, so the regulars can vote now.
    await api.updateGroupSettings(demoGroupId, {
      'rules': {'regularsHeadStartMinutes': 15},
    });
    await tester.pump();
    expect(find.textContaining("Regulars' head start"), findsWidgets);
    await wait(tester, 6);
    await tester.tap(find.text("I'M IN"));
    await tester.pump();
    expect(find.text("You're in · #7 of 18"), findsOneWidget);

    // Dropping out of a game two hours away is late, so the next poll starts behind everyone.
    PollDraft draft(int hours) => PollDraft(
        kickoffAt: backend.now().add(Duration(hours: hours)), durationMinutes: 90, venue: 'Zayed Club', squadSize: 10);
    final first = await api.createPoll(demoGroupId, draft(2));
    await api.rosterAction(demoGroupId, first, 'join');
    await api.rosterAction(demoGroupId, first, 'drop');
    final next = await api.createPoll(demoGroupId, draft(3));
    await api.rosterAction(demoGroupId, next, 'join'); // first to vote
    await wait(tester, 8);
    final line = RosterLine.from(await latest(tester, backend.services.repo.entries(demoGroupId, next)), 10);
    expect(line.reserves.last.memberId, 'm00');
    expect(line.reserves.last.startedAsReserve, isTrue);
    // The second poll in the switcher (the chips scroll sideways).
    await tester.drag(find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.right),
        const Offset(-300, 0));
    await tester.pump();
    await tester.tap(find.byType(ChoiceChip).at(1));
    await tester.pump();
    expect(find.text('Reserve #3'), findsOneWidget);
    expect(find.textContaining('You dropped out late last time'), findsOneWidget);
    await finish(tester);
  });

  testWidgets('leaving needs another organizer; deleting the account erases your name', (tester) async {
    await start(tester);
    await signIn(tester);
    await tester.tap(find.text('Group'));
    await tester.pump();
    await tapText(tester, 'Leave this group');
    await navigate(tester);
    await tester.tap(find.text('Leave the group'));
    await tester.pump();
    expect(find.text('Make someone else an organizer first.'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));

    // As a regular player, deleting works: name and number go, and you're signed out.
    backend.setOrganizer(false);
    await tester.pump();
    await tapText(tester, 'Delete my account and data');
    await navigate(tester);
    await tester.tap(find.text('Delete everything'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.textContaining('any mobile number works'), findsOneWidget);
    final members = await latest(tester, backend.services.repo.members(demoGroupId));
    expect(members.where((m) => m.name == 'Ahmed S.'), isEmpty);

    // Signing in again starts a fresh demo week.
    await signIn(tester);
    expect(find.textContaining('Night Football'), findsWidgets);
    await finish(tester);
  });
}
