import 'package:flutter_test/flutter_test.dart';
import 'package:tashkeela/teams.dart';

/// 18 players: 3 goalkeepers, and a spread of levels like a real group.
final squad = [
  for (var i = 0; i < 18; i++)
    TeamPlayer(memberId: 'p$i', level: const [1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 0, 0, 0, 2][i], isGoalkeeper: i >= 15),
];
final levelsById = {for (final p in squad) p.memberId: p.level};

void main() {
  test('makes teams of equal size, one goalkeeper each', () {
    final teams = balanceTeams(squad, 3);
    expect(teams.map((t) => t.length), [6, 6, 6]);
    for (final t in teams) {
      expect(t.where((id) => squad.firstWhere((p) => p.memberId == id).isGoalkeeper).length, 1);
    }
    expect(teams.expand((t) => t).toSet().length, 18);
  });

  test('keeps the teams close in strength, with any seed', () {
    for (var seed = 0; seed < 20; seed++) {
      final ratings = balanceTeams(squad, 3, seed: seed).map((t) => teamRating(t, levelsById)).toList()..sort();
      expect(ratings.last - ratings.first, lessThanOrEqualTo(8), reason: 'seed $seed: $ratings');
    }
  });

  test('spreads new players and gives sizes that differ by one at most', () {
    final teams = balanceTeams(squad.take(17).toList(), 4);
    final sizes = teams.map((t) => t.length).toList()..sort();
    expect(sizes, [4, 4, 4, 5]);
    final newcomers = {for (final p in squad.take(17)) if (p.level == 0) p.memberId};
    for (final t in teams) {
      expect(t.where(newcomers.contains).length, lessThanOrEqualTo(1));
    }
  });

  test('shuffling gives another split', () {
    final splits = {for (var seed = 0; seed < 5; seed++) balanceTeams(squad, 3, seed: seed).map((t) => (t..sort()).join(',')).join('|')};
    expect(splits.length, greaterThan(1));
  });

  test('after a drop-out, the replacement fills the gap without moving anyone else', () {
    final teams = balanceTeams(squad, 3);
    final dropped = teams[1].first;
    final newSquad = [...squad.where((p) => p.memberId != dropped), const TeamPlayer(memberId: 'sub', level: 2)];
    final next = fillGaps(teams, newSquad);
    expect(next[1], contains('sub'));
    expect(next[1], isNot(contains(dropped)));
    expect(next[0], teams[0]);
    expect(next[2], teams[2]);
  });
}
