import 'package:flutter/widgets.dart';

import 'api.dart';
import 'auth.dart';
import 'photos.dart';
import 'push.dart';
import 'repo.dart';

/// Link players use to open the web app; shown in group posts.
const appUrl = String.fromEnvironment('APP_URL');

class Services {
  const Services({
    required this.auth,
    required this.api,
    required this.repo,
    required this.push,
    required this.photos,
    this.demoPanel,
  });

  final AuthService auth;
  final Api api;
  final Repo repo;
  final PushService push;
  final PhotoStore photos;

  /// Only in the demo build: controls for the simulated week, shown in the Group tab.
  final WidgetBuilder? demoPanel;

  bool get isDemo => demoPanel != null;
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
