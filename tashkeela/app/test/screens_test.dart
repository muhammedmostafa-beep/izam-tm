import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:tashkeela/champions_icon.dart';
import 'package:tashkeela/models.dart';
import 'package:tashkeela/screens/squad_tab.dart';
import 'package:tashkeela/screens/this_week_tab.dart';

import 'fixtures.dart';

Widget thisWeek({List<Entry>? entries, Game? currentGame, bool admin = false, String lang = 'en'}) => host(
      ThisWeekTab(
        view: view(entries: entries, currentGame: currentGame, admin: admin),
        onSwitchGroup: (_) {},
        onOpenSquad: () {},
      ),
      lang: lang,
    );

void main() {
  setUpAll(() => initializeDateFormatting());

  group('This week', () {
    testWidgets('offers the big I\'M IN button to someone not on the list', (tester) async {
      await tester.pumpWidget(thisWeek(entries: line20().where((e) => e.memberId != 'm7').toList()));
      expect(find.text("I'M IN"), findsOneWidget);
      expect(find.text('Not on the list'), findsOneWidget);
      expect(find.text('18 / 18 in'), findsOneWidget);
    });

    testWidgets('shows your place and the drop-out button when you are in', (tester) async {
      await tester.pumpWidget(thisWeek());
      expect(find.text("You're in · #7 of 18"), findsOneWidget);
      expect(find.text("Can't make it"), findsOneWidget);

      await tester.tap(find.text("Can't make it"));
      // The live countdown keeps ticking, so wait for the sheet instead of settling.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(find.text("CAN'T MAKE IT?"), findsOneWidget);
      expect(find.textContaining('Player 19 (reserve #1) will be offered your spot'), findsOneWidget);
      expect(find.text('Keep my spot'), findsOneWidget);
    });

    testWidgets('puts the offer and its deadline first for a promoted reserve', (tester) async {
      final expires = DateTime.now().add(const Duration(hours: 1, minutes: 58));
      final promoted = line20({
        5: entry(5, state: EntryState.out, outReason: 'dropped'),
        7: entry(7, state: EntryState.offered, offerExpiresAt: expires),
      });
      await tester.pumpWidget(thisWeek(entries: promoted));
      expect(find.text('A SPOT OPENED UP'), findsOneWidget);
      expect(find.text("Confirm, I'm in"), findsOneWidget);
      expect(find.textContaining('left to confirm'), findsOneWidget);
    });

    testWidgets('counts down to the poll before it opens', (tester) async {
      await tester.pumpWidget(thisWeek(entries: const [], currentGame: game(status: GameStatus.scheduled, squadCount: 0)));
      expect(find.textContaining('Poll opens'), findsOneWidget);
      expect(find.text("I'M IN"), findsNothing);
      expect(find.text('Open the poll now'), findsNothing);
    });

    testWidgets('stops counting down once the game is over', (tester) async {
      await tester.pumpWidget(thisWeek(currentGame: game(status: GameStatus.open)));
      expect(find.textContaining('Kick-off in'), findsOneWidget);
      await tester.pumpWidget(thisWeek(currentGame: game(status: GameStatus.played)));
      expect(find.text('Full time.'), findsOneWidget);
      expect(find.textContaining('Kick-off in'), findsNothing);
    });

    testWidgets('lets organizers open the poll early', (tester) async {
      await tester.pumpWidget(
          thisWeek(entries: const [], currentGame: game(status: GameStatus.scheduled, squadCount: 0), admin: true));
      expect(find.text('Open the poll now'), findsOneWidget);
    });

    testWidgets('speaks Arabic, right to left', (tester) async {
      await tester.pumpWidget(thisWeek(lang: 'ar'));
      expect(find.text('إنت جوه – رقم ٧ من ١٨'), findsOneWidget);
      expect(find.text('مش هقدر آجي'), findsOneWidget);
      expect(Directionality.of(tester.element(find.text('مش هقدر آجي'))), TextDirection.rtl);
    });
  });

  group('Squad', () {
    testWidgets('numbers the squad and the reserve queue', (tester) async {
      final entries = line20({18: entry(18, state: EntryState.offered)});
      await tester.pumpWidget(host(SquadTab(view: view(entries: entries))));
      expect(find.text('18 / 18'), findsOneWidget);
      expect(find.text('GK'), findsOneWidget);
      expect(find.text('You'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Confirming'), 300);
      expect(find.text('Confirming'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('R1'), 300);
      expect(find.text('R2'), findsOneWidget);
      expect(find.byTooltip('Organizer actions'), findsNothing);
    });

    testWidgets('gives organizers per-player actions', (tester) async {
      await tester.pumpWidget(host(SquadTab(view: view(admin: true))));
      expect(find.byTooltip('Organizer actions'), findsWidgets);
      await tester.scrollUntilVisible(find.text('Add a player to the list'), 300);
      expect(find.text('Add a player to the list'), findsOneWidget);
    });
  });

  testWidgets('frames the champions photo as a square PNG', (tester) async {
    await tester.runAsync(() async {
      final recorder = ui.PictureRecorder();
      Canvas(recorder).drawRect(const Rect.fromLTWH(0, 0, 400, 300), Paint()..color = const Color(0xFF3366FF));
      final photo = await recorder.endRecording().toImage(400, 300);
      final png = await renderChampionsIcon(photo: photo, ringText: 'CHAMPIONS · WEEK 12 · TEAM LIME', size: 256);
      expect(png.sublist(0, 4), Uint8List.fromList([0x89, 0x50, 0x4E, 0x47]));
      final decoded = await decodeImage(png);
      expect([decoded.width, decoded.height], [256, 256]);
    });
  });
}
