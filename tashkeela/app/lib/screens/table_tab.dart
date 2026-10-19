import 'package:flutter/material.dart';

import '../l10n.dart';
import '../models.dart';
import '../services/services.dart';
import '../theme.dart';
import '../widgets.dart';
import 'home_shell.dart';

enum _Sort { wins, mvp, played }

/// The season table: who played, won, was man of the match, and dropped out.
class TableTab extends StatefulWidget {
  const TableTab({super.key, required this.view});

  final GroupView view;

  @override
  State<TableTab> createState() => _TableTabState();
}

class _TableTabState extends State<TableTab> {
  Stream<SeasonTable?>? _stream;
  String? _seasonId;
  _Sort _sort = _Sort.wins;

  Stream<SeasonTable?> _statsFor(String seasonId) {
    if (seasonId != _seasonId || _stream == null) {
      _seasonId = seasonId;
      _stream = context.services.repo.stats(widget.view.group.id, seasonId);
    }
    return _stream!;
  }

  List<PlayerStats> _sorted(List<PlayerStats> rows) {
    int by(PlayerStats a, PlayerStats b, List<int Function(PlayerStats)> keys) {
      for (final k in keys) {
        final c = k(b).compareTo(k(a));
        if (c != 0) return c;
      }
      return a.name.compareTo(b.name);
    }

    int wins(PlayerStats p) => p.wins;
    int mvp(PlayerStats p) => p.mvp;
    int played(PlayerStats p) => p.played;
    final keys = switch (_sort) {
      _Sort.wins => [wins, mvp, played],
      _Sort.mvp => [mvp, wins, played],
      _Sort.played => [played, wins, mvp],
    };
    return [...rows]..sort((a, b) => by(a, b, keys));
  }

  Future<void> _newSeason(BuildContext context) async {
    final s = context.s;
    final field = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(s.t('Start a new season', 'ابدأ موسم جديد')),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(
            s.t('The table starts again from zero. This season\'s table is kept.',
                'الجدول هيبدأ من الصفر. جدول الموسم ده هيتحفظ.'),
            style: const TextStyle(color: Palette.muted),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: field,
            autofocus: true,
            maxLength: 40,
            decoration: InputDecoration(labelText: s.t('Name', 'الاسم'), hintText: s.t('Winter 2026', 'شتاء ٢٠٢٦')),
          ),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialog).pop(), child: Text(s.t('Cancel', 'إلغاء'))),
          FilledButton(onPressed: () => Navigator.of(dialog).pop(field.text.trim()), child: Text(s.t('Start', 'ابدأ'))),
        ],
      ),
    );
    field.dispose();
    if (name == null || name.isEmpty || !context.mounted) return;
    await runAction(context, () => context.services.api.startSeason(widget.view.group.id, name),
        success: s.t('$name has started.', 'بدأ $name.'));
  }

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final view = widget.view;
    final season = view.group.season;
    return StreamBuilder<SeasonTable?>(
      stream: _statsFor(season.id),
      builder: (context, snap) {
        final table = snap.data;
        final rows = _sorted(table?.players ?? const []);
        final games = table?.games ?? 0;
        return ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(season.name.toUpperCase(), style: display(30)),
                const SizedBox(height: 4),
                Text(
                  [
                    games == 1 ? s.t('1 game', 'ماتش واحد') : s.t('${s.n(games)} games', '${s.n(games)} ماتش'),
                    if (season.startedAt != null) s.t('since ${s.shortDay(season.startedAt!)}', 'من ${s.shortDay(season.startedAt!)}'),
                  ].join(s.sep),
                  style: const TextStyle(color: Palette.muted, fontSize: 13),
                ),
              ]),
            ),
            if (view.isAdmin)
              TextButton.icon(
                onPressed: () => _newSeason(context),
                icon: const Icon(Icons.restart_alt, size: 18),
                label: Text(s.t('New season', 'موسم جديد')),
              ),
          ]),
          const SizedBox(height: 12),
          SegmentedButton<_Sort>(
            showSelectedIcon: false,
            segments: [
              ButtonSegment(value: _Sort.wins, label: Text(s.t('Wins', 'فوز'))),
              ButtonSegment(value: _Sort.mvp, label: Text(s.t('MVP', 'النجم'))),
              ButtonSegment(value: _Sort.played, label: Text(s.t('Played', 'لعب'))),
            ],
            selected: {_sort},
            onSelectionChanged: (v) => setState(() => _sort = v.first),
          ),
          const SizedBox(height: 12),
          if (snap.connectionState == ConnectionState.waiting && table == null)
            const Padding(padding: EdgeInsets.all(32), child: Loading())
          else if (rows.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  s.t('The table fills in after the first game of the season.', 'الجدول هيتملي بعد أول ماتش في الموسم.'),
                  style: const TextStyle(color: Palette.muted),
                ),
              ),
            )
          else
            Card(
              child: Column(children: [
                _HeaderRow(sort: _sort),
                for (final (i, p) in rows.indexed) ...[
                  const Divider(height: 1),
                  _PlayerRow(
                    rank: i + 1,
                    stats: p,
                    name: view.membersById[p.memberId]?.name ?? p.name,
                    games: games,
                    isMe: p.memberId == view.me?.id,
                    sort: _sort,
                  ),
                ],
              ]),
            ),
          const SizedBox(height: 12),
          Text(
            s.t('Played: in the squad at kick-off. Wins count when the organizer records the winners and the teams. '
                    'Late: dropped out less than ${s.n(view.group.rules.lateDropOutHours)} hours before kick-off.',
                'لعب: كان في التشكيلة وقت الماتش. الفوز بيتحسب لما المنظم يسجل الفريق الكسبان والفرق. '
                    'متأخر: اعتذر قبل الماتش بأقل من ${s.n(view.group.rules.lateDropOutHours)} ساعة.'),
            style: const TextStyle(color: Palette.muted, fontSize: 12),
          ),
        ]);
      },
    );
  }
}

