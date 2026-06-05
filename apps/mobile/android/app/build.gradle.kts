import java.util.Properties

plugins {
    id("com.android.application")
    id("com.google.gms.google-services")       // processes google-services.json
    id("com.google.firebase.crashlytics")      // uploads mapping files for deobfuscated crash reports
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// local.properties is gitignored and not automatically exposed as Gradle project
// properties. Load it explicitly so secrets like GOOGLE_MAPS_API_KEY can be
// injected into AndroidManifest.xml via manifestPlaceholders.
val localProperties = Properties().also { props ->
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { props.load(it) }
}

android {
    namespace = "uk.co.betterofflocal.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "uk.co.betterofflocal.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        // Inject Google Maps API key into AndroidManifest.xml.
        // Set GOOGLE_MAPS_API_KEY=AIza... in android/local.properties.
        manifestPlaceholders["GOOGLE_MAPS_API_KEY"] =
            localProperties.getProperty("GOOGLE_MAPS_API_KEY") ?: ""
    }

    buildTypes {
        release {
            // PRODUCTION TODO: Replace debug signing with a real keystore.
            // Create a keystore, add signing config in gradle, reference via
            // environment variables — never commit the .jks file.
            // See: https://developer.android.com/studio/publish/app-signing
            signingConfig = signingConfigs.getByName("debug")
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
