import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';
import 'firebase_options.dart';
import 'services/api.dart';
import 'services/auth.dart';
import 'services/photos.dart';
import 'services/push.dart';
import 'services/repo.dart';
import 'services/services.dart';

const _useEmulators = bool.fromEnvironment('USE_EMULATORS');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  registerFontLicenses();
  await initializeDateFormatting();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  final auth = FirebaseAuth.instance;
  final db = FirebaseFirestore.instance;
  final functions = FirebaseFunctions.instanceFor(region: functionsRegion);
  final storage = FirebaseStorage.instance;

  if (_useEmulators || DefaultFirebaseOptions.isDemo) {
    // `firebase emulators:start` in tashkeela/ (see README).
    final host = defaultTargetPlatform == TargetPlatform.android && !kIsWeb ? '10.0.2.2' : 'localhost';
    await auth.useAuthEmulator(host, 9099);
    db.useFirestoreEmulator(host, 8080);
    functions.useFunctionsEmulator(host, 5001);
    await storage.useStorageEmulator(host, 9199);
  }

  runApp(TashkeelaApp(
    services: Services(
      auth: FirebaseAuthService(auth),
      api: FirebaseApi(functions),
      repo: FirestoreRepo(db),
      push: FirebasePushService(FirebaseMessaging.instance, db),
      photos: FirebasePhotoStore(storage),
    ),
  ));
}

