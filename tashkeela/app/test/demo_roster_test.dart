// The demo build's copy of the server's list rules must behave like the server
// (functions/test/roster.test.ts).

import 'package:flutter_test/flutter_test.dart';
import 'package:tashkeela/demo/roster.dart' as roster;
import 'package:tashkeela/models.dart';

const rules = Rules(
  squadSize: 3,
  teamNames: ['Lime', 'Orange'],
  confirmWindowMinutes: 120,
  matchDayConfirmWindowMinutes: 30,
  lateDropOutHours: 24,
  quietHours: QuietHours('00:00', '08:00'),
);

final kickoff = DateTime(2026, 10, 22, 21);

roster.RosterContext at(DateTime now) => roster.RosterContext(now: now, kickoffAt: kickoff, rules: rules);

/// Players p1..pN join in order on Sunday at noon.
List<Entry> line(int n) {
  var entries = <Entry>[];
  for (var i = 1; i <= n; i++) {
    entries = roster
        .join(entries, memberId: 'p$i', name: 'P$i', seq: i, source: 'app', ctx: at(DateTime(2026, 10, 18, 12)))
        .entries;
  }
  return entries;
}

EntryState stateOf(List<Entry> entries, String id) => entries.firstWhere((e) => e.memberId == id).state;

void main() {
  test('the first squadSize players are in; the rest wait in order', () {
    final entries = line(5);
    expect([for (final id in ['p1', 'p2', 'p3', 'p4', 'p5']) stateOf(entries, id)],
        [EntryState.confirmed, EntryState.confirmed, EntryState.confirmed, EntryState.waiting, EntryState.waiting]);
    expect(() => roster.join(entries, memberId: 'p1', name: 'P1', seq: 6, source: 'app', ctx: at(DateTime(2026, 10, 18, 13))),
        throwsA(isA<roster.RosterError>().having((e) => e.code, 'code', 'already_in')));
  });

  test('a drop-out offers the spot to the first reserve, who can pass it on or confirm', () {
    final monday = DateTime(2026, 10, 19, 10);
    final dropped = roster.dropOut(line(5), 'p2', at(monday));
    expect(stateOf(dropped.entries, 'p4'), EntryState.offered);
    expect(dropped.entries.firstWhere((e) => e.memberId == 'p4').offerExpiresAt, monday.add(const Duration(hours: 2)));
    expect(dropped.events.map((e) => e.type), ['dropped', 'offered']);
    expect(dropped.events.first.late, isFalse);

    final passed = roster.pass(dropped.entries, 'p4', at(monday.add(const Duration(minutes: 5))));
    expect(stateOf(passed.entries, 'p4'), EntryState.out);
    expect(stateOf(passed.entries, 'p5'), EntryState.offered);

    final confirmed = roster.confirm(passed.entries, 'p5', at(monday.add(const Duration(minutes: 9))));
    expect(stateOf(confirmed.entries, 'p5'), EntryState.confirmed);
    expect(() => roster.confirm(confirmed.entries, 'p4', at(monday)),
        throwsA(isA<roster.RosterError>().having((e) => e.code, 'code', 'no_offer')));
  });

  test('dropping out within a day of kick-off is late, and match-day offers are shorter', () {
    final matchDay = DateTime(2026, 10, 22, 17);
    final r = roster.dropOut(line(4), 'p1', at(matchDay));
    expect(r.events.first.late, isTrue);
    expect(r.entries.firstWhere((e) => e.memberId == 'p4').offerExpiresAt, matchDay.add(const Duration(minutes: 30)));
  });

  test('offer deadlines skip quiet hours and never pass kick-off', () {
    final lateNight = DateTime(2026, 10, 19, 23, 30);
    expect(roster.offerExpiry(at(lateNight)), DateTime(2026, 10, 20, 9, 30));
    final justBefore = DateTime(2026, 10, 22, 20, 50);
    expect(roster.offerExpiry(at(justBefore)), kickoff);
  });

  test('offers that run out move on to the next reserve', () {
    final monday = DateTime(2026, 10, 19, 10);
    final dropped = roster.dropOut(line(5), 'p1', at(monday));
    final expired = roster.expireOffers(dropped.entries, at(monday.add(const Duration(hours: 3))));
    expect(stateOf(expired.entries, 'p4'), EntryState.out);
    expect(expired.entries.firstWhere((e) => e.memberId == 'p4').outReason, 'expired');
    expect(stateOf(expired.entries, 'p5'), EntryState.offered);
  });
}
