import 'package:flutter/material.dart';

import '../l10n.dart';
import '../models.dart';
import '../services/api.dart';
import '../services/services.dart';
import '../theme.dart';
import '../widgets.dart';

/// Organizer only: make a poll with its own date, time and place, or change
/// or call off one that hasn't been played yet. Returns the new poll's id.
class PollEditorScreen extends StatefulWidget {
  const PollEditorScreen({super.key, required this.group, this.game});

  final Group group;

  /// Null to make a new poll.
  final Game? game;

  @override
  State<PollEditorScreen> createState() => _PollEditorScreenState();
}

class _PollEditorScreenState extends State<PollEditorScreen> {
  late final Game? _game = widget.game;
  late DateTime _day;
  late TimeOfDay _kickoff;
  late int _duration;
  late final TextEditingController _venue;
  late int _squadSize;
  late bool _opensNow;
  late DateTime _opensDay;
  late TimeOfDay _opensTime;
  String? _error;

  bool get _editing => _game != null;

  /// The opening time can only change before voting has started.
  bool get _canSetOpening => !_editing || _game!.status == GameStatus.scheduled;

  @override
  void initState() {
    super.initState();
    final g = _game;
    final schedule = widget.group.schedule;
    if (g != null) {
      final k = g.kickoffAt.toLocal();
      _day = DateUtils.dateOnly(k);
      _kickoff = TimeOfDay.fromDateTime(k);
      _duration = g.durationMinutes;
      _venue = TextEditingController(text: g.venue ?? widget.group.venue);
      _squadSize = g.squadSize;
      _opensNow = false;
      final o = g.pollOpensAt.toLocal();
      _opensDay = DateUtils.dateOnly(o);
      _opensTime = TimeOfDay.fromDateTime(o);
    } else {
      // The group's usual day and time, from tomorrow on.
      final today = DateUtils.dateOnly(DateTime.now());
      var day = today.add(const Duration(days: 1));
      while (day.weekday != schedule.matchWeekday) {
        day = day.add(const Duration(days: 1));
      }
      final t = schedule.matchTime.split(':').map(int.parse).toList();
      _day = day;
      _kickoff = TimeOfDay(hour: t[0], minute: t[1]);
      _duration = schedule.matchDurationMinutes;
      _venue = TextEditingController(text: widget.group.venue);
      _squadSize = widget.group.rules.squadSize;
      _opensNow = true;
      _opensDay = today;
      _opensTime = TimeOfDay.fromDateTime(DateTime.now().add(const Duration(hours: 1)));
    }
  }

  @override
  void dispose() {
    _venue.dispose();
    super.dispose();
  }

  DateTime get _kickoffAt => DateTime(_day.year, _day.month, _day.day, _kickoff.hour, _kickoff.minute);
  DateTime get _opensAt => DateTime(_opensDay.year, _opensDay.month, _opensDay.day, _opensTime.hour, _opensTime.minute);

  String? _problem(S s) {
    if (_venue.text.trim().isEmpty) return s.t('Add the location.', 'اكتب المكان.');
    if (!_kickoffAt.isAfter(DateTime.now())) return s.t('The game has to be in the future.', 'لازم الماتش يكون في معاد جاي.');
    if (_canSetOpening && !_opensNow && !_opensAt.isBefore(_kickoffAt)) {
      return s.t('Voting has to open before the game.', 'لازم التصويت يفتح قبل الماتش.');
    }
    return null;
  }

  Future<void> _save() async {
    final s = context.s;
    final problem = _problem(s);
    setState(() => _error = problem);
    if (problem != null) return;
    final api = context.services.api;
    final navigator = Navigator.of(context);
    final draft = PollDraft(
      kickoffAt: _kickoffAt,
      durationMinutes: _duration,
      venue: _venue.text.trim(),
      squadSize: _squadSize,
      pollOpensAt: _opensNow ? null : _opensAt,
    );
    final game = _game;
    final id = await runAction(
      context,
      () async {
        if (game == null) return api.createPoll(widget.group.id, draft);
        // Keep the opening time unless it can still change.
        await api.updatePoll(
          widget.group.id,
          game.id,
          _canSetOpening
              ? draft
              : PollDraft(
                  kickoffAt: draft.kickoffAt,
                  durationMinutes: draft.durationMinutes,
                  venue: draft.venue,
                  squadSize: draft.squadSize,
                  pollOpensAt: game.pollOpensAt,
                ),
        );
        return game.id;
      },
      success: game == null ? s.t('Poll created.', 'اتعمل التصويت.') : s.t('Poll updated.', 'اتعدّل التصويت.'),
    );
    if (id != null) navigator.pop(id);
  }

