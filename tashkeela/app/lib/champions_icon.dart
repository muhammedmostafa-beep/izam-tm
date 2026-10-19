// Draws the winners' photo as a square group icon: the photo cropped to a
// circle, a lime ring, and "CHAMPIONS · WEEK 12 · TEAM LIME" around the top.

import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';

const _ground = Color(0xFF0B1410);
const _lime = Color(0xFFC8F04A);

Future<ui.Image> decodeImage(Uint8List bytes) async {
  final codec = await ui.instantiateImageCodec(bytes);
  return (await codec.getNextFrame()).image;
}

/// Returns PNG bytes, [size] x [size] pixels.
Future<Uint8List> renderChampionsIcon({
  required ui.Image photo,
  required String ringText,
  Color accent = _lime,
  int size = 1080,
  String? fontFamily,
}) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final s = size.toDouble();
  final center = Offset(s / 2, s / 2);
  final band = s * 0.11; // width of the ring that carries the text

  canvas.drawRect(Offset.zero & Size(s, s), Paint()..color = _ground);

  // Centre-crop the photo to a square and draw it inside the ring.
  final side = math.min(photo.width, photo.height).toDouble();
  final src = Rect.fromLTWH((photo.width - side) / 2, (photo.height - side) / 2, side, side);
  final inner = s / 2 - band;
  canvas.save();
  canvas.clipPath(Path()..addOval(Rect.fromCircle(center: center, radius: inner)));
  canvas.drawImageRect(photo, src, Rect.fromCircle(center: center, radius: inner), Paint()..filterQuality = FilterQuality.high);
  canvas.restore();

  // The ring.
  canvas.drawCircle(center, s / 2 - band / 2, Paint()
    ..color = accent
    ..style = PaintingStyle.stroke
    ..strokeWidth = band);

  // Letters laid out along the top of the ring, reading left to right.
  final textRadius = s / 2 - band / 2;
  final style = TextStyle(
    color: _ground,
    fontSize: band * 0.5,
    fontWeight: FontWeight.w800,
    letterSpacing: band * 0.04,
    fontFamily: fontFamily,
  );
  // Latin capitals only: per-letter drawing would break joined Arabic script.
  final glyphs = ringText.split('').map((c) {
    return TextPainter(text: TextSpan(text: c, style: style), textDirection: TextDirection.ltr)..layout();
  }).toList();
  final arcLength = glyphs.fold<double>(0, (sum, g) => sum + g.width);
  final sweep = math.min(arcLength / textRadius, math.pi * 1.6);
  final scale = sweep / (arcLength / textRadius);
  var angle = -math.pi / 2 - sweep / 2;
  for (final g in glyphs) {
    final a = g.width * scale / textRadius;
    final mid = angle + a / 2;
    canvas.save();
    canvas.translate(center.dx + textRadius * math.cos(mid), center.dy + textRadius * math.sin(mid));
    canvas.rotate(mid + math.pi / 2);
    canvas.scale(scale, 1);
    g.paint(canvas, Offset(-g.width / 2, -g.height / 2));
    canvas.restore();
    angle += a;
  }

  final image = await recorder.endRecording().toImage(size, size);
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  return data!.buffer.asUint8List();
}
