import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';

import '../champions_icon.dart';
import '../group_post.dart';
import '../l10n.dart';
import '../models.dart';
import '../services/services.dart';
import '../theme.dart';
import '../widgets.dart';

/// After the game: pick the winners, frame their photo as the group icon,
/// save it and share it to the WhatsApp group.
class ResultScreen extends StatefulWidget {
  const ResultScreen({super.key, required this.group});

  final Group group;

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  late final Future<Game?> _game = context.services.repo.lastPlayedGame(widget.group.id);
  late String _winner = widget.group.rules.teamNames.first;
  Uint8List? _icon;
  ui.Image? _photo;

  Future<void> _pickPhoto(int week) async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2048, maxHeight: 2048);
    if (file == null) return;
    _photo = await decodeImage(await file.readAsBytes());
    await _render(week);
  }

  Future<void> _render(int week) async {
    final photo = _photo;
    if (photo == null) return;
    final icon = await renderChampionsIcon(photo: photo, ringText: championsRing(week: week, winner: _winner));
    if (mounted) setState(() => _icon = icon);
  }

  Future<void> _saveAndShare(Game game) async {
    final s = context.s;
    final services = context.services;
    final icon = _icon;
    String? path;
    final saved = await runAction(context, () async {
      if (icon != null) {
        path = 'groups/${widget.group.id}/champions/${game.id}.png';
        await services.photos.putPng(path!, icon);
      }
      await services.api.recordResult(widget.group.id, game.id, winner: _winner, photoPath: path);
      return true;
    });
    if (saved != true || !mounted) return;
    final caption = championsCaption(s: s, group: widget.group, week: game.weekNumber, winner: _winner);
    await SharePlus.instance.share(ShareParams(
      text: caption,
      files: icon == null ? null : [XFile.fromData(icon, mimeType: 'image/png', name: 'champions-week-${game.weekNumber}.png')],
      fileNameOverrides: icon == null ? null : ['champions-week-${game.weekNumber}.png'],
    ));
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.s;
    final teams = widget.group.rules.teamNames;
    return Scaffold(
      appBar: AppBar(title: Text(s.t('RESULT', 'النتيجة'))),
      body: FutureBuilder<Game?>(
        future: _game,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const Loading();
          final game = snap.data;
          if (game == null) {
            return Message(icon: Icons.sports_soccer, title: s.t('No game played yet', 'لسه مفيش ماتش اتلعب'));
          }
          return ListView(padding: const EdgeInsets.all(16), children: [
            Text(s.t('WHO WON?', 'مين كسب؟'), style: display(32)),
            Text(s.t('Week ${s.n(game.weekNumber)}${s.sep}${s.day(game.kickoffAt)}', 'الأسبوع ${s.n(game.weekNumber)}${s.sep}${s.day(game.kickoffAt)}'),
                style: const TextStyle(color: Palette.muted)),
            const SizedBox(height: 16),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final (i, team) in teams.indexed)
                ChoiceChip(
                  label: Text(team),
                  selected: _winner == team,
                  avatar: CircleAvatar(backgroundColor: Palette.bibs[i % Palette.bibs.length]),
                  onSelected: (_) {
                    setState(() => _winner = team);
                    _render(game.weekNumber);
                  },
                ),
            ]),
            const SizedBox(height: 24),
            Center(
              child: _icon == null
                  ? Container(
                      width: 240,
                      height: 240,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Palette.line, width: 2),
                      ),
                      child: const Icon(Icons.add_a_photo_outlined, size: 48, color: Palette.muted),
                    )
                  : ClipOval(child: Image.memory(_icon!, width: 240, height: 240)),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => _pickPhoto(game.weekNumber),
              icon: const Icon(Icons.photo_library_outlined),
              label: Text(_icon == null ? s.t("Add the winners' photo", 'ضيف صورة الكسبانين') : s.t('Change photo', 'غيّر الصورة')),
            ),
            const SizedBox(height: 24),
            BusyButton(
              icon: Icons.ios_share,
              label: s.t('Save & share to the group', 'احفظ وشارك في الجروب'),
              onPressed: () => _saveAndShare(game),
            ),
            const SizedBox(height: 12),
            Text(
              s.t(
                'Share the image to the group, then set it as the group picture: group info > edit picture.',
                'شارك الصورة في الجروب، وبعدين خليها صورة الجروب: بيانات الجروب > تعديل الصورة.',
              ),
              style: const TextStyle(color: Palette.muted, fontSize: 13),
            ),
          ]);
        },
      ),
    );
  }
}
