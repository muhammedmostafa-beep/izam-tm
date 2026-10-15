// Arabic and English, side by side: `s.t('English', 'عربي')`.
// Dates and numbers follow the language (Arabic uses Arabic-Indic digits).

import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart' show DateFormat, NumberFormat;

class S {
  const S(this.lang);

  final String lang;

  bool get isAr => lang == 'ar';
  String get _locale => isAr ? 'ar_EG' : 'en_GB';
  TextDirection get direction => isAr ? TextDirection.rtl : TextDirection.ltr;

  String t(String en, String ar) => isAr ? ar : en;

  /// Separator between parts of a line. Not "·" in Arabic: next to Arabic
  /// digits it reads as a zero (٠), so "١ · ١" looks like "١٠١".
  String get sep => isAr ? ' – ' : ' · ';

  String n(num value) => NumberFormat.decimalPattern(_locale).format(value);

  /// "Thu 22 Oct, 9:00 PM"
  String when(DateTime d) => DateFormat(isAr ? 'EEE d MMM، h:mm a' : 'EEE d MMM, h:mm a', _locale).format(d.toLocal());

  /// "9:00 PM"
  String time(DateTime d) => DateFormat('h:mm a', _locale).format(d.toLocal());

  /// "Thursday 22 October"
  String day(DateTime d) => DateFormat('EEEE d MMMM', _locale).format(d.toLocal());

  /// "Thursday" for ISO weekday 4.
  String weekday(int iso) => DateFormat('EEEE', _locale).format(DateTime(2024, 1, iso));

  /// "2d 06h", "1h 58m", "4m 09s"
  String countdown(Duration d) {
    if (d.isNegative) d = Duration.zero;
    String two(int v) => n(v).padLeft(2, n(0));
    final days = d.inDays, hours = d.inHours % 24, minutes = d.inMinutes % 60, seconds = d.inSeconds % 60;
    if (days > 0) return t('${n(days)}d ${two(hours)}h', '${n(days)} يوم ${two(hours)} س');
    if (d.inHours > 0) return t('${n(d.inHours)}h ${two(minutes)}m', '${n(d.inHours)} س ${two(minutes)} د');
    return t('${n(minutes)}m ${two(seconds)}s', '${n(minutes)} د ${two(seconds)} ث');
  }

  /// Friendly text for an error code sent by the server (see functions/src/core/errors.ts).
  String error(String? code) => switch (code) {
        'already_in' => t("You're already on the list.", 'إنت مسجل بالفعل.'),
        'not_in' => t("You're not on the list.", 'إنت مش في القائمة.'),
        'no_offer' => t('That offer is no longer open.', 'العرض ده خلص.'),
        'game_started' || 'game_closed' => t('The poll is closed.', 'التصويت اتقفل.'),
        'poll_not_open' => t("The poll isn't open yet.", 'التصويت لسه ما فتحش.'),
        'not_member' => t('Your number is not in this group.', 'رقمك مش في الجروب ده.'),
        'permission_denied' => t('Only organizers can do that.', 'المنظم بس اللي يقدر يعمل كده.'),
        'already_exists' => t('That number is already in the group.', 'الرقم ده موجود في الجروب.'),
        'unauthenticated' => t('Please sign in again.', 'سجل دخولك تاني.'),
        _ => t('Something went wrong. Try again.', 'حصلت مشكلة، جرب تاني.'),
      };
}

/// Holds the app language and rebuilds dependents when it changes.
class LanguageScope extends InheritedNotifier<ValueNotifier<String>> {
  const LanguageScope({super.key, required ValueNotifier<String> language, required super.child})
      : super(notifier: language);

  static ValueNotifier<String> of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<LanguageScope>()!.notifier!;
}

extension LocalizedContext on BuildContext {
  S get s => S(LanguageScope.of(this).value);
}