  Future<void> _callOff() async {
    final s = context.s;
    final game = _game!;
    final sure = await showModalBottomSheet<bool>(
      context: context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(s.t('CALL THIS GAME OFF?', 'تلغي الماتش ده؟'), style: display(28)),
          const SizedBox(height: 12),
          Text(s.t(
            'Everyone on the list of ${s.when(game.kickoffAt)} gets a notification. This can\'t be undone.',
            'كل اللي في قائمة ماتش ${s.when(game.kickoffAt)} هيوصلهم إشعار. مينفعش ترجع فيها.',
          )),
          const SizedBox(height: 20),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Palette.coral),
            onPressed: () => Navigator.of(sheet).pop(true),
            child: Text(s.t('Call it off', 'ألغيه')),
          ),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: () => Navigator.of(sheet).pop(false), child: Text(s.t('Keep the game', 'سيب الماتش'))),
        ]),
      ),
    );
    if (sure != true || !mounted) return;
    final navigator = Navigator.of(context);
    final done = await runAction(
      context,
      () => context.services.api.cancelPoll(widget.group.id, game.id).then((_) => true),
      success: s.t('Game called off.', 'الماتش اتلغى.'),
    );
    if (done == true) navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.s;

    Widget pickTile(String label, String value, Future<void> Function() onTap) => ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(label),
          trailing: OutlinedButton(onPressed: onTap, child: Text(value)),
        );

    Future<DateTime?> pickDay(DateTime current) {
      final today = DateUtils.dateOnly(DateTime.now());
      return showDatePicker(
        context: context,
        initialDate: current.isBefore(today) ? today : current,
        firstDate: today,
        lastDate: today.add(const Duration(days: 120)),
      );
    }

    String clock(TimeOfDay t) => s.time(DateTime(2024, 1, 1, t.hour, t.minute));
    String minutes(int m) => m % 60 == 0 ? s.t('${s.n(m ~/ 60)} h', '${s.n(m ~/ 60)} ساعة') : s.t('${s.n(m)} min', '${s.n(m)} دقيقة');

    return Scaffold(
      appBar: AppBar(title: Text(_editing ? s.t('EDIT POLL', 'تعديل التصويت') : s.t('NEW POLL', 'تصويت جديد'))),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 32), children: [
        SectionTitle(s.t('When', 'امتى')),
        pickTile(s.t('Date', 'اليوم'), s.day(_day), () async {
          final d = await pickDay(_day);
          if (d != null) setState(() => _day = d);
        }),
        pickTile(s.t('Kick-off', 'معاد البداية'), clock(_kickoff), () async {
          final t = await showTimePicker(context: context, initialTime: _kickoff);
          if (t != null) setState(() => _kickoff = t);
        }),
        DropdownButtonFormField<int>(
          initialValue: const [60, 90, 120, 150].contains(_duration) ? _duration : null,
          decoration: InputDecoration(labelText: s.t('Length', 'المدة')),
          items: [for (final m in const [60, 90, 120, 150]) DropdownMenuItem(value: m, child: Text(minutes(m)))],
          onChanged: (v) => setState(() => _duration = v!),
        ),

        SectionTitle(s.t('Where', 'فين')),
        TextField(
          controller: _venue,
          maxLength: 80,
          decoration: InputDecoration(
            labelText: s.t('Location', 'المكان'),
            hintText: s.t('Pitch name, area', 'اسم الملعب، المنطقة'),
            prefixIcon: const Icon(Icons.place_outlined),
          ),
        ),

        SectionTitle(s.t('Players', 'اللعيبة')),
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

        if (_canSetOpening) ...[
          SectionTitle(s.t('Voting', 'التصويت')),
          SegmentedButton<bool>(
            segments: [
              ButtonSegment(value: true, label: Text(s.t('Opens now', 'يفتح دلوقتي'))),
              ButtonSegment(value: false, label: Text(s.t('At a set time', 'في معاد محدد'))),
            ],
            selected: {_opensNow},
            showSelectedIcon: false,
            onSelectionChanged: (v) => setState(() => _opensNow = v.first),
          ),
          if (!_opensNow) ...[
            const SizedBox(height: 4),
            pickTile(s.t('Opens on', 'يفتح يوم'), s.day(_opensDay), () async {
              final d = await pickDay(_opensDay);
              if (d != null) setState(() => _opensDay = d);
            }),
            pickTile(s.t('Opens at', 'يفتح الساعة'), clock(_opensTime), () async {
              final t = await showTimePicker(context: context, initialTime: _opensTime);
              if (t != null) setState(() => _opensTime = t);
            }),
          ],
          const SizedBox(height: 8),
          Text(
            s.t('Everyone gets the poll on WhatsApp and in the app when voting opens.',
                'كله هيوصله التصويت على واتساب وفي التطبيق أول ما يفتح.'),
            style: const TextStyle(color: Palette.muted, fontSize: 13),
          ),
        ] else ...[
          const SizedBox(height: 16),
          Text(
            s.t('Voting is open. If you move the game or change the place, everyone on the list is told.',
                'التصويت مفتوح. لو غيرت المعاد أو المكان، كل اللي في القائمة هيتبلغوا.'),
            style: const TextStyle(color: Palette.muted, fontSize: 13),
          ),
        ],

        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(_error!, style: const TextStyle(color: Palette.coral)),
        ],
        const SizedBox(height: 24),
        BusyButton(label: _editing ? s.t('Save changes', 'احفظ التعديلات') : s.t('Create poll', 'اعمل التصويت'), onPressed: _save),
        if (_editing) ...[
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: _callOff,
            style: TextButton.styleFrom(foregroundColor: Palette.coral),
            icon: const Icon(Icons.event_busy_outlined),
            label: Text(s.t('Call this game off', 'ألغي الماتش ده')),
          ),
        ],
      ]),
    );
  }
}
