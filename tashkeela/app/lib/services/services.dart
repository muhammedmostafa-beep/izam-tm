import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/widgets.dart';

import 'api.dart';
import 'push.dart';
import 'repo.dart';

/// Link players use to open the web app; shown in group posts.
const appUrl = String.fromEnvironment('APP_URL');

class Services {
  const Services({required this.auth, required this.api, required this.repo, required this.push, required this.storage});

  final FirebaseAuth auth;
  final Api api;
  final Repo repo;
  final PushService push;
  final FirebaseStorage storage;
}

class ServicesScope extends InheritedWidget {
  const ServicesScope({super.key, required this.services, required super.child});

  final Services services;

  static Services of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<ServicesScope>()!.services;

  @override
  bool updateShouldNotify(ServicesScope old) => old.services != services;
}

extension ServicesContext on BuildContext {
  Services get services => ServicesScope.of(this);
}
