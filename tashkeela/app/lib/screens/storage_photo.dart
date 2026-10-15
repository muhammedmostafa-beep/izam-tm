import 'package:flutter/material.dart';

import '../services/services.dart';
import '../theme.dart';

final _urls = <String, Future<String>>{};

/// A photo kept in Cloud Storage (champions photos), shown as a circle.
class StoragePhoto extends StatelessWidget {
  const StoragePhoto({super.key, required this.path, this.size = 56, this.fallback});

  final String? path;
  final double size;
  final Widget? fallback;

  @override
  Widget build(BuildContext context) {
    final placeholder = fallback ??
        Container(
          width: size,
          height: size,
          decoration: const BoxDecoration(color: Palette.raised, shape: BoxShape.circle),
          child: Icon(Icons.emoji_events_outlined, color: Palette.muted, size: size * 0.45),
        );
    final p = path;
    if (p == null) return placeholder;
    final url = _urls.putIfAbsent(p, () => context.services.storage.ref(p).getDownloadURL());
    return FutureBuilder<String>(
      future: url,
      builder: (context, snap) {
        if (!snap.hasData) return placeholder;
        return ClipOval(
          child: Image.network(snap.data!, width: size, height: size, fit: BoxFit.cover,
              errorBuilder: (_, _, _) => placeholder),
        );
      },
    );
  }
}
