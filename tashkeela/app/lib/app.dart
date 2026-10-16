import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'l10n.dart';
import 'screens/group_gate.dart';
import 'screens/sign_in_screen.dart';
import 'services/services.dart';
import 'theme.dart';
import 'widgets.dart';

/// The bundled fonts' licenses, for the Licenses page.
void registerFontLicenses() {
  const fonts = {'Barlow Condensed': 'BarlowCondensed', 'DM Sans': 'DMSans', 'IBM Plex Sans Arabic': 'IBMPlexSansArabic'};
  LicenseRegistry.addLicense(() async* {
    for (final MapEntry(key: name, value: file) in fonts.entries) {
      yield LicenseEntryWithLineBreaks([name], await rootBundle.loadString('assets/fonts/OFL-$file.txt'));
    }
  });
}

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
            builder: widget.services.isDemo
                ? (context, child) => Banner(
                      message: 'DEMO',
                      location: BannerLocation.topEnd,
                      color: Palette.amber,
                      child: child!,
                    )
                : null,
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
  StreamSubscription<String?>? _sub;
  String? _uid;
  bool _ready = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sub ??= context.services.auth.uidChanges().listen(_onUser);
  }

  Future<void> _onUser(String? uid) async {
    final claimed = uid != null && _claimedFor == uid;
    setState(() {
      _uid = uid;
      _ready = uid == null || claimed;
    });
    if (uid == null || claimed) return;
    final services = context.services;
    try {
      await services.api.claimMemberships();
      _claimedFor = uid;
    } catch (e) {
      debugPrint('claimMemberships failed: $e');
    }
    unawaited(services.push.register(uid));
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
    final uid = _uid;
    if (uid == null) return const SignInScreen();
    return GroupGate(uid: uid);
  }
}
