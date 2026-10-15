// Firebase settings for this build.
//
// Either run `flutterfire configure` (it overwrites this file with your
// project's values), or pass them at build time:
//   flutter run --dart-define-from-file=config/firebase.json
// With no values the app talks to the local emulators (project demo-tashkeela).

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class DefaultFirebaseOptions {
  static const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID', defaultValue: 'demo-tashkeela');
  static const _apiKey = String.fromEnvironment('FIREBASE_API_KEY', defaultValue: 'demo-api-key');
  static const _senderId = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID', defaultValue: '000000000000');
  static const _androidAppId =
      String.fromEnvironment('FIREBASE_ANDROID_APP_ID', defaultValue: '1:000000000000:android:0000000000000000');
  static const _webAppId = String.fromEnvironment('FIREBASE_WEB_APP_ID', defaultValue: '1:000000000000:web:0000000000000000');

  /// True when no real project is configured: use the local emulators.
  static bool get isDemo => _projectId.startsWith('demo-');

  static FirebaseOptions get currentPlatform => FirebaseOptions(
        apiKey: _apiKey,
        appId: kIsWeb ? _webAppId : _androidAppId,
        messagingSenderId: _senderId,
        projectId: _projectId,
        authDomain: '$_projectId.firebaseapp.com',
        storageBucket: '$_projectId.firebasestorage.app',
      );
}
