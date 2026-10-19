import 'package:flutter/material.dart';

import '../l10n.dart';
import '../services/services.dart';
import '../theme.dart';
import '../widgets.dart';

/// Start a group: the creator becomes its organizer. Defaults: Thursday 9 PM,
/// poll opens Sunday 12 PM, 18 players in 3 teams; all editable later.
class CreateGroupScreen extends StatefulWidget {
  const CreateGroupScreen({super.key});

  @override
  State<CreateGroupScreen> createState() => _CreateGroupScreenState();
}

class _CreateGroupScreenState extends State<CreateGroupScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _venue = TextEditingController();
  final _me = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _venue.dispose();
    _me.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (!_form.currentState!.validate()) return;
    final navigator = Navigator.of(context);
    final id = await runAction(
      context,
      () => context.services.api.createGroup(
        name: _name.text.trim(),
        venue: _venue.text.trim(),
        organizerName: _me.text.trim(),
        language: context.s.lang,
      ),
    );
    if (id != null) navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    String? required(String? v) => (v ?? '').trim().isEmpty ? s.t('Required', 'مطلوب') : null;
    return Scaffold(
      appBar: AppBar(title: Text(s.t('START A GROUP', 'جروب جديد'))),
      body: Form(
        key: _form,
        child: ListView(padding: const EdgeInsets.all(20), children: [
          TextFormField(
            controller: _name,
            validator: required,
            decoration: InputDecoration(labelText: s.t('Group name', 'اسم الجروب'), hintText: 'Thursday Night Football'),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _venue,
            validator: required,
            decoration: InputDecoration(labelText: s.t('Pitch', 'الملعب'), hintText: 'New Cairo Arena · Pitch 3'),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _me,
            validator: required,
            decoration: InputDecoration(labelText: s.t('Your name, as players know you', 'اسمك زي ما اللعيبة عارفينك')),
          ),
          const SizedBox(height: 12),
          Text(
            s.t(
              'Starts as Thursday 9:00 PM, poll opens Sunday 12:00 PM, 18 players in 3 teams. Change any of it in Game settings.',
              'هيبدأ بالخميس ٩:٠٠ م، التصويت يفتح الحد ١٢:٠٠ م، ١٨ لعيب في ٣ فرق. تقدر تغير ده من إعدادات الماتش.',
            ),
            style: const TextStyle(color: Palette.muted, fontSize: 13),
          ),
          const SizedBox(height: 28),
          BusyButton(label: s.t('Create group', 'اعمل الجروب'), onPressed: _create),
        ]),
      ),
    );
  }
}
