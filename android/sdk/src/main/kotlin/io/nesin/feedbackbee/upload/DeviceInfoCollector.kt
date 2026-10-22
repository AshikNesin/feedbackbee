package io.nesin.feedbackbee.upload

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

internal fun collectDeviceInfo(context: Context): DeviceInfo {
    val metrics = context.resources.displayMetrics
    return DeviceInfo(
        appVersion = appVersion(context),
        osVersion = Build.VERSION.SDK_INT.toString(),
        deviceModel = Build.MODEL,
        screenWidth = metrics.widthPixels,
        screenHeight = metrics.heightPixels,
    )
}

private fun appVersion(context: Context): String? = try {
    val packages = context.packageManager
    val info = if (Build.VERSION.SDK_INT >= 33) {
        packages.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(0))
    } else {
        @Suppress("DEPRECATION")
        packages.getPackageInfo(context.packageName, 0)
    }
    info.versionName
} catch (_: PackageManager.NameNotFoundException) {
    null
}
