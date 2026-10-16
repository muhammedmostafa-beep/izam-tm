// Champions photos. The real app keeps them in Cloud Storage; the demo build keeps them in memory.

import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/painting.dart';
import 'package:flutter/services.dart';

abstract interface class PhotoStore {
  Future<void> putPng(String path, Uint8List bytes);

  /// The same future for the same path, so widgets don't flicker while they rebuild.
  Future<ImageProvider> image(String path);
}

class FirebasePhotoStore implements PhotoStore {
  FirebasePhotoStore(this._storage);

  final FirebaseStorage _storage;
  final _images = <String, Future<ImageProvider>>{};

  @override
  Future<void> putPng(String path, Uint8List bytes) async {
    await _storage.ref(path).putData(bytes, SettableMetadata(contentType: 'image/png'));
    _images.remove(path);
  }

  @override
  Future<ImageProvider> image(String path) =>
      _images.putIfAbsent(path, () async => NetworkImage(await _storage.ref(path).getDownloadURL()));
}
