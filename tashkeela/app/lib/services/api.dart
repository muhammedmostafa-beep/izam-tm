// Every change goes through Cloud Functions; the app never writes the list.

import 'package:cloud_functions/cloud_functions.dart';

import '../models.dart';

/// Must match `setGlobalOptions({ region })` in functions/src/index.ts.
const functionsRegion = 'europe-west1';

class ApiException implements Exception {
  ApiException(this.code, [this.message]);

  /// One of the codes in functions/src/core/errors.ts, or null if unknown.
  final String? code;
  final String? message;

  @override
  String toString() => 'ApiException($code, $message)';
}

abstract interface class Api {
  Future<List<String>> claimMemberships();

  Future<String> createGroup(
      {required String name, required String venue, required String organizerName, required String language});

  Future<void> updateGroupSettings(String groupId, Map<String, dynamic> patch);

  Future<void> addMember(String groupId,
      {required String name, required String phone, bool isGoalkeeper = false, String language = 'ar'});

  Future<void> updateMember(String groupId, String memberId, {String? name, String? role, bool? isGoalkeeper});

  Future<void> removeMember(String groupId, String memberId);

  Future<void> updateMyPreferences(String groupId, {bool? whatsappOptIn, String? language});

  /// action: join, drop, confirm or pass. Returns the new state and place in line.
  Future<({String? state, int? position})> rosterAction(String groupId, String gameId, String action);

  /// Organizer only. action: join (add someone) or remove.
  Future<void> adminRosterAction(String groupId, String gameId, String memberId, String action);

  Future<void> openPollNow(String groupId, String gameId);

  Future<void> recordResult(String groupId, String gameId, {required String winner, String? photoPath});

  /// Organizer only. A poll of its own: when, where, how many, and when voting opens (null: now).
  Future<String> createPoll(String groupId, PollDraft poll);

  /// Organizer only. Changes a poll that hasn't been played yet.
  Future<void> updatePoll(String groupId, String gameId, PollDraft poll);

  /// Organizer only. Calls the game off and tells everyone on its list.
  Future<void> cancelPoll(String groupId, String gameId);

  /// Organizer only. 0 (new / not sure) to 4; see levels.dart.
  Future<void> setMemberLevel(String groupId, String memberId, int level);

  /// Organizer only. Saves the game's teams, or clears them with null.
  Future<void> saveTeams(String groupId, String gameId, List<Team>? teams);
}

/// What the organizer fills in for a poll.
class PollDraft {
  const PollDraft({
    required this.kickoffAt,
    required this.durationMinutes,
    required this.venue,
    required this.squadSize,
    this.pollOpensAt,
  });

  final DateTime kickoffAt;
  final int durationMinutes;
  final String venue;
  final int squadSize;

  /// Null: voting opens right away.
  final DateTime? pollOpensAt;

  Map<String, Object?> toMap() => {
        'kickoffAt': kickoffAt.millisecondsSinceEpoch,
        'durationMinutes': durationMinutes,
        'venue': venue,
        'squadSize': squadSize,
        'pollOpensAt': pollOpensAt?.millisecondsSinceEpoch,
      };
}

class FirebaseApi implements Api {
  FirebaseApi(this._functions);

  final FirebaseFunctions _functions;

  Future<Map<String, dynamic>> _call(String name, [Map<String, dynamic>? data]) async {
    try {
      final result = await _functions.httpsCallable(name).call<Object?>(data);
      final value = result.data;
      return value is Map ? Map<String, dynamic>.from(value) : const {};
    } on FirebaseFunctionsException catch (e) {
      final details = e.details;
      final code = details is Map ? details['code'] as String? : null;
      throw ApiException(code ?? (e.code == 'unauthenticated' ? 'unauthenticated' : null), e.message);
    }
  }

  @override
  Future<List<String>> claimMemberships() async =>
      ((await _call('claimMemberships'))['groupIds'] as List?)?.cast<String>() ?? const [];

  @override
  Future<String> createGroup(
          {required String name, required String venue, required String organizerName, required String language}) async =>
      (await _call('createGroup', {'name': name, 'venue': venue, 'organizerName': organizerName, 'language': language}))[
          'groupId'] as String;

  @override
  Future<void> updateGroupSettings(String groupId, Map<String, dynamic> patch) =>
      _call('updateGroupSettings', {'groupId': groupId, 'patch': patch});

  @override
  Future<void> addMember(String groupId,
          {required String name, required String phone, bool isGoalkeeper = false, String language = 'ar'}) =>
      _call('addMember', {
        'groupId': groupId,
        'name': name,
        'phone': phone,
        'isGoalkeeper': isGoalkeeper,
        'language': language,
      });

  @override
  Future<void> updateMember(String groupId, String memberId, {String? name, String? role, bool? isGoalkeeper}) =>
      _call('updateMember', {
        'groupId': groupId,
        'memberId': memberId,
        'name': ?name,
        'role': ?role,
        'isGoalkeeper': ?isGoalkeeper,
      });

  @override
  Future<void> removeMember(String groupId, String memberId) =>
      _call('removeMember', {'groupId': groupId, 'memberId': memberId});

  @override
  Future<void> updateMyPreferences(String groupId, {bool? whatsappOptIn, String? language}) =>
      _call('updateMyPreferences', {
        'groupId': groupId,
        'whatsappOptIn': ?whatsappOptIn,
        'language': ?language,
      });

  @override
  Future<({String? state, int? position})> rosterAction(String groupId, String gameId, String action) async {
    final r = await _call('rosterAction', {'groupId': groupId, 'gameId': gameId, 'action': action});
    return (state: r['state'] as String?, position: r['position'] as int?);
  }

  @override
  Future<void> adminRosterAction(String groupId, String gameId, String memberId, String action) =>
      _call('adminRosterAction', {'groupId': groupId, 'gameId': gameId, 'memberId': memberId, 'action': action});

  @override
  Future<void> openPollNow(String groupId, String gameId) => _call('openPollNow', {'groupId': groupId, 'gameId': gameId});

  @override
  Future<void> recordResult(String groupId, String gameId, {required String winner, String? photoPath}) =>
      _call('recordResult', {'groupId': groupId, 'gameId': gameId, 'winner': winner, 'photoPath': photoPath});

  @override
  Future<String> createPoll(String groupId, PollDraft poll) async =>
      (await _call('createPoll', {'groupId': groupId, ...poll.toMap()}))['gameId'] as String;

  @override
  Future<void> updatePoll(String groupId, String gameId, PollDraft poll) =>
      _call('updatePoll', {'groupId': groupId, 'gameId': gameId, ...poll.toMap()});

  @override
  Future<void> cancelPoll(String groupId, String gameId) => _call('cancelPoll', {'groupId': groupId, 'gameId': gameId});

  @override
  Future<void> setMemberLevel(String groupId, String memberId, int level) =>
      _call('setMemberLevel', {'groupId': groupId, 'memberId': memberId, 'level': level});

  @override
  Future<void> saveTeams(String groupId, String gameId, List<Team>? teams) => _call('saveTeams', {
        'groupId': groupId,
        'gameId': gameId,
        'teams': teams?.map((t) => t.toMap()).toList(),
      });
}
