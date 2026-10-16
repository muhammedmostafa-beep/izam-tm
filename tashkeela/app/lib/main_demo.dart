// The demo app: the real screens on a simulated week, with no Firebase project.
// Build it with `flutter build apk -t lib/main_demo.dart -P demo=true`.

import 'package:flutter/widgets.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';
import 'demo/demo_backend.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  registerFontLicenses();
  await initializeDateFormatting();
  runApp(TashkeelaApp(services: DemoBackend().services));
}
