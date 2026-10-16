import 'package:flutter/material.dart';

import '../l10n.dart';
import '../theme.dart';
import '../widgets.dart';
import 'demo_backend.dart';

/// Controls for the simulated week, shown at the top of the Group tab in the demo build.
class DemoPanel extends StatelessWidget {
  const DemoPanel({super.key, required this.backend});

  final DemoBackend backend;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionTitle(s.t('Demo', 'تجربة')),
      Card(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
            child: Text(
              s.t(
                "You're Ahmed S., the organizer. The other 21 players are simulated on this phone, "
                    'and nothing is sent to anyone. Closing the app starts everything over.',
                'إنت أحمد س.، المنظم. الـ٢١ لعيب التانيين متمثلين على الموبايل ده، '
                    'ومفيش حاجة بتتبعت لحد. لو قفلت التطبيق كل حاجة هتبدأ من الأول.',
              ),
              style: const TextStyle(color: Palette.muted, fontSize: 13),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.person_remove_outlined),
            title: Text(s.t('Someone drops out', 'حد يعتذر')),
            subtitle: Text(s.t('A player in the squad cancels and the spot goes down the reserve list',
                'لعيب من التشكيلة يعتذر والمكان يروح للاحتياطي')),
            onTap: () async {
              final name = await runAction(context, backend.dropSomeone);
              if (name != null && context.mounted) {
                ScaffoldMessenger.of(context)
                    .showSnackBar(SnackBar(content: Text(s.t('$name dropped out.', '$name اعتذر.'))));
              }
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.fast_forward_outlined),
            title: Text(s.t('Skip to after the game', 'روح لبعد الماتش')),
            subtitle: Text(s.t('Kick-off passes and the poll closes, so you can record the winners',
                'الماتش يبدأ والتصويت يتقفل، وتقدر تسجل الفريق الكسبان')),
            onTap: () => runAction(context, backend.skipToAfterTheGame,
                success: s.t('The game is over. Record the winners from This week.',
                    'الماتش خلص. سجل الفريق الكسبان من الأسبوع ده.')),
          ),
          const Divider(),
          SwitchListTile(
            secondary: const Icon(Icons.admin_panel_settings_outlined),
            title: Text(s.t('Organizer controls', 'أدوات المنظم')),
            subtitle: Text(s.t('Turn off to see the app as a regular player', 'اقفلها عشان تشوف التطبيق زي أي لعيب')),
            value: backend.isOrganizer,
            onChanged: backend.setOrganizer,
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.restart_alt),
            title: Text(s.t('Start the week again', 'ابدأ الأسبوع من الأول')),
            subtitle: Text(s.t('Back to the countdown before the poll opens', 'ارجع للعد التنازلي قبل ما التصويت يفتح')),
            onTap: () => runAction(context, backend.restartWeek,
                success: s.t('New week: the poll opens in a minute.', 'أسبوع جديد: التصويت هيفتح بعد دقيقة.')),
          ),
        ]),
      ),
    ]);
  }
}
