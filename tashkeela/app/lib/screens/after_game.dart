import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../l10n.dart';
import '../models.dart';
import '../services/services.dart';
import '../theme.dart';
import '../widgets.dart';
import 'home_shell.dart';

bool _afterKickoff(Game g) => g.status == GameStatus.closed || g.status == GameStatus.played;

/// The pitch fee split among the players: what you owe and where to pay, and
/// for the organizer, who has paid and a reminder for everyone else.
class PaymentsSection extends StatelessWidget {
  const PaymentsSection({super.key, required this.view, required this.game});

  final GroupView view;
  final Game game;

  Future<void> _editFee(BuildContext context) async {
    final s = context.s;
    final api = context.services.api;
    final field = TextEditingController(text: (game.payments?.fee ?? view.group.pitchFee ?? '').toString());
    final fee = await showDialog<num?>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(s.t('Pitch fee for this game', 'سعر الملعب للماتش ده')),
        content: TextField(
          controller: field,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(labelText: s.t('Total, in EGP', 'الإجمالي بالجنيه')),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialog).pop(), child: Text(s.t('Cancel', 'إلغاء'))),
          FilledButton(
            onPressed: () => Navigator.of(dialog).pop(num.tryParse(field.text.trim()) ?? 0),
            child: Text(s.t('Save', 'احفظ')),
          ),
        ],
      ),
    );
    field.dispose();
    if (fee == null || !context.mounted) return;
    await runAction(context, () => api.setGameFee(view.group.id, game.id, fee == 0 ? null : fee));
  }

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    if (!_afterKickoff(game)) return const SizedBox.shrink();
    final p = game.payments;
    if (p == null) {
      if (!view.isAdmin) return const SizedBox.shrink();
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: OutlinedButton.icon(
          onPressed: () => _editFee(context),
          icon: const Icon(Icons.payments_outlined),
          label: Text(s.t('Split the pitch fee', 'قسّم سعر الملعب')),
        ),
      );
    }
    final total = p.players.length;
    final paid = p.count(PaymentState.paid);
    final mine = view.me == null ? null : p.players[view.me!.id];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionTitle(
        s.t('Pitch fee', 'فلوس الملعب'),
        trailing: view.isAdmin
            ? TextButton(onPressed: () => _editFee(context), child: Text(s.t('Change', 'غيّر')))
            : null,
      ),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Wrap(crossAxisAlignment: WrapCrossAlignment.end, spacing: 6, children: [
              Text(s.money(p.perPlayer), style: display(30, color: Palette.lime)),
              Text(s.t('each', 'للفرد'), style: const TextStyle(color: Palette.muted)),
            ]),
            const SizedBox(height: 6),
            Text(s.t('${s.n(paid)} of ${s.n(total)} paid', '${s.n(paid)} من ${s.n(total)} دفعوا'),
                style: const TextStyle(fontWeight: FontWeight.w700)),
            Text(s.t('${s.money(p.fee)} split between ${s.n(total)} players', '${s.money(p.fee)} على ${s.n(total)} لعيب'),
                style: const TextStyle(color: Palette.muted, fontSize: 13)),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: total == 0 ? 0 : paid / total,
                minHeight: 6,
                backgroundColor: Palette.line,
                color: Palette.lime,
              ),
            ),
            if (mine != null) ...[
              const SizedBox(height: 14),
              _MyShare(view: view, game: game, state: mine, amount: p.perPlayer),
            ],
          ]),
        ),
      ),
      if (view.isAdmin) _Ledger(view: view, game: game, payments: p),
    ]);
  }
}

class _MyShare extends StatelessWidget {
  const _MyShare({required this.view, required this.game, required this.state, required this.amount});

  final GroupView view;
  final Game game;
  final PaymentState state;
  final num amount;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    switch (state) {
      case PaymentState.paid:
        return Note(s.t('You paid. Thanks!', 'دفعت. شكرًا!'), icon: Icons.check_circle);
      case PaymentState.claimed:
        return Note(s.t('Waiting for the organizer to confirm', 'مستني المنظم يأكد'),
            icon: Icons.hourglass_top, color: Palette.amber);
      case PaymentState.unpaid:
        final payTo = view.group.payTo;
        Widget way(String label, String value) => Row(children: [
              Expanded(
                child: Text.rich(TextSpan(children: [
                  TextSpan(text: '$label  ', style: const TextStyle(color: Palette.muted)),
                  TextSpan(text: value, style: const TextStyle(fontWeight: FontWeight.w700)),
                ]), textDirection: TextDirection.ltr),
              ),
              IconButton(
                tooltip: s.t('Copy', 'انسخ'),
                icon: const Icon(Icons.copy, size: 18),
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: value));
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.t('Copied.', 'اتنسخ.'))));
                  }
                },
              ),
            ]);
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(s.t('You owe ${s.money(amount)}', 'عليك ${s.money(amount)}'), style: const TextStyle(fontWeight: FontWeight.w700)),
          if (payTo.instapay != null) way('InstaPay', payTo.instapay!),
          if (payTo.wallet != null) way(s.t('Wallet', 'محفظة'), payTo.wallet!),
          if (payTo.note != null) Text(payTo.note!, style: const TextStyle(color: Palette.muted, fontSize: 13)),
          if (payTo.isEmpty)
            Text(s.t('Pay the organizer.', 'ادفع للمنظم.'), style: const TextStyle(color: Palette.muted, fontSize: 13)),
          const SizedBox(height: 10),
          BusyButton(
            icon: Icons.check,
            label: s.t("I've paid", 'دفعت'),
            onPressed: () => runAction(
              context,
              () => context.services.api.claimPayment(view.group.id, game.id),
              success: s.t('Thanks! The organizer will confirm.', 'شكرًا! المنظم هيأكد.'),
            ),
          ),
        ]);
    }
  }
}

