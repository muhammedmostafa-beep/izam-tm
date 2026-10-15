// The line as players see it. The server decides every state; this only
// orders the entries the same way (by sequence number) to show places.

import 'models.dart';

enum MyStatusKind { notIn, squad, offered, reserve, out }

class MyStatus {
  const MyStatus(this.kind, {this.position, this.reserveNumber, this.offerExpiresAt, this.outReason});

  final MyStatusKind kind;

  /// 1-based place in the squad (for [MyStatusKind.squad] and [MyStatusKind.offered]).
  final int? position;

  /// 1-based place in the reserve queue (for [MyStatusKind.reserve]).
  final int? reserveNumber;
  final DateTime? offerExpiresAt;
  final String? outReason;
}

class RosterLine {
  RosterLine._(this.squad, this.reserves, this.out, this.squadSize);

  factory RosterLine.from(Iterable<Entry> entries, int squadSize) {
    final active = entries.where((e) => e.active).toList()..sort((a, b) => a.seq.compareTo(b.seq));
    final out = entries.where((e) => !e.active).toList()..sort((a, b) => a.seq.compareTo(b.seq));
    final cut = active.length < squadSize ? active.length : squadSize;
    return RosterLine._(active.sublist(0, cut), active.sublist(cut), out, squadSize);
  }

  final List<Entry> squad;
  final List<Entry> reserves;
  final List<Entry> out;
  final int squadSize;

  int get openSpots => squadSize - squad.length;

  /// The reserve who would be offered the next free spot.
  Entry? get nextReserve => reserves.isEmpty ? null : reserves.first;

  Entry? get pendingOffer {
    for (final e in squad) {
      if (e.state == EntryState.offered) return e;
    }
    return null;
  }

  MyStatus statusOf(String? memberId) {
    if (memberId == null) return const MyStatus(MyStatusKind.notIn);
    final s = squad.indexWhere((e) => e.memberId == memberId);
    if (s >= 0) {
      final e = squad[s];
      return e.state == EntryState.offered
          ? MyStatus(MyStatusKind.offered, position: s + 1, offerExpiresAt: e.offerExpiresAt)
          : MyStatus(MyStatusKind.squad, position: s + 1);
    }
    final r = reserves.indexWhere((e) => e.memberId == memberId);
    if (r >= 0) return MyStatus(MyStatusKind.reserve, reserveNumber: r + 1);
    for (final e in out) {
      if (e.memberId == memberId) return MyStatus(MyStatusKind.out, outReason: e.outReason);
    }
    return const MyStatus(MyStatusKind.notIn);
  }
}
