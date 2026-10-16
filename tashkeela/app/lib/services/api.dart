// Every change goes through Cloud Functions; the app never writes the list.

import 'package:cloud_functions/cloud_functions.dart';

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

  Future<void> openPollNow(String groupId);

  Future<void> recordResult(String groupId, String gameId, {required String winner, String? photoPath});
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
  Future<void> openPollNow(String groupId) => _call('openPollNow', {'groupId': groupId});

  @override
  Future<void> recordResult(String groupId, String gameId, {required String winner, String? photoPath}) =>
      _call('recordResult', {'groupId': groupId, 'gameId': gameId, 'winner': winner, 'photoPath': photoPath});
}
