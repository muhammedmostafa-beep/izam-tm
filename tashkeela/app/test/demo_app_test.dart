// The demo build end to end: sign in, race the scripted players, watch a
// drop-out go down the reserve list, take an offer, record the winners.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:tashkeela/app.dart';
import 'package:tashkeela/demo/demo_backend.dart';
import 'package:tashkeela/models.dart';

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

Future<void> tapText(WidgetTester tester, String text) async {
  final target = find.text(text);
  await tester.scrollUntilVisible(target, 200, scrollable: find.byType(Scrollable).first);
  await tester.tap(target);
  await tester.pump();
}

void main() {
  setUpAll(initializeDateFormatting);

  late DemoBackend backend;

  Future<void> start(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.6;
    addTearDown(tester.view.reset);
    // The screens read the real clock, so the demo runs on real time plus the test's fake time.
    final realStart = DateTime.now();
    final fakeStart = tester.binding.clock.now();
    backend = DemoBackend(clock: () => realStart.add(tester.binding.clock.now().difference(fakeStart)), language: 'en');
    await tester.pumpWidget(TashkeelaApp(services: backend.services));
    await tester.pump();
  }

  Future<void> finish(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox());
    backend.dispose();
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
}
