// Live, read-only streams of what the server writes.

import 'package:cloud_firestore/cloud_firestore.dart';

import '../models.dart';

class Repo {
  Repo(this._db);

  final FirebaseFirestore _db;

  DocumentReference<Map<String, dynamic>> _group(String id) => _db.collection('groups').doc(id);

  Stream<List<String>> groupIdsOf(String uid) => _db
      .collection('users')
      .doc(uid)
      .snapshots()
      .map((d) => (d.data()?['groupIds'] as List?)?.cast<String>() ?? const <String>[]);

  Stream<Group?> group(String id) => _group(id).snapshots().map((d) => d.exists ? Group.fromDoc(d) : null);

  Stream<List<Member>> members(String groupId) => _group(groupId)
      .collection('members')
      .where('active', isEqualTo: true)
      .snapshots()
      .map((q) => q.docs.map(Member.fromDoc).toList()..sort((a, b) => a.name.compareTo(b.name)));

  Stream<Game?> game(String groupId, String gameId) =>
      _group(groupId).collection('games').doc(gameId).snapshots().map((d) => d.exists ? Game.fromDoc(d) : null);

  Stream<List<Entry>> entries(String groupId, String gameId) =>
      _group(groupId).collection('games').doc(gameId).collection('entries').snapshots().map(
            (q) => q.docs.map(Entry.fromDoc).toList(),
          );

  Stream<List<LogItem>> log(String groupId, String gameId, {int limit = 8}) => _group(groupId)
      .collection('games')
      .doc(gameId)
      .collection('log')
      .orderBy('at', descending: true)
      .limit(limit)
      .snapshots()
      .map((q) => q.docs.map(LogItem.fromDoc).toList());

  /// The latest game that has already kicked off (to record its result).
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
