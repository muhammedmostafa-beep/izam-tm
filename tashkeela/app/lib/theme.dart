// "Floodlit": the night-pitch look from the design canvas.

import 'package:flutter/material.dart';

abstract final class Palette {
  static const ground = Color(0xFF0B1410);
  static const surface = Color(0xFF15231C);
  static const raised = Color(0xFF1C2E25);
  static const line = Color(0xFF27392F);
  static const text = Color(0xFFEEF3EC);
  static const muted = Color(0xFFA3B8AA);
  static const lime = Color(0xFFC8F04A);
  static const amber = Color(0xFFF5A524);
  static const coral = Color(0xFFFF7A66);
  static const sky = Color(0xFF7CC4FF);
  static const orange = Color(0xFFFF9F43);

  /// Bib colours for teams, in the order of the group's team names.
  static const bibs = [lime, orange, sky, coral, amber, Color(0xFFB79CFF)];
}

/// Scoreboard numerals and headings.
TextStyle display(double size, {Color color = Palette.text}) => TextStyle(
      fontFamily: 'BarlowCondensed',
      fontFamilyFallback: const ['IBMPlexSansArabic'],
      fontSize: size,
      fontWeight: FontWeight.w700,
      color: color,
      height: 1,
      letterSpacing: 0.3,
    );

ThemeData buildTheme(String lang) {
  const scheme = ColorScheme.dark(
    primary: Palette.lime,
    onPrimary: Palette.ground,
    secondary: Palette.amber,
    onSecondary: Palette.ground,
    surface: Palette.surface,
    onSurface: Palette.text,
    error: Palette.coral,
    onError: Palette.ground,
    outline: Palette.line,
  );
  // Player names can be in either script, so each font falls back to the other.
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: Palette.ground,
    fontFamily: lang == 'ar' ? 'IBMPlexSansArabic' : 'DMSans',
    fontFamilyFallback: lang == 'ar' ? const ['DMSans'] : const ['IBMPlexSansArabic'],
  );
  final text = base.textTheme.apply(bodyColor: Palette.text, displayColor: Palette.text);
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(12));
  const minSize = Size(48, 52);

  return base.copyWith(
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: Palette.ground,
      foregroundColor: Palette.text,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: display(24),
    ),
    cardTheme: CardThemeData(
      color: Palette.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Palette.line),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Palette.lime,
        foregroundColor: Palette.ground,
        minimumSize: minSize,
        shape: shape,
        textStyle: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Palette.text,
        minimumSize: minSize,
        shape: shape,
        side: const BorderSide(color: Color(0xFF3D5446), width: 1.5),
        textStyle: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: Palette.lime)),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Palette.surface,
      labelStyle: const TextStyle(color: Palette.muted),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Palette.line)),
      enabledBorder:
          OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Palette.line)),
      focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Palette.lime, width: 1.5)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Palette.surface,
      indicatorColor: Palette.lime.withValues(alpha: 0.14),
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(color: s.contains(WidgetState.selected) ? Palette.lime : Palette.muted),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => TextStyle(
          fontSize: 12,
          fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
          color: s.contains(WidgetState.selected) ? Palette.lime : Palette.muted,
        ),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Palette.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      showDragHandle: true,
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: Palette.raised,
      contentTextStyle: TextStyle(color: Palette.text),
      behavior: SnackBarBehavior.floating,
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Palette.ground : Palette.muted),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Palette.lime : Palette.ground),
    ),
    dividerTheme: const DividerThemeData(color: Palette.line, space: 1),
    listTileTheme: const ListTileThemeData(iconColor: Palette.muted),
  );
}
