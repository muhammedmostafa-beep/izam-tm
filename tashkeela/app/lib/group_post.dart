// Ready-made posts the organizer shares to the WhatsApp group in one tap.

import 'l10n.dart';
import 'models.dart';
import 'roster_line.dart';

String squadPost({
  required S s,
  required Group group,
  required Game game,
  required RosterLine line,
  required Map<String, Member> members,
  String? link,
}) {
  String name(Entry e) {
    final gk = members[e.memberId]?.isGoalkeeper ?? false;
    final pending = e.state == EntryState.offered ? s.t(' (confirming)', ' (بيأكد)') : '';
    return '${e.name}${gk ? s.t(' (GK)', ' (حارس)') : ''}$pending';
  }

  final b = StringBuffer()
    ..writeln(s.t('${group.name}, week ${s.n(game.weekNumber)}', '${group.name}، الأسبوع ${s.n(game.weekNumber)}'))
    ..writeln('${s.when(game.kickoffAt)}${s.sep}${group.venue}')
    ..writeln()
    ..writeln(s.t('Squad (${s.n(line.squad.length)}/${s.n(line.squadSize)})',
        'التشكيلة (${s.n(line.squad.length)}/${s.n(line.squadSize)})'));
  for (final (i, e) in line.squad.indexed) {
    b.writeln('${s.n(i + 1)}. ${name(e)}');
  }
  if (line.openSpots > 0) {
    b.writeln(s.t('${s.n(line.openSpots)} spots open', 'فاضل ${s.n(line.openSpots)} مكان'));
  }
  if (line.reserves.isNotEmpty) {
    b
      ..writeln()
      ..writeln(s.t('Reserves', 'الاحتياطي'));
    for (final (i, e) in line.reserves.indexed) {
      b.writeln('${s.t('R', 'ح')}${s.n(i + 1)}. ${name(e)}');
    }
  }
  if (link != null && link.isNotEmpty) {
    b
      ..writeln()
      ..writeln(s.t('Join, drop out or confirm: $link', 'للتسجيل أو الاعتذار أو التأكيد: $link'));
  }
  return b.toString().trimRight();
}

String championsCaption({required S s, required Group group, required int week, required String winner}) => s.t(
      'Champions of week ${s.n(week)}: Team $winner. ${group.name}',
      'أبطال الأسبوع ${s.n(week)}: فريق $winner. ${group.name}',
    );

/// The text drawn around the champions photo (Latin letters, see champions_icon.dart).
String championsRing({required int week, required String winner}) =>
    'CHAMPIONS · WEEK $week · TEAM ${winner.toUpperCase()}';
