# Tashkeela

The weekly football poll for our group, as an app. The poll opens itself at
the agreed minute, the first 18 are in, everyone after is a numbered reserve,
and when someone drops out the next reserve is offered the spot automatically.
Reminders go out on WhatsApp and as push notifications; the organizer shares
the list and the champions photo to the WhatsApp group in one tap.

Plan and design: [`docs/football-app/app-plan.md`](../docs/football-app/app-plan.md),
[`docs/football-app/design/`](../docs/football-app/design/).

```
tashkeela/
  app/          Flutter app (Android, web; iPhone players use the web app)
  functions/    Cloud Functions (TypeScript): the poll rules, scheduler, WhatsApp
  firestore.rules, storage.rules, firestore.indexes.json, firebase.json
```

## How it works

- **Every rule runs on the server.** The app only reads; joining, dropping out,
  confirming and passing are Cloud Functions calls that run inside a
  Firestore transaction. Each vote gets the next sequence number, so "who
  voted first" is never in doubt (20 simultaneous votes are covered by a test).
- **The line.** The first `squadSize` active entries (by sequence number) are
  the squad; the rest are the reserve queue, in order.
- **Promotion.** When a squad player drops out, the next reserve gets an
  offer: 2 hours to confirm (30 minutes on match day, never past kick-off).
  Time overnight (00:00 to 08:00 by default) doesn't count. No answer or
  "Pass" moves the offer to the next reserve.
- **Late drop-outs.** Dropping out within 24 hours of kick-off is marked as
  late and shown in the list.
- **Scheduler.** `tick` runs every minute: it creates the week's game, opens
  the poll on time, expires offers and sends the match-day reminder. Every
  change is logged under `games/{gameId}/log`.

All the numbers above are per-group settings (Group tab > Game settings).

## Run it locally (no Firebase project needed)

Needs Node 22, Java 17+ (for the emulators) and Flutter 3.47+.

```sh
cd tashkeela/functions
npm install
npm run build
npx firebase emulators:start --project demo-tashkeela --only auth,firestore,functions,storage
```