const _numWidth = 44.0;

class _HeaderRow extends StatelessWidget {
  const _HeaderRow({required this.sort});

  final _Sort sort;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    Widget col(String label, _Sort? key) => SizedBox(
          width: _numWidth,
          child: Text(label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: key == sort ? Palette.lime : Palette.muted,
              )),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 8),
      child: Row(children: [
        const SizedBox(width: 28),
        Expanded(
          child: Text(s.t('Player', 'اللعيب'),
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Palette.muted)),
        ),
        col(s.t('P', 'لعب'), _Sort.played),
        col(s.t('W', 'فاز'), _Sort.wins),
        col('★', _Sort.mvp),
      ]),
    );
  }
}

class _PlayerRow extends StatelessWidget {
  const _PlayerRow({
    required this.rank,
    required this.stats,
    required this.name,
    required this.games,
    required this.isMe,
    required this.sort,
  });

  final int rank;
  final PlayerStats stats;
  final String name;
  final int games;
  final bool isMe;
  final _Sort sort;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final p = stats;
    Widget num(int value, _Sort key) => SizedBox(
          width: _numWidth,
          child: Text(s.n(value),
              textAlign: TextAlign.center,
              style: display(20, color: key == sort ? Palette.lime : Palette.text)),
        );
    final notes = [
      if (games > 0) s.t('${s.n((p.played * 100 / games).round())}% attendance', 'حضور ${s.n((p.played * 100 / games).round())}٪'),
      if (p.dropOuts > 0)
        p.lateDropOuts > 0
            ? s.t('${s.n(p.dropOuts)} ${p.dropOuts == 1 ? 'drop-out' : 'drop-outs'}, ${s.n(p.lateDropOuts)} late',
                '${s.n(p.dropOuts)} اعتذار، ${s.n(p.lateDropOuts)} متأخر')
            : s.t('${s.n(p.dropOuts)} ${p.dropOuts == 1 ? 'drop-out' : 'drop-outs'}', '${s.n(p.dropOuts)} اعتذار'),
    ];
    return Container(
      color: isMe ? Palette.lime.withValues(alpha: 0.06) : null,
      padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
      child: Row(children: [
        SizedBox(
          width: 28,
          child: Text(s.n(rank), style: display(18, color: rank <= 3 ? Palette.amber : Palette.muted)),
        ),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(isMe ? s.t('$name (you)', '$name (إنت)') : name,
                maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
            if (notes.isNotEmpty)
              Text(notes.join(s.sep),
                  style: TextStyle(fontSize: 12, color: p.lateDropOuts > 0 ? Palette.amber : Palette.muted)),
          ]),
        ),
        num(p.played, _Sort.played),
        num(p.wins, _Sort.wins),
        num(p.mvp, _Sort.mvp),
      ]),
    );
  }
}
