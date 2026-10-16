// Team kits: red, black and white, or any other color the organizer names.
// Mirrors functions/src/domain/kits.ts.

import 'package:flutter/painting.dart';

import 'l10n.dart';

/// A color an organizer can pick for a kit that isn't red, black or white.
class KitSwatch {
  const KitSwatch(this.en, this.ar, this.hex, this.emoji);
  final String en;
  final String ar;
  final String hex;

  /// The closest colored circle for WhatsApp posts.
  final String emoji;
}

const kitSwatches = [
  KitSwatch('Blue', 'أزرق', '#1E88E5', '🔵'),
  KitSwatch('Sky blue', 'لبني', '#4FC3F7', '🔵'),
  KitSwatch('Navy', 'كحلي', '#1A237E', '🔵'),
  KitSwatch('Green', 'أخضر', '#2E7D32', '🟢'),
  KitSwatch('Lime', 'فسفوري', '#C6FF00', '🟢'),
  KitSwatch('Yellow', 'أصفر', '#FDD835', '🟡'),
  KitSwatch('Orange', 'برتقالي', '#FB8C00', '🟠'),
  KitSwatch('Purple', 'بنفسجي', '#8E24AA', '🟣'),
  KitSwatch('Pink', 'بمبي', '#EC407A', '🟣'),
  KitSwatch('Maroon', 'نبيتي', '#880E4F', '🟤'),
  KitSwatch('Brown', 'بني', '#6D4C41', '🟤'),
];

class Kit {
  const Kit({required this.color, required this.name, required this.hex});

  /// red, black, white or other.
  final String color;

  /// "Red", "Black", "White", or the organizer's name for another color.
  final String name;

  /// "#RRGGBB"
  final String hex;

  static const red = Kit(color: 'red', name: 'Red', hex: '#D32F2F');
  static const black = Kit(color: 'black', name: 'Black', hex: '#1C1C1C');
  static const white = Kit(color: 'white', name: 'White', hex: '#F5F5F5');
  static const base = [red, black, white];

  /// Another color: the name defaults to the swatch's English name, so it reads in both languages.
  factory Kit.other(KitSwatch swatch, {String? name}) =>
      Kit(color: 'other', name: (name == null || name.trim().isEmpty) ? swatch.en : name.trim(), hex: swatch.hex);

  factory Kit.fromMap(Map<String, dynamic> m) => Kit(
        color: m['color'] as String? ?? 'other',
        name: m['name'] as String? ?? '',
        hex: m['hex'] as String? ?? '#9E9E9E',
      );

  Map<String, Object> toMap() => {'color': color, 'name': name, 'hex': hex};

  bool get isOther => color == 'other';

  Color get swatch => Color(0xFF000000 | int.parse(hex.substring(1), radix: 16));

  /// Dark text on light kits (white, yellow), light text on the rest.
  bool get isLight => swatch.computeLuminance() > 0.5;

  KitSwatch? get _swatch => kitSwatches.where((w) => w.hex == hex.toUpperCase()).firstOrNull;

  /// The kit's name in the reader's language.
  String label(S s) => switch (color) {
        'red' => s.t('Red', 'أحمر'),
        'black' => s.t('Black', 'أسود'),
        'white' => s.t('White', 'أبيض'),
        _ => (_swatch != null && _swatch!.en == name) ? s.t(_swatch!.en, _swatch!.ar) : name,
      };

  String get emoji => switch (color) {
        'red' => '🔴',
        'black' => '⚫',
        'white' => '⚪',
        _ => _swatch?.emoji ?? '🎽',
      };

  /// For the champions ring, which is drawn in Latin letters.
  String get latinName => RegExp(r'^[\x20-\x7E]+$').hasMatch(name) ? name : (_swatch?.en ?? 'Champions');

  @override
  bool operator ==(Object other) => other is Kit && other.color == color && other.name == name && other.hex == hex;

  @override
  int get hashCode => Object.hash(color, name, hex);
}

/// A team in a game: the kit it plays in and who's on it.
class Team {
  const Team({required this.kit, required this.memberIds});
  final Kit kit;
  final List<String> memberIds;

  factory Team.fromMap(Map<String, dynamic> m) => Team(
        kit: Kit.fromMap((m['kit'] as Map?)?.cast<String, dynamic>() ?? const {}),
        memberIds: (m['memberIds'] as List?)?.cast<String>() ?? const [],
      );

  Map<String, Object> toMap() => {'kit': kit.toMap(), 'memberIds': memberIds};
}