The emulators need placeholder values for the WhatsApp secrets. Create
`functions/.secret.local` (it's ignored by git):

```
WHATSAPP_TOKEN=unused
WHATSAPP_APP_SECRET=unused
WHATSAPP_VERIFY_TOKEN=unused
```

In another terminal:

```sh
cd tashkeela/app
flutter run -d chrome          # or an Android emulator
```

With no Firebase settings the app uses the local emulators. Sign in with any
number; the code appears in the emulator log ("To verify the phone number …").
The scheduler doesn't run in the emulator: use **Open the poll now** on the
This week tab.

## Tests

```sh
cd tashkeela/functions
npm test                 # rules, time zones, messages: no emulator needed
npm run test:emulator    # transactions, scheduler, WhatsApp buttons, Firestore and Storage rules

cd ../app
flutter analyze
flutter test
```

Behind an HTTPS proxy, the Storage emulator sends its rule lookups into
Firestore through the proxy (it ignores `NO_PROXY`), and every photo upload is
refused. Run the emulators with the proxy variables unset, for example
`env -u HTTPS_PROXY -u https_proxy npm run test:emulator`.

## Set it up for real

### 1. Firebase project

1. Create a project at console.firebase.google.com and switch it to the
   **Blaze** (pay as you go) plan. Cloud Functions and the scheduler need it;
   a group this size stays inside the free quota.
2. **Firestore**: create the database in `europe-west1` (the functions run
   there too, close to Egypt).
3. **Authentication**: enable the **Phone** sign-in provider.
4. **Storage**: enable it (champions photos).
5. Register two apps in Project settings: **Android** (package
   `app.tashkeela.tashkeela`) and **Web**.

### 2. Deploy the backend

Run these from `tashkeela/functions` (the CLI finds `../firebase.json`):

```sh
npx firebase login
npx firebase use --add                                 # pick your project
cp .env.example .env                                   # fill in APP_URL; WhatsApp ID later
npx firebase functions:secrets:set WHATSAPP_TOKEN          # "none" until WhatsApp is set up
npx firebase functions:secrets:set WHATSAPP_APP_SECRET     # "none" until WhatsApp is set up
npx firebase functions:secrets:set WHATSAPP_VERIFY_TOKEN   # any long random string
npx firebase deploy --only functions,firestore,storage
```

### 3. Configure the app

Either run `flutterfire configure` in `app/` (it rewrites
`lib/firebase_options.dart`), or copy `app/config/firebase.example.json` to
`app/config/firebase.json`, fill in the values from Project settings, and
pass it to every build with `--dart-define-from-file=config/firebase.json`.

### 4. Web app (and iPhone players)

```sh
cd tashkeela/app
flutter build web --release --dart-define-from-file=config/firebase.json
cd ../functions && npx firebase deploy --only hosting
```

The address is `https://<project-id>.web.app`. Pin it in the WhatsApp group
description. iPhone players open it in Safari and choose **Share > Add to
Home Screen**; push notifications work from the home-screen app on iOS 16.4
and later.

For web push, create a key pair under Project settings > Cloud Messaging >
Web Push certificates, put the public key in `FIREBASE_VAPID_KEY`, and fill
in the four values in `app/web/firebase-messaging-sw.js`.

### 5. Android app

```sh
cd tashkeela/app
flutter build apk --release --dart-define-from-file=config/firebase.json
cd ../functions && npx firebase appdistribution:distribute \
  ../app/build/app/outputs/flutter-apk/app-release.apk --app <FIREBASE_ANDROID_APP_ID> --testers-file players.txt
```

Firebase App Distribution is free: players get an install link and update
alerts, with no Play Store account needed. Phone sign-in on Android also
needs the app's SHA-256 fingerprint in Project settings > Your apps
(`cd android && ./gradlew signingReport`). Set up your own release signing
key before sharing builds widely
(see the [Flutter docs](https://docs.flutter.dev/deployment/android#sign-the-app)).

### 6. WhatsApp (optional, about 62 EGP a month)

1. Get a spare SIM whose number is **not** already on WhatsApp.
2. At developers.facebook.com create a **Business** app, add **WhatsApp**,
   and register the number. Note the **Phone number ID**, and create a
   permanent access token for a System User in Business Settings.
3. In WhatsApp Manager create these three **Utility** templates, each in
   Arabic (`ar`) and English (`en`). Keep the button order: the first button
   always means yes.

   | Name | Body (English) | Quick-reply buttons |
   | --- | --- | --- |
   | `tashkeela_poll_open` | The poll for {{1}} at {{2}} is open. {{3}} spots, first come first served. | I'm in · Not this week |
   | `tashkeela_spot_offered` | A spot opened up for {{1}}. You're next in line. Confirm by {{2}} or it goes to the next reserve. | Confirm · Pass |
   | `tashkeela_match_day` | Match day! Kick-off at {{1}}, {{2}}. You're in the squad of {{3}}. | none |

   Arabic bodies:

   - `tashkeela_poll_open`: التصويت مفتوح لماتش {{1}} في {{2}}. {{3}} مكان، الأسبق أولاً. (أنا جاي · مش الأسبوع ده)
   - `tashkeela_spot_offered`: فيه مكان فضي في ماتش {{1}}. إنت الدور عليك. أكد قبل {{2}} وإلا هيروح للاحتياطي اللي بعدك. (أكد · عدّي)
   - `tashkeela_match_day`: النهارده الماتش! البداية {{1}} في {{2}}. إنت ضمن تشكيلة الـ{{3}}.

4. Store the token and the app secret (App settings > Basic):

   ```sh
   cd tashkeela/functions
   npx firebase functions:secrets:set WHATSAPP_TOKEN
   npx firebase functions:secrets:set WHATSAPP_APP_SECRET
   ```

   Put the phone number ID in `functions/.env` as `WHATSAPP_PHONE_NUMBER_ID`
   and deploy the functions again.
5. In the Meta app, under WhatsApp > Configuration, set the webhook URL to
   the `whatsappWebhook` function's URL (printed by the deploy), the verify
   token to your `WHATSAPP_VERIFY_TOKEN`, and subscribe to `messages`.

Players can then tap **I'm in**, **Confirm** or **Pass** in WhatsApp
without the app. The sender's number decides who is acting, and every
delivery is checked against Meta's signature.

## Data

```
users/{uid}                               phone, groupIds, pushIds, language
groups/{groupId}                          name, venue, schedule, rules, reminders, adminUids, memberUids
groups/{groupId}/members/{memberId}       name, phone, uid, role, isGoalkeeper, whatsappOptIn, language
groups/{groupId}/games/{gameId}           kickoffAt, pollOpensAt, status, counts   (gameId = kick-off date)
groups/{groupId}/games/{gameId}/entries   one per player: seq, state, offer, drop-out
groups/{groupId}/games/{gameId}/log       every vote and change, for disputes
```

Only Cloud Functions write. Members can read their own groups; nobody else
can read anything (`firestore.rules`, tested in `functions/integration/rules.test.ts`).

## Not built yet

These are planned for later, once the group asks for them: team generator, payment tracker, stats and season
table, priority rules for regulars, and a native iPhone build.

Fonts (Barlow Condensed, DM Sans, IBM Plex Sans Arabic) are bundled under the
SIL Open Font License; see `app/assets/fonts/`.
