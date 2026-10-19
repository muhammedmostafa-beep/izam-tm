// Web push for the web app (also used by iPhone players who add it to their
// home screen). Fill in the same values as config/firebase.json; see README.md.
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

const config = {
  apiKey: 'FIREBASE_API_KEY',
  projectId: 'FIREBASE_PROJECT_ID',
  messagingSenderId: 'FIREBASE_MESSAGING_SENDER_ID',
  appId: 'FIREBASE_WEB_APP_ID',
};

if (!config.apiKey.startsWith('FIREBASE_')) {
  firebase.initializeApp(config);
  // Shows notifications that arrive while the app is closed.
  firebase.messaging();
}
