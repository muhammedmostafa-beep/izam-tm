plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// `flutter build apk -t lib/main_demo.dart -P demo=true` makes the demo app, which installs
// next to the real one.
val demo = project.findProperty("demo") == "true"

// Release builds for players are signed with the group's own key (see the "Tashkeela APK"
// workflow): TASHKEELA_KEYSTORE is the keystore's path, TASHKEELA_KEYSTORE_PASSWORD its password.
// Every update has to be signed with the same key. Without one, release builds use the debug key,
// which is fine for the demo only.
val releaseKeystore = System.getenv("TASHKEELA_KEYSTORE")?.let { file(it) }?.takeIf { it.exists() }

android {
    namespace = "app.tashkeela.tashkeela"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "app.tashkeela.tashkeela"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["appLabel"] = if (demo) "Tashkeela Demo" else "Tashkeela"
        if (demo) applicationIdSuffix = ".demo"
    }

    signingConfigs {
        if (releaseKeystore != null) {
            create("release") {
                storeFile = releaseKeystore
                storePassword = System.getenv("TASHKEELA_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("TASHKEELA_KEY_ALIAS") ?: "tashkeela"
                keyPassword = System.getenv("TASHKEELA_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName(if (releaseKeystore != null) "release" else "debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
