plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.rainy2fa.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.rainy2fa.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 3
        versionName = "1.1.1"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            storeFile = rootProject.file("release.jks")
            // 请通过环境变量或 gradle 属性传入喵！不要硬编码在源码里
            storePassword = System.getenv("KEYSTORE_PASSWORD") ?: project.findProperty("keystorePassword") as String? ?: "rainy2fa"
            keyAlias = System.getenv("KEYSTORE_ALIAS") ?: project.findProperty("keystoreAlias") as String? ?: "rainy2fa"
            keyPassword = System.getenv("KEY_PASSWORD") ?: project.findProperty("keyPassword") as String? ?: "rainy2fa"
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            isJniDebuggable = false
        }
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }
    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlin {
        jvmToolchain(17)
    }
    buildFeatures {
        compose = true
    }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    // 根据Manifest需要的生物识别等权限可能需要biometric
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.material.icons.extended)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}
