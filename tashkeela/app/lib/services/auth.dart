// Phone sign-in. The real app uses Firebase Auth; the demo build signs in on the device.

import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

/// Why sign-in failed, using Firebase Auth's codes (e.g. invalid-verification-code).
class AuthFailure implements Exception {
  AuthFailure(this.code);
  final String code;

  @override
  String toString() => 'AuthFailure($code)';
}

/// A code was sent; finish signing in with it.
abstract interface class PhoneVerification {
  Future<void> confirm(String code);
}

abstract interface class AuthService {
  /// The signed-in user's id, or null when signed out. Emits the current state first.
  Stream<String?> uidChanges();

  /// Sends an SMS code to [phone] (E.164). Throws [AuthFailure].
  Future<PhoneVerification> sendCode(String phone);

  Future<void> signOut();
}

class FirebaseAuthService implements AuthService {
  FirebaseAuthService(this._auth);

  final FirebaseAuth _auth;

  @override
  Stream<String?> uidChanges() => _auth.authStateChanges().map((u) => u?.uid);

  @override
  Future<PhoneVerification> sendCode(String phone) async {
    try {
      if (kIsWeb) return _WebVerification(await _auth.signInWithPhoneNumber(phone));
      final sent = Completer<PhoneVerification>();
      await _auth.verifyPhoneNumber(
        phoneNumber: phone,
        // Android can read the SMS itself and sign in without the code being typed.
        verificationCompleted: (credential) async {
          await _auth.signInWithCredential(credential);
          if (!sent.isCompleted) sent.complete(const _AlreadySignedIn());
        },
        verificationFailed: (e) {
          if (!sent.isCompleted) sent.completeError(AuthFailure(e.code));
        },
        codeSent: (id, _) {
          if (!sent.isCompleted) sent.complete(_SmsVerification(_auth, id));
        },
        codeAutoRetrievalTimeout: (_) {},
      );
      return await sent.future;
    } on FirebaseAuthException catch (e) {
      throw AuthFailure(e.code);
    }
  }

  @override
  Future<void> signOut() => _auth.signOut();
}

class _SmsVerification implements PhoneVerification {
  _SmsVerification(this._auth, this._verificationId);

  final FirebaseAuth _auth;
  final String _verificationId;

  @override
  Future<void> confirm(String code) async {
    try {
      await _auth.signInWithCredential(PhoneAuthProvider.credential(verificationId: _verificationId, smsCode: code));
    } on FirebaseAuthException catch (e) {
      throw AuthFailure(e.code);
    }
  }
}

class _WebVerification implements PhoneVerification {
  _WebVerification(this._confirmation);

  final ConfirmationResult _confirmation;

  @override
  Future<void> confirm(String code) async {
    try {
      await _confirmation.confirm(code);
    } on FirebaseAuthException catch (e) {
      throw AuthFailure(e.code);
    }
  }
}

class _AlreadySignedIn implements PhoneVerification {
  const _AlreadySignedIn();

  @override
  Future<void> confirm(String code) async {}
}