/// Organizer: everyone's payment, unpaid first. Tap to confirm or undo.
class _Ledger extends StatelessWidget {
  const _Ledger({required this.view, required this.game, required this.payments});

  final GroupView view;
  final Game game;
  final GamePayments payments;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final api = context.services.api;
    const order = {PaymentState.claimed: 0, PaymentState.unpaid: 1, PaymentState.paid: 2};
    final rows = payments.players.entries.toList()
      ..sort((a, b) {
        final o = order[a.value]!.compareTo(order[b.value]!);
        return o != 0 ? o : view.nameOf(a.key).compareTo(view.nameOf(b.key));
      });
    final unpaid = payments.count(PaymentState.unpaid);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SizedBox(height: 8),
      Card(
        child: Column(children: [
          for (final (i, MapEntry(key: id, value: state)) in rows.indexed) ...[
            if (i > 0) const Divider(height: 1),
            ListTile(
              dense: true,
              title: Text(view.nameOf(id)),
              trailing: switch (state) {
                PaymentState.paid => Pill(s.t('Paid', 'دفع'), icon: Icons.check),
                PaymentState.claimed => Pill(s.t('Says paid: confirm', 'بيقول دفع: أكد'), color: Palette.amber),
                PaymentState.unpaid => Pill(s.t('Not paid', 'لسه'), color: Palette.muted),
              },
              onTap: () => runAction(context, () => api.setPayment(view.group.id, game.id, id, paid: state != PaymentState.paid)),
            ),
          ],
        ]),
      ),
      if (unpaid > 0) ...[
        const SizedBox(height: 8),
        BusyButton(
          style: BusyStyle.outlined,
          icon: Icons.notifications_active_outlined,
          label: s.t('Remind the ${s.n(unpaid)} who haven\'t paid', 'فكّر الـ${s.n(unpaid)} اللي لسه مدفعوش'),
          onPressed: () async {
            final n = await runAction(context, () => api.remindUnpaid(view.group.id, game.id));
            if (n != null && context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                content: Text(s.t('Reminded ${s.n(n)} players on WhatsApp and in the app.', 'اتبعت تذكير لـ${s.n(n)} على واتساب وفي التطبيق.')),
              ));
            }
          },
        ),
      ],
    ]);
  }
}

/// Man of the match: the players vote, in secret, for a day after kick-off.
class MvpSection extends StatefulWidget {
  const MvpSection({super.key, required this.view, required this.game});

  final GroupView view;
  final Game game;

  @override
  State<MvpSection> createState() => _MvpSectionState();
}

class _MvpSectionState extends State<MvpSection> {
  bool _changing = false;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final view = widget.view;
    final game = widget.game;
    final mvp = game.mvp;
    if (mvp == null || !_afterKickoff(game)) return const SizedBox.shrink();
    final squad = view.line.squad.map((e) => e.memberId).toList();
    final me = view.me?.id;

    Widget body;
    if (!mvp.isOpen) {
      final winners = mvp.winners ?? const [];
      body = winners.isEmpty
          ? Text(s.t('Nobody voted this time.', 'محدش صوّت المرة دي.'), style: const TextStyle(color: Palette.muted))
          : Row(children: [
              const Icon(Icons.star_rounded, color: Palette.amber, size: 32),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(winners.map(view.nameOf).join(s.isAr ? ' و ' : ' & ').toUpperCase(), style: display(24, color: Palette.amber)),
                  Text(s.t('${s.n(mvp.winnerVotes ?? 0)} votes', '${s.n(mvp.winnerVotes ?? 0)} صوت'),
                      style: const TextStyle(color: Palette.muted)),
                ]),
              ),
            ]);
    } else {
      final voted = me != null && mvp.voters.contains(me);
      final canVote = me != null && squad.contains(me);
      body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(
          s.t('${s.n(mvp.voters.length)} of ${s.n(squad.length)} players voted${s.sep}result ${s.when(mvp.closesAt!)}',
              '${s.n(mvp.voters.length)} من ${s.n(squad.length)} صوّتوا${s.sep}النتيجة ${s.when(mvp.closesAt!)}'),
          style: const TextStyle(color: Palette.muted, fontSize: 13),
        ),
        const SizedBox(height: 10),
        if (canVote && voted && !_changing)
          Wrap(alignment: WrapAlignment.spaceBetween, crossAxisAlignment: WrapCrossAlignment.center, children: [
            Pill(s.t('Your vote is in', 'صوتك وصل'), icon: Icons.check),
            TextButton(onPressed: () => setState(() => _changing = true), child: Text(s.t('Change it', 'غيّره'))),
          ])
        else if (canVote) ...[
          Text(s.t('Who was the best on the pitch? Your vote is secret.', 'مين كان أحسن واحد في الماتش؟ صوتك سري.')),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final id in squad)
              if (id != me)
                ActionChip(
                  label: Text(view.nameOf(id)),
                  onPressed: () async {
                    final ok = await runAction(
                      context,
                      () => context.services.api.voteMvp(view.group.id, game.id, id).then((_) => true),
                      success: s.t('Vote in. Thanks!', 'صوتك وصل. شكرًا!'),
                    );
                    if (ok == true && mounted) setState(() => _changing = false);
                  },
                ),
          ]),
        ],
        if (view.isAdmin)
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton(
              onPressed: () => runAction(context, () => context.services.api.closeMvpVoting(view.group.id, game.id)),
              child: Text(s.t('Close voting now', 'اقفل التصويت دلوقتي')),
            ),
          ),
      ]);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionTitle(s.t('Man of the match', 'نجم الماتش')),
      Card(child: Padding(padding: const EdgeInsets.all(16), child: body)),
    ]);
  }
}
