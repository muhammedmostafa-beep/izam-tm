// Live, read-only streams of what the server writes.

import 'package:cloud_firestore/cloud_firestore.dart';

import '../models.dart';

abstract interface class Repo {
  Stream<List<String>> groupIdsOf(String uid);

  Stream<Group?> group(String id);

  /// Active members, by name.
  Stream<List<Member>> members(String groupId);

  Stream<Game?> game(String groupId, String gameId);

  Stream<List<Entry>> entries(String groupId, String gameId);

  /// Newest first.
  Stream<List<LogItem>> log(String groupId, String gameId, {int limit = 8});

  /// The latest game that has already kicked off (to record its result).
  Future<Game?> lastPlayedGame(String groupId);
}

class FirestoreRepo implements Repo {
  FirestoreRepo(this._db);

  final FirebaseFirestore _db;

  DocumentReference<Map<String, dynamic>> _group(String id) => _db.collection('groups').doc(id);

  @override
  Stream<List<String>> groupIdsOf(String uid) => _db
      .collection('users')
      .doc(uid)
      .snapshots()
      .map((d) => (d.data()?['groupIds'] as List?)?.cast<String>() ?? const <String>[]);

  @override
  Stream<Group?> group(String id) => _group(id).snapshots().map((d) => d.exists ? Group.fromDoc(d) : null);

  @override
  Stream<List<Member>> members(String groupId) => _group(groupId)
      .collection('members')
      .where('active', isEqualTo: true)
      .snapshots()
      .map((q) => q.docs.map(Member.fromDoc).toList()..sort((a, b) => a.name.compareTo(b.name)));

  @override
  Stream<Game?> game(String groupId, String gameId) =>
      _group(groupId).collection('games').doc(gameId).snapshots().map((d) => d.exists ? Game.fromDoc(d) : null);

  @override
  Stream<List<Entry>> entries(String groupId, String gameId) =>
      _group(groupId).collection('games').doc(gameId).collection('entries').snapshots().map(
            (q) => q.docs.map(Entry.fromDoc).toList(),
          );

  @override
  Stream<List<LogItem>> log(String groupId, String gameId, {int limit = 8}) => _group(groupId)
      .collection('games')
      .doc(gameId)
      .collection('log')
      .orderBy('at', descending: true)
      .limit(limit)
      .snapshots()
      .map((q) => q.docs.map(LogItem.fromDoc).toList());

  @override
  Future<Game?> lastPlayedGame(String groupId) async {
    final q = await _group(groupId)
        .collection('games')
        .where('kickoffAt', isLessThanOrEqualTo: Timestamp.now())
        .orderBy('kickoffAt', descending: true)
        .limit(1)
        .get();
    return q.docs.isEmpty ? null : Game.fromDoc(q.docs.first);
  }
}
