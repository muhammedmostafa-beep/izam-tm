import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n.dart';
import '../phone.dart';
import '../services/services.dart';
import '../theme.dart';
import '../widgets.dart';

/// Sign in with the same number the organizer added to the group.
class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  String? _verificationId; // Android and iOS
  ConfirmationResult? _webConfirmation; // web
  String? _error;

  bool get _codeSent => _verificationId != null || _webConfirmation != null;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final s = context.s;
    final auth = context.services.auth;
    final phone = toE164(_phone.text);
    if (phone == null) {
      setState(() => _error = s.t('Enter a valid phone number.', 'اكتب رقم موبايل صحيح.'));
      return;
    }
    setState(() => _error = null);
    try {
      if (kIsWeb) {
        final confirmation = await auth.signInWithPhoneNumber(phone);
        setState(() => _webConfirmation = confirmation);
        return;
      }
      await auth.verifyPhoneNumber(
        phoneNumber: phone,
        verificationCompleted: (credential) => auth.signInWithCredential(credential),
        verificationFailed: (e) => setState(() => _error = _authError(e)),
        codeSent: (id, _) => setState(() => _verificationId = id),
        codeAutoRetrievalTimeout: (_) {},
      );
    } on FirebaseAuthException catch (e) {
      setState(() => _error = _authError(e));
    }
  }

  Future<void> _verify() async {
    final auth = context.services.auth;
    final code = _code.text.trim();
    try {
      if (_webConfirmation != null) {
        await _webConfirmation!.confirm(code);
      } else {
        await auth.signInWithCredential(PhoneAuthProvider.credential(verificationId: _verificationId!, smsCode: code));
      }
    } on FirebaseAuthException catch (e) {
      setState(() => _error = _authError(e));
    }
  }

  String _authError(FirebaseAuthException e) {
    final s = context.s;
    return switch (e.code) {
      'invalid-verification-code' => s.t('That code is not right.', 'الكود ده غلط.'),
      'too-many-requests' => s.t('Too many tries. Wait a little and try again.', 'محاولات كتير. استنى شوية وجرب تاني.'),
      'invalid-phone-number' => s.t('Enter a valid phone number.', 'اكتب رقم موبايل صحيح.'),
      _ => s.t('Could not sign in. Try again.', 'معرفناش ندخلك. جرب تاني.'),
    };
  }

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final language = LanguageScope.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: TextButton(
                    onPressed: () => language.value = s.isAr ? 'en' : 'ar',
                    child: Text(s.t('عربي', 'English')),
                  ),
                ),
                const SizedBox(height: 24),
                Icon(Icons.sports_soccer, size: 56, color: Palette.lime, semanticLabel: s.t('Football', 'كورة')),
                const SizedBox(height: 16),
                Text(s.t('TASHKEELA', 'تشكيلة'), textAlign: TextAlign.center, style: display(44)),
                const SizedBox(height: 8),
                Text(
                  s.t('The weekly game, without the chasing.', 'ماتش الأسبوع من غير وجع دماغ.'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Palette.muted),
                ),
                const SizedBox(height: 40),
                if (!_codeSent) ...[
                  TextField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    autofillHints: const [AutofillHints.telephoneNumber],
                    textDirection: TextDirection.ltr,
                    decoration: InputDecoration(
                      labelText: s.t('Mobile number', 'رقم الموبايل'),
                      hintText: '010 0123 4567',
                      prefixIcon: const Icon(Icons.phone_iphone),
                    ),
                    onSubmitted: (_) => _sendCode(),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    s.t('Use the number the organizer added to the group.', 'استخدم الرقم اللي المنظم ضافه للجروب.'),
                    style: const TextStyle(color: Palette.muted, fontSize: 13),
                  ),
                  const SizedBox(height: 24),
                  BusyButton(label: s.t('Send code', 'ابعت الكود'), onPressed: _sendCode),
                ] else ...[
                  TextField(
                    controller: _code,
                    keyboardType: TextInputType.number,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                    textAlign: TextAlign.center,
                    style: display(32),
                    decoration: InputDecoration(labelText: s.t('6-digit code', 'الكود (٦ أرقام)')),
                    onSubmitted: (_) => _verify(),
                  ),
                  const SizedBox(height: 24),
                  BusyButton(label: s.t('Sign in', 'دخول'), onPressed: _verify),
                  TextButton(
                    onPressed: () => setState(() {
                      _verificationId = null;
                      _webConfirmation = null;
                      _code.clear();
                    }),
                    child: Text(s.t('Change number', 'غيّر الرقم')),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Palette.coral)),
                ],
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
