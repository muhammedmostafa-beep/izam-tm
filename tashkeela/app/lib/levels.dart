// How good each player is, from the organizer's point of view. Only
// organizers can see or set levels; they're used to balance the teams.

import 'package:flutter/painting.dart';

import 'l10n.dart';
import 'theme.dart';

/// 1 top, 2 about 70%, 3 about 50% or below, 4 weak, 0 new / not sure yet.
const levels = [1, 2, 3, 4, 0];

/// Strength used to balance teams. New players count as average until the organizer knows better.
int levelStrength(int level) => switch (level) {
      1 => 100,
      2 => 70,
      3 => 50,
      4 => 30,
      _ => 50,
    };

String levelLabel(S s, int level) => switch (level) {
      1 => s.t('Top', 'ممتاز'),
      2 => s.t('Good (70%)', 'كويس (٧٠٪)'),
      3 => s.t('Average (50% or less)', 'متوسط (٥٠٪ أو أقل)'),
      4 => s.t('Weak', 'ضعيف'),
      _ => s.t('New / not sure yet', 'جديد / مش متأكد'),
    };

/// A short badge: "L1".."L4", or "New".
String levelBadge(S s, int level) => level == 0 ? s.t('New', 'جديد') : s.t('L$level', 'م${s.n(level)}');

Color levelColor(int level) => switch (level) {
      1 => Palette.lime,
      2 => Palette.sky,
      3 => Palette.amber,
      4 => Palette.coral,
      _ => Palette.muted,
    };
