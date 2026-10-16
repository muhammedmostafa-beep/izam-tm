// Balanced teams from the squad: goalkeepers spread out first, then the
// strongest players go one by one to the team that is weakest so far. New
// players (level 0) are spread evenly too. Team sizes differ by one at most.
// The organizer can shuffle (another seed) or move players by hand after.

import 'dart:math';

import 'levels.dart';

class TeamPlayer {
  const TeamPlayer({required this.memberId, required this.level, this.isGoalkeeper = false});
  final String memberId;

  /// 0 to 4, see levels.dart.
  final int level;
  final bool isGoalkeeper;

  int get strength => levelStrength(level);
}

/// Splits [players] into [teamCount] teams of member ids. A different [seed]
/// gives a different, equally balanced split.
List<List<String>> balanceTeams(List<TeamPlayer> players, int teamCount, {int seed = 0}) {
  assert(teamCount >= 2);
  final rng = Random(seed);
  final teams = List.generate(teamCount, (_) => <TeamPlayer>[]);
  final base = players.length ~/ teamCount;
  final bigger = players.length % teamCount;

  bool hasRoom(List<TeamPlayer> t) {
    if (t.length < base) return true;
    if (t.length > base) return false;
    return teams.where((x) => x.length > base).length < bigger;
  }

  int strength(List<TeamPlayer> t) => t.fold(0, (sum, p) => sum + p.strength);

  /// The team that most needs the next player, by [key] then strength, size and chance.
  void place(TeamPlayer p, int Function(List<TeamPlayer>) key) {
    final open = teams.where(hasRoom).toList()..shuffle(rng);
    open.sort((a, b) {
      final k = key(a).compareTo(key(b));
      if (k != 0) return k;
      final s = strength(a).compareTo(strength(b));
      return s != 0 ? s : a.length.compareTo(b.length);
    });
    open.first.add(p);
  }

  // Shuffle first so players of the same level land differently with each seed.
  final order = [...players]..shuffle(rng);
  final keepers = order.where((p) => p.isGoalkeeper).toList()..sort((a, b) => b.strength.compareTo(a.strength));
  final known = order.where((p) => !p.isGoalkeeper && p.level != 0).toList()..sort((a, b) => b.strength.compareTo(a.strength));
  final newcomers = order.where((p) => !p.isGoalkeeper && p.level == 0);

  for (final p in keepers) {
    place(p, (t) => t.where((x) => x.isGoalkeeper).length);
  }
  for (final p in known) {
    place(p, (_) => 0);
  }
  for (final p in newcomers) {
    place(p, (t) => t.where((x) => x.level == 0).length);
  }
  return [for (final t in teams) t.map((p) => p.memberId).toList()];
}

/// After the list changed: takes off players no longer in the squad and puts
/// newcomers on the teams that need them most, without reshuffling anyone else.
List<List<String>> fillGaps(List<List<String>> teams, List<TeamPlayer> squad) {
  final byId = {for (final p in squad) p.memberId: p};
  final next = [for (final t in teams) t.where(byId.containsKey).toList()];
  final placed = next.expand((t) => t).toSet();
  final missing = squad.where((p) => !placed.contains(p.memberId)).toList()..sort((a, b) => b.strength.compareTo(a.strength));
  int strength(List<String> t) => t.fold(0, (sum, id) => sum + byId[id]!.strength);
  for (final p in missing) {
    final target = [...next]..sort((a, b) {
        final size = a.length.compareTo(b.length);
        return size != 0 ? size : strength(a).compareTo(strength(b));
      });
    target.first.add(p.memberId);
  }
  return next;
}

/// A team's average strength as a percentage (100 = all top players).
int teamRating(List<String> team, Map<String, int> levelsById) {
  if (team.isEmpty) return 0;
  final total = team.fold(0, (sum, id) => sum + levelStrength(levelsById[id] ?? 0));
  return (total / team.length).round();
}
