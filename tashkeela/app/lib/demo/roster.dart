// The server's list rules (functions/src/domain/roster.ts), ported for the demo
// build, which has no server. Keep the two in step. Times use the phone's clock
// and time zone instead of the group's.

import '../models.dart';

class RosterError implements Exception {
  RosterError(this.code);

  /// Same codes as the server: already_in, not_in, no_offer, game_started.
  final String code;

  @override
  String toString() => 'RosterError($code)';
}

/// What changed, in the server's log vocabulary (joined, offered, confirmed, ...).
class RosterEvent {
  const RosterEvent(this.type, this.memberId,
      {this.late = false, this.wasInSquad = false, this.inSquad = false, this.position, this.expiresAt});

  final String type;
  final String memberId;
  final bool late;
  final bool wasInSquad;
  final bool inSquad;
  final int? position;
  final DateTime? expiresAt;
}

class RosterResult {
  const RosterResult(this.entries, this.events);
  final List<Entry> entries;
  final List<RosterEvent> events;
}

class RosterContext {
  const RosterContext({required this.now, required this.kickoffAt, required this.rules});
  final DateTime now;
  final DateTime kickoffAt;
  final Rules rules;
}

bool _active(Entry e) => e.state != EntryState.out;

List<Entry> _bySeq(Iterable<Entry> entries) => entries.toList()..sort((a, b) => a.seq.compareTo(b.seq));

/// The entry in a new state, with the fields of its old state cleared.
Entry _as(Entry e, EntryState state, {DateTime? offerExpiresAt, String? outReason, bool lateDropOut = false}) => Entry(
      memberId: e.memberId,
      name: e.name,
      seq: e.seq,
      joinedAt: e.joinedAt,
      state: state,
      source: e.source,
      offerExpiresAt: offerExpiresAt,
      outReason: outReason,
      lateDropOut: lateDropOut,
    );

List<Entry> _replace(List<Entry> entries, Entry entry) =>
    [for (final e in entries) e.memberId == entry.memberId ? entry : e];

Entry _find(List<Entry> entries, String memberId) {
  for (final e in entries) {
    if (e.memberId == memberId) return e;
  }
  throw RosterError('not_in');
}

bool _inSquad(List<Entry> entries, String memberId, int squadSize) =>
    _bySeq(entries.where(_active)).take(squadSize).any((e) => e.memberId == memberId);

/// Added to the sequence number of a player who starts the poll as a reserve
/// (a late drop-out last time, when the group has that rule): everyone who
/// votes normally is ahead of them, whenever they vote.
const penaltySeq = 1000000;

/// Add a player at the back of the line.
RosterResult join(List<Entry> entries, {required String memberId, required String name, required int seq,
    required String source, required RosterContext ctx}) {
  if (!ctx.now.isBefore(ctx.kickoffAt)) throw RosterError('game_started');
  final existing = entries.where((e) => e.memberId == memberId).firstOrNull;
  if (existing != null && _active(existing)) throw RosterError('already_in');
  // Usually the new entry is last in line; a penalized one (see penaltySeq) can land behind it.
  final ahead = entries.where((e) => _active(e) && e.seq < seq).length;
  final inSquad = ahead < ctx.rules.squadSize;
  final entry = Entry(
    memberId: memberId,
    name: name,
    seq: seq,
    joinedAt: ctx.now,
    state: inSquad ? EntryState.confirmed : EntryState.waiting,
    source: source,
  );
  final next = [...entries.where((e) => e.memberId != memberId), entry];
  return _settle(next, [RosterEvent('joined', memberId, position: ahead + 1, inSquad: inSquad)], ctx);
}

/// A player in the squad or the queue can't make it.
RosterResult dropOut(List<Entry> entries, String memberId, RosterContext ctx) {
  final entry = _find(entries, memberId);
  if (!_active(entry)) throw RosterError('not_in');
  if (entry.state == EntryState.offered) return pass(entries, memberId, ctx);
  final inSquad = _inSquad(entries, memberId, ctx.rules.squadSize);
  final lateFrom = ctx.kickoffAt.subtract(Duration(hours: ctx.rules.lateDropOutHours));
  final late = inSquad && !ctx.now.isBefore(lateFrom);
  final next = _replace(entries, _as(entry, EntryState.out, outReason: 'dropped', lateDropOut: late));
  return _settle(next, [RosterEvent('dropped', memberId, late: late, wasInSquad: inSquad)], ctx);
}

/// The reserve accepts the spot they were offered.
RosterResult confirm(List<Entry> entries, String memberId, RosterContext ctx) {
  final entry = _find(entries, memberId);
  if (entry.state != EntryState.offered) throw RosterError('no_offer');
  if (!ctx.now.isBefore(ctx.kickoffAt)) throw RosterError('game_started');
  return _settle(_replace(entries, _as(entry, EntryState.confirmed)), [RosterEvent('confirmed', memberId)], ctx);
}

