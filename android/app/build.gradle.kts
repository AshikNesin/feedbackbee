plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "io.nesin.feedbackbee.demo"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.nesin.feedbackbee.demo"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        // Debug talks to a Worker on the host machine (10.0.2.2 is the emulator's alias for localhost).
        // Point it elsewhere with -Pfeedbackbee.endpoint=https://...; release uses FeedbackBee.DEFAULT_ENDPOINT.
        val localWorker = providers.gradleProperty("feedbackbee.endpoint").orElse("http://10.0.2.2:8787").get()
        debug { buildConfigField("String", "FEEDBACKBEE_ENDPOINT", "\"$localWorker\"") }
        release { buildConfigField("String", "FEEDBACKBEE_ENDPOINT", "\"\"") }
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(project(":sdk"))

    implementation(platform("androidx.compose:compose-bom:2024.10.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.3")
}
