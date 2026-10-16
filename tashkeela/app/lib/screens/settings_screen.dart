import 'package:flutter/material.dart';

import '../l10n.dart';
import '../models.dart';
import '../services/services.dart';
import '../theme.dart';
import '../widgets.dart';
import 'kit_picker.dart';

/// Organizer only: when the game is, how the poll works, which reminders go out.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.group});

  final Group group;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final _name = TextEditingController(text: widget.group.name);
  late final _venue = TextEditingController(text: widget.group.venue);
  late List<Kit> _kits = [...widget.group.rules.kits];
  late bool _weekly = widget.group.schedule.enabled;
  late final _fee = TextEditingController(text: widget.group.pitchFee?.toString() ?? '');
  late int _matchDay = widget.group.schedule.matchWeekday;
  late String _matchTime = widget.group.schedule.matchTime;
  late int _duration = widget.group.schedule.matchDurationMinutes;
  late int _pollDay = widget.group.schedule.pollOpenWeekday;
  late String _pollTime = widget.group.schedule.pollOpenTime;
  late int _squadSize = widget.group.rules.squadSize;
  late int _window = widget.group.rules.confirmWindowMinutes;
  late int _matchDayWindow = widget.group.rules.matchDayConfirmWindowMinutes;
  late int _lateHours = widget.group.rules.lateDropOutHours;
  late bool _quiet = widget.group.rules.quietHours != null;
  late String _quietStart = widget.group.rules.quietHours?.start ?? '00:00';
  late String _quietEnd = widget.group.rules.quietHours?.end ?? '08:00';
  late bool _remindPoll = widget.group.reminders.pollOpening;
  late bool _remindPromotion = widget.group.reminders.promotion;
  late bool _remindMatchDay = widget.group.reminders.matchDay;
  late int _matchDayHours = widget.group.reminders.matchDayHoursBefore;

  @override
  void dispose() {
    _name.dispose();
    _venue.dispose();
    _fee.dispose();
    super.dispose();
  }

  Map<String, dynamic> _patch() => {
        'name': _name.text.trim(),
        'venue': _venue.text.trim(),
        'pitchFee': num.tryParse(_fee.text.trim()),
        'schedule': {
          'matchWeekday': _matchDay,
          'matchTime': _matchTime,
          'matchDurationMinutes': _duration,
          'pollOpenWeekday': _pollDay,
          'pollOpenTime': _pollTime,
          'enabled': _weekly,
        },
        'rules': {
          'squadSize': _squadSize,
          'kits': [for (final k in _kits) k.toMap()],
          'confirmWindowMinutes': _window,
          'matchDayConfirmWindowMinutes': _matchDayWindow,
          'lateDropOutHours': _lateHours,
          'quietHours': _quiet ? {'start': _quietStart, 'end': _quietEnd} : null,
        },
        'reminders': {
          'pollOpening': _remindPoll,
          'promotion': _remindPromotion,
          'matchDay': _remindMatchDay,
          'matchDayHoursBefore': _matchDayHours,
        },
      };

  Future<void> _save() async {
    final s = context.s;
    final navigator = Navigator.of(context);
    final ok = await runAction(
      context,
      () => context.services.api.updateGroupSettings(widget.group.id, _patch()).then((_) => true),
      success: s.t('Settings saved.', 'اتحفظت الإعدادات.'),
    );
    if (ok == true) navigator.pop();
  }

  Future<String?> _pickTime(String current) async {
    final parts = current.split(':').map(int.parse).toList();
    final picked = await showTimePicker(context: context, initialTime: TimeOfDay(hour: parts[0], minute: parts[1]));
    if (picked == null) return null;
    return '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
  }

  String _clock(String hhmm) {
    final p = hhmm.split(':').map(int.parse).toList();
    return context.s.time(DateTime(2024, 1, 1, p[0], p[1]));
  }

  @override
  Widget build(BuildContext context) {
    final s = context.s;

    Widget weekdayField(String label, int value, ValueChanged<int> onChanged) => DropdownButtonFormField<int>(
          initialValue: value,
          decoration: InputDecoration(labelText: label),
          items: [for (var d = 1; d <= 7; d++) DropdownMenuItem(value: d, child: Text(s.weekday(d)))],
          onChanged: (v) => setState(() => onChanged(v!)),
        );

    Widget timeTile(String label, String value, ValueChanged<String> onChanged) => ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(label),
          trailing: OutlinedButton(
            onPressed: () async {
              final t = await _pickTime(value);
              if (t != null) setState(() => onChanged(t));
            },
            child: Text(_clock(value)),
          ),
        );

    Widget choice(String label, int value, List<int> options, String Function(int) show, ValueChanged<int> onChanged) =>
        DropdownButtonFormField<int>(
          initialValue: options.contains(value) ? value : null,
          decoration: InputDecoration(labelText: label),
          items: [for (final o in options) DropdownMenuItem(value: o, child: Text(show(o)))],
          onChanged: (v) => setState(() => onChanged(v!)),
        );

    String minutes(int m) => m % 60 == 0
        ? s.t('${s.n(m ~/ 60)} h', '${s.n(m ~/ 60)} ساعة')
        : s.t('${s.n(m)} min', '${s.n(m)} دقيقة');
    String hours(int h) => s.t('${s.n(h)} h', '${s.n(h)} ساعة');

    return Scaffold(
      appBar: AppBar(title: Text(s.t('GAME SETTINGS', 'إعدادات الماتش'))),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 32), children: [
        SectionTitle(s.t('Match', 'الماتش')),
        TextField(controller: _name, decoration: InputDecoration(labelText: s.t('Group name', 'اسم الجروب'))),
        const SizedBox(height: 12),
        TextField(controller: _venue, decoration: InputDecoration(labelText: s.t('Pitch', 'الملعب'))),
        const SizedBox(height: 12),
        weekdayField(s.t('Match day', 'يوم الماتش'), _matchDay, (v) => _matchDay = v),
        timeTile(s.t('Kick-off', 'معاد البداية'), _matchTime, (v) => _matchTime = v),
        choice(s.t('Length', 'المدة'), _duration, const [60, 90, 120, 150], minutes, (v) => _duration = v),
        const SizedBox(height: 12),
        TextField(
          controller: _fee,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(labelText: s.t('Pitch fee (EGP, optional)', 'سعر الملعب (جنيه، اختياري)')),
        ),

        SectionTitle(s.t('Poll', 'التصويت')),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _weekly,
          onChanged: (v) => setState(() => _weekly = v),
          title: Text(s.t('Post the poll every week', 'نزّل التصويت كل أسبوع')),
          subtitle: Text(_weekly
              ? s.t('On the day and time below. You can still add extra polls.', 'في اليوم والمعاد اللي تحت. وتقدر تضيف تصويتات زيادة.')
              : s.t('Off: you make each poll yourself from the Polls tab.', 'مقفول: إنت بتعمل كل تصويت بنفسك من صفحة الماتشات.')),
        ),
        if (_weekly) ...[
          weekdayField(s.t('Poll opens on', 'التصويت يفتح يوم'), _pollDay, (v) => _pollDay = v),
          timeTile(s.t('Poll opens at', 'التصويت يفتح الساعة'), _pollTime, (v) => _pollTime = v),
        ],
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(s.t('Squad size', 'عدد اللعيبة')),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            IconButton.outlined(
              tooltip: s.t('Fewer', 'أقل'),
              onPressed: _squadSize > 2 ? () => setState(() => _squadSize--) : null,
              icon: const Icon(Icons.remove),
            ),
            SizedBox(width: 44, child: Text(s.n(_squadSize), textAlign: TextAlign.center, style: display(26))),
            IconButton.outlined(
              tooltip: s.t('More', 'أكتر'),
              onPressed: _squadSize < 60 ? () => setState(() => _squadSize++) : null,
              icon: const Icon(Icons.add),
            ),
          ]),
        ),
        SectionTitle(s.t('Team kits', 'ألوان الفرق')),
        Text(
          s.t('The colors your teams play in: red, black and white, or any other color you name.',
              'ألوان الفانلات اللي الفرق بتلعب بيها: أحمر وأسود وأبيض، أو أي لون تاني تسميه.'),
          style: const TextStyle(color: Palette.muted, fontSize: 13),
        ),
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final (i, kit) in _kits.indexed)
            InputChip(
              avatar: KitDot(kit),
              label: Text(kit.label(s)),
              onPressed: () async {
                final taken = {for (final (j, k) in _kits.indexed) if (j != i) k.name.toLowerCase()};
                final picked = await pickKit(context, current: kit, taken: taken);
                if (picked != null) setState(() => _kits[i] = picked);
              },
              onDeleted: _kits.length > 2 ? () => setState(() => _kits = [..._kits]..removeAt(i)) : null,
              deleteButtonTooltipMessage: s.t('Remove', 'شيل'),
            ),
          if (_kits.length < 6)
            ActionChip(
              avatar: const Icon(Icons.add, size: 18),
              label: Text(s.t('Add a kit', 'ضيف لون')),
              onPressed: () async {
                final picked = await pickKit(context, taken: {for (final k in _kits) k.name.toLowerCase()});
                if (picked != null) setState(() => _kits = [..._kits, picked]);
              },
            ),
        ]),

        SectionTitle(s.t('Reserves', 'الاحتياطي')),
        choice(s.t('Reserve has to confirm within', 'الاحتياطي يأكد خلال'), _window, const [30, 60, 120, 180, 240], minutes,
            (v) => _window = v),
        const SizedBox(height: 12),
        choice(s.t('…on match day', '…يوم الماتش'), _matchDayWindow, const [15, 30, 45, 60], minutes, (v) => _matchDayWindow = v),
        const SizedBox(height: 12),
        choice(s.t('Late drop-out if less than', 'الاعتذار متأخر لو قبل الماتش بأقل من'), _lateHours, const [6, 12, 24, 48],
            hours, (v) => _lateHours = v),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _quiet,
          onChanged: (v) => setState(() => _quiet = v),
          title: Text(s.t('Pause confirm timers overnight', 'وقف عداد التأكيد بالليل')),
          subtitle: Text(s.t('Nobody loses a spot while asleep', 'محدش يخسر مكانه وهو نايم')),
        ),
        if (_quiet) ...[
          timeTile(s.t('Night starts', 'الليل يبدأ'), _quietStart, (v) => _quietStart = v),
          timeTile(s.t('Night ends', 'الليل يخلص'), _quietEnd, (v) => _quietEnd = v),
        ],

        SectionTitle(s.t('WhatsApp reminders', 'تنبيهات واتساب')),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _remindPoll,
          onChanged: (v) => setState(() => _remindPoll = v),
          title: Text(s.t('Poll opening', 'فتح التصويت')),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _remindPromotion,
          onChanged: (v) => setState(() => _remindPromotion = v),
          title: Text(s.t('Spot offered to a reserve', 'عرض مكان على الاحتياطي')),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _remindMatchDay,
          onChanged: (v) => setState(() => _remindMatchDay = v),
          title: Text(s.t('Match day', 'يوم الماتش')),
        ),
        if (_remindMatchDay)
          choice(s.t('Match-day reminder, before kick-off', 'تنبيه يوم الماتش، قبلها بـ'), _matchDayHours, const [2, 3, 4, 6],
              hours, (v) => _matchDayHours = v),
        const SizedBox(height: 8),
        Text(
          s.t('Push notifications to app users are always on.', 'إشعارات التطبيق شغالة دايمًا.'),
          style: const TextStyle(color: Palette.muted, fontSize: 13),
        ),
        const SizedBox(height: 24),
        BusyButton(label: s.t('Save settings', 'احفظ الإعدادات'), onPressed: _save),
      ]),
    );
  }
}
