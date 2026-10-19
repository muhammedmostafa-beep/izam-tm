import 'dart:async';

import 'package:flutter/material.dart';

import 'l10n.dart';
import 'services/api.dart';
import 'theme.dart';

/// A small rounded label: "You're in · #7", "GK", "Reserve".
class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, this.color = Palette.lime, this.filled = false, this.icon});

  final String label;
  final Color color;
  final bool filled;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: filled ? color : color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 14, color: filled ? Palette.ground : color), const SizedBox(width: 4)],
        Text(label,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: filled ? Palette.ground : color)),
      ]),
    );
  }
}

/// A short status line with an icon that wraps when it's long ("Waiting for the organizer to confirm").
class Note extends StatelessWidget {
  const Note(this.text, {super.key, required this.icon, this.color = Palette.lime});

  final String text;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) => Row(children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w700))),
      ]);
}

/// Initials in a circle, the way players appear across the app.
class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 36, this.color});

  final String name;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    final initials = parts.take(2).map((p) => p.characters.first.toUpperCase()).join();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: color ?? Palette.raised, shape: BoxShape.circle),
      child: Text(initials,
          style: TextStyle(
              fontSize: size * 0.38, fontWeight: FontWeight.w700, color: color == null ? Palette.text : Palette.ground)),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(4, 20, 4, 8),
      child: Row(children: [
        Expanded(child: Text(text.toUpperCase(), style: display(15, color: Palette.muted))),
        ?trailing,
      ]),
    );
  }
}

/// Rebuilds every second until [target], then once more.
class Countdown extends StatefulWidget {
  const Countdown({super.key, required this.target, required this.builder});

  final DateTime target;
  final Widget Function(BuildContext context, Duration left) builder;

  @override
  State<Countdown> createState() => _CountdownState();
}

class _CountdownState extends State<Countdown> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _start();
  }

  void _start() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {});
      if (DateTime.now().isAfter(widget.target)) _timer?.cancel();
    });
  }

  @override
  void didUpdateWidget(Countdown old) {
    super.didUpdateWidget(old);
    if (old.target != widget.target) _start();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, widget.target.difference(DateTime.now()));
}

/// Runs a server call with a spinner on the button and a friendly error.
Future<T?> runAction<T>(BuildContext context, Future<T> Function() action, {String? success}) async {
  final s = context.s;
  final messenger = ScaffoldMessenger.of(context);
  try {
    final result = await action();
    if (success != null) messenger.showSnackBar(SnackBar(content: Text(success)));
    return result;
  } on ApiException catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(s.error(e.code))));
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(s.error(null))));
    debugPrint('action failed: $e');
  }
  return null;
}

/// A button that disables itself and shows progress while [onPressed] runs.
class BusyButton extends StatefulWidget {
  const BusyButton({super.key, required this.label, required this.onPressed, this.icon, this.style = BusyStyle.filled});

  final String label;
  final IconData? icon;
  final Future<void> Function()? onPressed;
  final BusyStyle style;

  @override
  State<BusyButton> createState() => _BusyButtonState();
}

enum BusyStyle { filled, outlined, danger }

class _BusyButtonState extends State<BusyButton> {
  bool _busy = false;

  Future<void> _run() async {
    setState(() => _busy = true);
    try {
      await widget.onPressed!();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final onPressed = widget.onPressed == null || _busy ? null : _run;
    final child = _busy
        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5))
        : Text(widget.label);
    final icon = widget.icon == null || _busy ? null : Icon(widget.icon, size: 20);
    switch (widget.style) {
      case BusyStyle.filled:
        return FilledButton.icon(onPressed: onPressed, icon: icon, label: child);
      case BusyStyle.outlined:
        return OutlinedButton.icon(onPressed: onPressed, icon: icon, label: child);
      case BusyStyle.danger:
        return OutlinedButton.icon(
          onPressed: onPressed,
          icon: icon,
          label: child,
          style: OutlinedButton.styleFrom(
            foregroundColor: Palette.coral,
            side: const BorderSide(color: Palette.coral, width: 1.5),
          ),
        );
    }
  }
}

class Loading extends StatelessWidget {
  const Loading({super.key});

  @override
  Widget build(BuildContext context) => const Center(child: CircularProgressIndicator());
}

class Message extends StatelessWidget {
  const Message({super.key, required this.icon, required this.title, this.body, this.action});

  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 48, color: Palette.muted),
          const SizedBox(height: 16),
          Text(title, textAlign: TextAlign.center, style: display(26)),
          if (body != null) ...[
            const SizedBox(height: 8),
            Text(body!, textAlign: TextAlign.center, style: const TextStyle(color: Palette.muted)),
          ],
          if (action != null) ...[const SizedBox(height: 24), action!],
        ]),
      ),
    );
  }
}
