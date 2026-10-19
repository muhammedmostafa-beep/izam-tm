import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:tashkeela/group_post.dart';
import 'package:tashkeela/l10n.dart';
import 'package:tashkeela/models.dart';
import 'package:tashkeela/roster_line.dart';
import 'package:tashkeela/phone.dart';

import 'fixtures.dart';

void main() {
  setUpAll(() => initializeDateFormatting());

  group('RosterLine', () {
    test('splits the line into squad and reserves by sequence number', () {
      final line = RosterLine.from(line20().reversed, 18);
      expect(line.squad.map((e) => e.seq), List.generate(18, (i) => i + 1));
      expect(line.reserves.map((e) => e.memberId), ['m19', 'm20']);
      expect(line.openSpots, 0);
      expect(line.nextReserve?.memberId, 'm19');
    });

    test('reports each player\'s place', () {
      final expires = DateTime(2026, 10, 19, 15);
      final entries = line20({
        5: entry(5, state: EntryState.out, outReason: 'dropped'),
        19: entry(19, state: EntryState.offered, offerExpiresAt: expires),
      });
      final line = RosterLine.from(entries, 18);
      expect(line.statusOf('m1').kind, MyStatusKind.squad);
      expect(line.statusOf('m1').position, 1);
      expect(line.statusOf('m19').kind, MyStatusKind.offered);
      expect(line.statusOf('m19').position, 18);
      expect(line.statusOf('m19').offerExpiresAt, expires);
      expect(line.statusOf('m20').kind, MyStatusKind.reserve);
      expect(line.statusOf('m20').reserveNumber, 1);
      expect(line.statusOf('m5').kind, MyStatusKind.out);
      expect(line.statusOf('m5').outReason, 'dropped');
      expect(line.statusOf('nobody').kind, MyStatusKind.notIn);
      expect(line.statusOf(null).kind, MyStatusKind.notIn);
      expect(line.pendingOffer?.memberId, 'm19');
    });

    test('counts open spots while the poll fills', () {
      final line = RosterLine.from(line20().take(12), 18);
      expect(line.squad.length, 12);
      expect(line.openSpots, 6);
      expect(line.reserves, isEmpty);
    });
  });

  group('group post', () {
    final members = {for (final m in [member(3, goalkeeper: true)]) m.id: m};

    test('lists the squad and reserves in English', () {
      final entries = line20({18: entry(18, state: EntryState.offered)});
      final text = squadPost(
        s: const S('en'),
        group: tnf,
        game: game(),
        line: RosterLine.from(entries, 18),
        members: members,
        link: 'https://tashkeela.app/g/tnf',
      );
      expect(text, startsWith('Thursday Night Football, week 12\n'));
      expect(text, contains('Squad (18/18)'));
      expect(text, contains('3. Player 3 (GK)'));
      expect(text, contains('18. Player 18 (confirming)'));
      expect(text, contains('Reserves\nR1. Player 19\nR2. Player 20'));
      expect(text, endsWith('Join, drop out or confirm: https://tashkeela.app/g/tnf'));
    });

    test('writes Arabic with Arabic digits and says how many spots are left', () {
      final text = squadPost(
        s: const S('ar'),
        group: tnf,
        game: game(),
        line: RosterLine.from(line20().take(15), 18),
        members: members,
      );
      expect(text, contains('التشكيلة (١٥/١٨)'));
      expect(text, contains('٣. Player 3 (حارس)'));
      expect(text, contains('فاضل ٣ مكان'));
      expect(text, isNot(contains('الاحتياطي')));
    });

    test('captions the champions', () {
      expect(championsRing(week: 12, winner: 'Lime'), 'CHAMPIONS · WEEK 12 · TEAM LIME');
      expect(championsCaption(s: const S('en'), group: tnf, week: 12, winner: 'Lime'),
          'Champions of week 12: Team Lime. Thursday Night Football');
    });
  });

  group('language', () {
    test('formats countdowns', () {
      const en = S('en');
      expect(en.countdown(const Duration(days: 2, hours: 6, minutes: 3)), '2d 06h');
      expect(en.countdown(const Duration(hours: 1, minutes: 58, seconds: 41)), '1h 58m');
      expect(en.countdown(const Duration(minutes: 4, seconds: 9)), '4m 09s');
      expect(en.countdown(const Duration(seconds: -5)), '0m 00s');
      expect(const S('ar').countdown(const Duration(minutes: 4, seconds: 9)), '٤ د ٠٩ ث');
    });

    test('explains server error codes', () {
      const en = S('en');
      expect(en.error('already_in'), "You're already on the list.");
      expect(en.error('game_started'), en.error('game_closed'));
      expect(en.error('something_new'), 'Something went wrong. Try again.');
      expect(const S('ar').error('poll_not_open'), 'التصويت لسه ما فتحش.');
    });

    test('names weekdays from ISO numbers', () {
      expect(const S('en').weekday(4), 'Thursday');
      expect(const S('en').weekday(7), 'Sunday');
      expect(const S('ar').weekday(5), 'الجمعة');
    });
  });

  test('normalizes phone numbers the way people type them', () {
    expect(toE164('010 0123 4567'), '+201001234567');
    expect(toE164('+20 100-123-4567'), '+201001234567');
    expect(toE164('00201001234567'), '+201001234567');
    expect(toE164('12'), isNull);
  });
}
