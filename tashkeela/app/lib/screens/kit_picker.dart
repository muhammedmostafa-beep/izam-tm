import 'package:flutter/material.dart';

import '../l10n.dart';
import '../models.dart';
import '../theme.dart';

/// A kit's color as a dot, with an outline so black and white show on any background.
class KitDot extends StatelessWidget {
  const KitDot(this.kit, {super.key, this.size = 18});

  final Kit kit;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: kit.swatch,
          shape: BoxShape.circle,
          border: Border.all(color: Palette.muted.withValues(alpha: 0.6)),
        ),
      );
}

/// Pick a kit: red, black, white, or another color with its name.
/// Kits named in [taken] (other teams' kits) can't be picked again.
Future<Kit?> pickKit(BuildContext context, {Kit? current, Set<String> taken = const {}}) {
  return showModalBottomSheet<Kit>(
    context: context,
    isScrollControlled: true,
    builder: (sheet) => _KitSheet(current: current, taken: taken),
  );
}

class _KitSheet extends StatefulWidget {
  const _KitSheet({required this.current, required this.taken});

  final Kit? current;
  final Set<String> taken;

  @override
  State<_KitSheet> createState() => _KitSheetState();
}

class _KitSheetState extends State<_KitSheet> {
  late KitSwatch? _swatch = widget.current?.isOther == true
      ? kitSwatches.where((w) => w.hex == widget.current!.hex).firstOrNull
      : null;
  late final _name = TextEditingController(
    text: widget.current?.isOther == true && widget.current!.name != _swatch?.en ? widget.current!.name : '',
  );

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  bool _isTaken(Kit k) => widget.taken.contains(k.name.toLowerCase()) && k != widget.current;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final other = _swatch == null ? null : Kit.other(_swatch!, name: _name.text);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(s.t('KIT COLOR', 'لون الفانلة'), style: display(26)),
          const SizedBox(height: 12),
          for (final kit in Kit.base)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: KitDot(kit, size: 28),
              title: Text(kit.label(s)),
              enabled: !_isTaken(kit),
              subtitle: _isTaken(kit) ? Text(s.t('Another team has it', 'فريق تاني لابسه')) : null,
              trailing: widget.current == kit ? const Icon(Icons.check, color: Palette.lime) : null,
              onTap: () => Navigator.of(context).pop(kit),
            ),
          const Divider(height: 24),
          Text(s.t('Another color', 'لون تاني'), style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(s.t('Pick the color, so everyone knows which bibs to wear.', 'اختار اللون، عشان الكل يعرف يلبس أنهي فانلة.'),
              style: const TextStyle(color: Palette.muted, fontSize: 13)),
          const SizedBox(height: 12),
          Wrap(spacing: 10, runSpacing: 10, children: [
            for (final w in kitSwatches)
              Tooltip(
                message: s.t(w.en, w.ar),
                child: InkResponse(
                  onTap: () => setState(() => _swatch = w),
                  radius: 24,
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Kit.other(w).swatch,
                      shape: BoxShape.circle,
                      border: Border.all(color: _swatch == w ? Palette.lime : Palette.line, width: _swatch == w ? 3 : 1),
                    ),
                    child: Semantics(label: s.t(w.en, w.ar), selected: _swatch == w),
                  ),
                ),
              ),
          ]),
          if (_swatch != null) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _name,
              maxLength: 20,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText: s.t('Name (optional)', 'الاسم (اختياري)'),
                hintText: s.t(_swatch!.en, _swatch!.ar),
              ),
            ),
            FilledButton.icon(
              onPressed: other == null || _isTaken(other) ? null : () => Navigator.of(context).pop(other),
              icon: KitDot(other!, size: 18),
              label: Text(_isTaken(other)
                  ? s.t('Another team has this name', 'فريق تاني بنفس الاسم')
                  : s.t('Use ${other.label(s)}', 'استخدم ${other.label(s)}')),
            ),
          ],
        ]),
      ),
    );
  }
}
