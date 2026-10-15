import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'l10n.dart';
import 'screens/group_gate.dart';
import 'screens/sign_in_screen.dart';
import 'services/services.dart';
import 'theme.dart';
import 'widgets.dart';

class TashkeelaApp extends StatefulWidget {
  const TashkeelaApp({super.key, required this.services});

  final Services services;

  @override
  State<TashkeelaApp> createState() => _TashkeelaAppState();
}

class _TashkeelaAppState extends State<TashkeelaApp> {
  late final ValueNotifier<String> _language = ValueNotifier(
    WidgetsBinding.instance.platformDispatcher.locale.languageCode == 'en' ? 'en' : 'ar',
  );

  @override
  void dispose() {
    _language.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ServicesScope(
      services: widget.services,
      child: LanguageScope(
        language: _language,
        child: ValueListenableBuilder<String>(
          valueListenable: _language,
          builder: (context, lang, _) => MaterialApp(
            title: lang == 'ar' ? 'تشكيلة' : 'Tashkeela',
            debugShowCheckedModeBanner: false,
            theme: buildTheme(lang),
            locale: Locale(lang),
            supportedLocales: const [Locale('ar'), Locale('en')],
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            home: const AuthGate(),
          ),
        ),
      ),
    );
  }
}

/// Signed out: the phone sign-in. Signed in: link memberships, then the group.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  String? _claimedFor;
  StreamSubscription<User?>? _sub;
  User? _user;
  bool _ready = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sub ??= context.services.auth.authStateChanges().listen(_onUser);
  }

  Future<void> _onUser(User? user) async {
    final claimed = user != null && _claimedFor == user.uid;
    setState(() {
      _user = user;
      _ready = user == null || claimed;
    });
    if (user == null || claimed) return;
    final services = context.services;
    try {
      await services.api.claimMemberships();
      _claimedFor = user.uid;
    } catch (e) {
      debugPrint('claimMemberships failed: $e');
    }
    unawaited(services.push.register(user.uid));
    if (mounted) setState(() => _ready = true);
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) return const Scaffold(body: Loading());
    final user = _user;
    if (user == null) return const SignInScreen();
    return GroupGate(uid: user.uid);
  }
}