/// The reserve turns the spot down; it moves on to the next in line.
RosterResult pass(List<Entry> entries, String memberId, RosterContext ctx) {
  final entry = _find(entries, memberId);
  if (entry.state != EntryState.offered) throw RosterError('no_offer');
  final next = _replace(entries, _as(entry, EntryState.out, outReason: 'passed'));
  return _settle(next, [RosterEvent('passed', memberId)], ctx);
}

/// The organizer takes a player off the list.
RosterResult remove(List<Entry> entries, String memberId, RosterContext ctx) {
  final entry = _find(entries, memberId);
  if (!_active(entry)) throw RosterError('not_in');
  final next = _replace(entries, _as(entry, EntryState.out, outReason: 'removed'));
  return _settle(next, [RosterEvent('removed', memberId)], ctx);
}

/// Offers whose time ran out move on to the next reserve. Also re-checks the
/// line after the squad size changed.
RosterResult expireOffers(List<Entry> entries, RosterContext ctx) {
  final events = <RosterEvent>[];
  var next = entries;
  for (final e in entries) {
    final expires = e.offerExpiresAt;
    if (e.state == EntryState.offered && expires != null && !expires.isAfter(ctx.now)) {
      next = _replace(next, _as(e, EntryState.out, outReason: 'expired'));
      events.add(RosterEvent('expired', e.memberId));
    }
  }
  return _settle(next, events, ctx);
}

/// Earliest pending offer deadline.
DateTime? nextOfferExpiry(List<Entry> entries) {
  DateTime? min;
  for (final e in entries) {
    final t = e.offerExpiresAt;
    if (e.state == EntryState.offered && t != null && (min == null || t.isBefore(min))) min = t;
  }
  return min;
}

/// When a reserve offered a spot now must answer by. Quiet hours (overnight)
/// don't count, and no offer outlives kick-off.
DateTime offerExpiry(RosterContext ctx) {
  final now = ctx.now;
  final rules = ctx.rules;
  final matchDay = now.year == ctx.kickoffAt.year && now.month == ctx.kickoffAt.month && now.day == ctx.kickoffAt.day;
  var remaining = Duration(minutes: matchDay ? rules.matchDayConfirmWindowMinutes : rules.confirmWindowMinutes);
  var t = now;
  final quiet = rules.quietHours;
  if (quiet != null) {
    for (var i = 0; i < 8 && remaining > Duration.zero; i++) {
      final quietEnd = _quietEndIfInside(t, quiet);
      if (quietEnd != null) {
        t = quietEnd;
        continue;
      }
      final nextStart = _nextQuietStart(t, quiet);
      if (!t.add(remaining).isAfter(nextStart)) break;
      remaining -= nextStart.difference(t);
      t = nextStart;
    }
  }
  final deadline = t.add(remaining);
  return deadline.isBefore(ctx.kickoffAt) ? deadline : ctx.kickoffAt;
}

/// Reserves now inside the squad get an offer; anyone pushed outside it goes back to waiting.
RosterResult _settle(List<Entry> entries, List<RosterEvent> events, RosterContext ctx) {
  final gameOn = ctx.now.isBefore(ctx.kickoffAt);
  var next = entries;
  final active = _bySeq(entries.where(_active));
  for (var i = 0; i < active.length; i++) {
    final e = active[i];
    final inSquad = i < ctx.rules.squadSize;
    if (inSquad && e.state == EntryState.waiting && gameOn) {
      final expiresAt = offerExpiry(ctx);
      next = _replace(next, _as(e, EntryState.offered, offerExpiresAt: expiresAt));
      events.add(RosterEvent('offered', e.memberId, expiresAt: expiresAt));
    } else if (!inSquad && (e.state == EntryState.confirmed || e.state == EntryState.offered)) {
      if (e.state == EntryState.offered) events.add(RosterEvent('offer_withdrawn', e.memberId));
      next = _replace(next, _as(e, EntryState.waiting));
    }
  }
  return RosterResult(next, events);
}

int _minutes(String clock) {
  final p = clock.split(':');
  return int.parse(p[0]) * 60 + int.parse(p[1]);
}

DateTime _at(DateTime day, int minuteOfDay, {int addDays = 0}) =>
    DateTime(day.year, day.month, day.day + addDays, minuteOfDay ~/ 60, minuteOfDay % 60);

DateTime? _quietEndIfInside(DateTime t, QuietHours q) {
  final now = t.hour * 60 + t.minute;
  final start = _minutes(q.start);
  final end = _minutes(q.end);
  final inside = start <= end ? now >= start && now < end : now >= start || now < end;
  if (!inside) return null;
  final endToday = _at(t, end);
  return endToday.isAfter(t) ? endToday : _at(t, end, addDays: 1);
}

DateTime _nextQuietStart(DateTime t, QuietHours q) {
  final startToday = _at(t, _minutes(q.start));
  return startToday.isAfter(t) ? startToday : _at(t, _minutes(q.start), addDays: 1);
}
