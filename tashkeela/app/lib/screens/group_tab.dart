import 'package:flutter/material.dart';

import '../l10n.dart';
import '../levels.dart';
import '../models.dart';
import '../services/services.dart';
import '../theme.dart';
import '../widgets.dart';
import 'create_group_screen.dart';
import 'home_shell.dart';
import 'result_screen.dart';
import 'settings_screen.dart';

class GroupTab extends StatelessWidget {
  const GroupTab({super.key, required this.view});

  final GroupView view;

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final services = context.services;
    final me = view.me;
    final language = LanguageScope.of(context);

    return ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
      Text(view.group.name.toUpperCase(), style: display(30)),
      Text(view.group.venue, style: const TextStyle(color: Palette.muted)),
      if (services.demoPanel case final demoPanel?) demoPanel(context),

      SectionTitle(s.t('Me', 'أنا')),
      Card(
        child: Column(children: [
          if (me != null)
            SwitchListTile(
              title: Text(s.t('WhatsApp reminders', 'تنبيهات واتساب')),
              subtitle: Text(s.t('Poll opening, spot offers and match day', 'فتح التصويت، عرض مكان، ويوم الماتش')),
              value: me.whatsappOptIn,
              onChanged: (v) => runAction(context, () => services.api.updateMyPreferences(view.group.id, whatsappOptIn: v)),
            ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.translate),
            title: Text(s.t('Language', 'اللغة')),
            trailing: SegmentedButton<String>(
              segments: const [ButtonSegment(value: 'ar', label: Text('عربي')), ButtonSegment(value: 'en', label: Text('English'))],
              selected: {language.value},
              showSelectedIcon: false,
              onSelectionChanged: (v) {
                language.value = v.first;
                if (me != null) {
                  runAction(context, () => services.api.updateMyPreferences(view.group.id, language: v.first));
                }
              },
            ),
          ),
        ]),
      ),

      if (view.isAdmin) ...[
        SectionTitle(s.t('Organizer', 'المنظم')),
        Card(
          child: Column(children: [
            ListTile(
              leading: const Icon(Icons.tune),
              title: Text(s.t('Game settings', 'إعدادات الماتش')),
              subtitle: Text(s.t(
                '${s.weekday(view.group.schedule.matchWeekday)} ${view.group.schedule.matchTime}${s.sep}${s.n(view.group.rules.squadSize)} players',
                '${s.weekday(view.group.schedule.matchWeekday)} ${view.group.schedule.matchTime}${s.sep}${s.n(view.group.rules.squadSize)} لعيب',
              )),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SettingsScreen(group: view.group))),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.emoji_events_outlined),
              title: Text(s.t('Record the winners', 'سجّل الفريق الكسبان')),
              subtitle: Text(s.t('Champions photo for the group picture', 'صورة الأبطال لصورة الجروب')),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ResultScreen(group: view.group))),
            ),
          ]),
        ),
      ],

      SectionTitle(
        s.t('Members', 'الأعضاء'),
        trailing: Text(s.n(view.members.length), style: display(18, color: Palette.muted)),
      ),
      Card(
        child: Column(children: [
          for (final m in view.members)
            ListTile(
              leading: Avatar(m.name),
              title: Text(m.name),
              subtitle: Text(m.phone, textDirection: TextDirection.ltr, style: const TextStyle(fontSize: 12)),
              trailing: Wrap(spacing: 6, children: [
                if (view.isAdmin) Pill(levelBadge(s, view.levelOf(m.id)), color: levelColor(view.levelOf(m.id))),
                if (m.isGoalkeeper) Pill(s.t('GK', 'حارس'), color: Palette.sky),
                if (m.isRegular)
                  Tooltip(
                    message: s.t('Regular', 'أساسي'),
                    child: const Icon(Icons.star_rounded, size: 20, color: Palette.amber),
                  ),
                if (m.isAdmin) Pill(s.t('Organizer', 'منظم')),
                if (m.uid == null) Pill(s.t('No app', 'من غير تطبيق'), color: Palette.muted),
              ]),
              onTap: view.isAdmin ? () => _editMember(context, m) : null,
            ),
        ]),
      ),
      if (view.isAdmin) ...[
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () => _addMember(context),
          icon: const Icon(Icons.person_add),
          label: Text(s.t('Add a member', 'ضيف عضو')),
        ),
      ],

      const SizedBox(height: 28),
      TextButton.icon(
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CreateGroupScreen())),
        icon: const Icon(Icons.add),
        label: Text(s.t('Start another group', 'اعمل جروب تاني')),
      ),
      TextButton.icon(
        onPressed: () async {
          await services.push.unregister(view.uid);
          await services.auth.signOut();
        },
        icon: const Icon(Icons.logout),
        label: Text(s.t('Sign out', 'خروج')),
      ),
      if (me != null)
        TextButton.icon(
          style: TextButton.styleFrom(foregroundColor: Palette.coral),
          onPressed: () => _leave(context),
          icon: const Icon(Icons.exit_to_app),
          label: Text(s.t('Leave this group', 'اخرج من الجروب')),
        ),
      TextButton.icon(
        style: TextButton.styleFrom(foregroundColor: Palette.coral),
        onPressed: () => _deleteAccount(context),
        icon: const Icon(Icons.delete_forever_outlined),
        label: Text(s.t('Delete my account and data', 'امسح حسابي وبياناتي')),
      ),
    ]);
  }

  /// A sheet that asks before something that can't be undone. True: go ahead.
  Future<bool> _confirm(BuildContext context, {required String title, required String body, required String action}) async {
    final s = context.s;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      builder: (sheet) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(title.toUpperCase(), style: display(28)),
          const SizedBox(height: 12),
          Text(body),
          const SizedBox(height: 20),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Palette.coral),
            onPressed: () => Navigator.of(sheet).pop(true),
            child: Text(action),
          ),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: () => Navigator.of(sheet).pop(false), child: Text(s.t('Cancel', 'إلغاء'))),
        ]),
      ),
    );
    return ok == true;
  }

  Future<void> _leave(BuildContext context) async {
    final s = context.s;
    final ok = await _confirm(
      context,
      title: s.t('Leave ${view.group.name}?', 'تخرج من ${view.group.name}؟'),
      body: s.t(
        "You'll come off every poll you're on, and stop getting its messages. The organizer can add you again later.",
        'هتتشال من أي تصويت إنت فيه، ومش هيوصلك رسايله. المنظم يقدر يضيفك تاني بعدين.',
      ),
      action: s.t('Leave the group', 'اخرج من الجروب'),
    );
    if (!ok || !context.mounted) return;
    await runAction(context, () => context.services.api.leaveGroup(view.group.id));
  }

  Future<void> _deleteAccount(BuildContext context) async {
    final s = context.s;
    final services = context.services;
    final ok = await _confirm(
      context,
      title: s.t('Delete your account?', 'تمسح حسابك؟'),
      body: s.t(
        'You leave every group, and your name and number are erased. Past games keep only "Former member", so '
            "the season table still adds up. This can't be undone.",
        'هتخرج من كل الجروبات، واسمك ورقمك هيتمسحوا. الماتشات اللي فاتت هيفضل فيها "عضو سابق" بس، عشان جدول الموسم '
            'يفضل مظبوط. مفيش رجوع في الخطوة دي.',
      ),
      action: s.t('Delete everything', 'امسح كل حاجة'),
    );
    if (!ok || !context.mounted) return;
    final done = await runAction(context, () => services.api.deleteAccount().then((_) => true));
    if (done != true) return;
    await services.push.unregister(view.uid);
    await services.auth.signOut();
  }

  Future<void> _addMember(BuildContext context) async {
    final s = context.s;
    final api = context.services.api;
    final name = TextEditingController();
    final phone = TextEditingController();
    var goalkeeper = false;
    var language = 'ar';
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.viewInsetsOf(sheet).bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(s.t('ADD A MEMBER', 'ضيف عضو'), style: display(26)),
            const SizedBox(height: 16),
            TextField(controller: name, decoration: InputDecoration(labelText: s.t('Name', 'الاسم'))),
            const SizedBox(height: 12),
            TextField(
              controller: phone,
              keyboardType: TextInputType.phone,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(labelText: s.t('WhatsApp number', 'رقم الواتساب'), hintText: '010 0123 4567'),
            ),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: goalkeeper,
              onChanged: (v) => setSheet(() => goalkeeper = v ?? false),
              title: Text(s.t('Goalkeeper', 'حارس مرمى')),
            ),
            Row(children: [
              Expanded(child: Text(s.t('Messages in', 'الرسايل بـ'))),
              SegmentedButton<String>(
                segments: const [ButtonSegment(value: 'ar', label: Text('عربي')), ButtonSegment(value: 'en', label: Text('English'))],
                selected: {language},
                showSelectedIcon: false,
                onSelectionChanged: (v) => setSheet(() => language = v.first),
              ),
            ]),
            const SizedBox(height: 20),
            BusyButton(
              label: s.t('Add', 'ضيف'),
              onPressed: () async {
                final navigator = Navigator.of(sheet);
                final ok = await runAction(
                  sheet,
                  () => api
                      .addMember(view.group.id,
                          name: name.text.trim(), phone: phone.text.trim(), isGoalkeeper: goalkeeper, language: language)
                      .then((_) => true),
                  success: s.t('${name.text.trim()} was added.', '${name.text.trim()} اتضاف.'),
                );
                if (ok == true) navigator.pop();
              },
            ),
          ]),
        ),
      ),
    );
  }

  Future<void> _editMember(BuildContext context, Member m) async {
    final s = context.s;
    final api = context.services.api;
    final isSelf = m.uid == view.uid;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheet) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Text(m.name.toUpperCase(), style: display(26)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
            child: Text(s.t('Level (only organizers see this)', 'المستوى (المنظمين بس اللي بيشوفوه)'),
                style: const TextStyle(color: Palette.muted, fontSize: 13)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Wrap(spacing: 6, runSpacing: 6, children: [
              for (final level in levels)
                ChoiceChip(
                  label: Text(levelLabel(s, level)),
                  selected: view.levelOf(m.id) == level,
                  onSelected: (_) {
                    Navigator.of(sheet).pop();
                    runAction(context, () => api.setMemberLevel(view.group.id, m.id, level),
                        success: s.t('${m.name}: ${levelLabel(s, level)}', '${m.name}: ${levelLabel(s, level)}'));
                  },
                ),
            ]),
          ),
          ListTile(
            leading: const Icon(Icons.sports_handball),
            title: Text(m.isGoalkeeper ? s.t('Not a goalkeeper', 'مش حارس') : s.t('Mark as goalkeeper', 'خليه حارس')),
            onTap: () {
              Navigator.of(sheet).pop();
              runAction(context, () => api.updateMember(view.group.id, m.id, isGoalkeeper: !m.isGoalkeeper));
            },
          ),
          ListTile(
            leading: const Icon(Icons.star_outline),
            title: Text(m.isRegular ? s.t('Not a regular', 'مش أساسي') : s.t('Mark as a regular', 'خليه أساسي')),
            subtitle: Text(view.group.rules.regularsHeadStartMinutes > 0
                ? s.t('Regulars can vote ${s.n(view.group.rules.regularsHeadStartMinutes)} minutes early',
                    'الأساسيين يصوتوا قبل الكل بـ${s.n(view.group.rules.regularsHeadStartMinutes)} دقيقة')
                : s.t('Turn on the head start in Game settings > Priority', 'شغّل الأولوية من إعدادات الماتش')),
            onTap: () {
              Navigator.of(sheet).pop();
              runAction(context, () => api.updateMember(view.group.id, m.id, isRegular: !m.isRegular));
            },
          ),
          if (!isSelf)
            ListTile(
              leading: const Icon(Icons.admin_panel_settings_outlined),
              title: Text(m.isAdmin ? s.t('Make a player', 'خليه لعيب عادي') : s.t('Make co-organizer', 'خليه منظم معاك')),
              subtitle: m.uid == null && !m.isAdmin
                  ? Text(s.t('Takes effect once they sign in', 'هيتفعل لما يسجل دخول'))
                  : null,
              onTap: () {
                Navigator.of(sheet).pop();
                runAction(context, () => api.updateMember(view.group.id, m.id, role: m.isAdmin ? 'player' : 'admin'));
              },
            ),
          if (!isSelf)
            ListTile(
              leading: const Icon(Icons.person_remove_outlined, color: Palette.coral),
              title: Text(s.t('Remove from the group', 'شيله من الجروب'), style: const TextStyle(color: Palette.coral)),
              onTap: () {
                Navigator.of(sheet).pop();
                runAction(context, () => api.removeMember(view.group.id, m.id),
                    success: s.t('${m.name} was removed.', '${m.name} اتشال.'));
              },
            ),
          const SizedBox(height: 12),
        ]),
      ),
    );
  }
}
