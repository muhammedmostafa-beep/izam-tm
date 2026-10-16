// Push notifications: keep this app installation's ID (FID) on users/{uid}
// so the server can reach it, and show messages that arrive while the app is open.

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Web push key from Firebase console > Cloud Messaging > Web Push certificates.
const _vapidKey = String.fromEnvironment('FIREBASE_VAPID_KEY');

/// A notification that arrived while the app is open.
class PushMessage {
  const PushMessage({this.title, this.body});
  final String? title;
  final String? body;
}

abstract interface class PushService {
  /// Notifications arriving while the app is open, to show in the app.
  Stream<PushMessage> get messages;

  Future<void> register(String uid);

  /// On sign-out, stop this device getting the previous player's messages.
  Future<void> unregister(String uid);
}

class FirebasePushService implements PushService {
  FirebasePushService(this._messaging, this._db);

  final FirebaseMessaging _messaging;
  final FirebaseFirestore _db;
  StreamSubscription<String>? _registered;
  String? _id;

  @override
  Stream<PushMessage> get messages => FirebaseMessaging.onMessage
      .where((m) => m.notification != null)
      .map((m) => PushMessage(title: m.notification!.title, body: m.notification!.body));

  @override
  Future<void> register(String uid) async {
    try {
      if (kIsWeb && _vapidKey.isEmpty) return;
      final settings = await _messaging.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;
      await _registered?.cancel();
      _registered = _messaging.onRegistered.listen((id) {
        _id = id;
        _db.collection('users').doc(uid).set({
          'pushIds': FieldValue.arrayUnion([id]),
        }, SetOptions(merge: true));
      });
      await _messaging.register(vapidKey: kIsWeb ? _vapidKey : null);
    } catch (e) {
      // Push is a nice-to-have; WhatsApp and the live list still work without it.
      debugPrint('push registration failed: $e');
    }
  }

  @override
  Future<void> unregister(String uid) async {
    await _registered?.cancel();
    _registered = null;
    final id = _id;
    try {
      if (id != null) {
        await _db.collection('users').doc(uid).update({
          'pushIds': FieldValue.arrayRemove([id]),
        });
      }
      await _messaging.unregister();
    } catch (e) {
      debugPrint('push unregister failed: $e');
    }
  }
}
