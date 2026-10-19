/// Accepts "010 0123 4567", "+20 100 123 4567" or "00201001234567" and returns
/// E.164 ("+201001234567"), or null if it is not a phone number. Mirrors
/// functions/src/core/phone.ts.
String? toE164(String input, {String countryCode = '20'}) {
  var s = input.replaceAll(RegExp(r'[\s\-().]'), '');
  if (s.startsWith('00')) {
    s = '+${s.substring(2)}';
  } else if (s.startsWith('0')) {
    s = '+$countryCode${s.substring(1)}';
  } else if (!s.startsWith('+')) {
    s = '+$s';
  }
  return RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(s) ? s : null;
}
