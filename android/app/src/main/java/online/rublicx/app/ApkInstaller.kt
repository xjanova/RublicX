package online.rublicx.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.result.ActivityResultLauncher
import androidx.core.content.FileProvider
import java.io.File

/**
 * Triggers Android's package installer for the downloaded APK. On Android 8+ the user must
 * grant the app the "Install unknown apps" permission — if missing we route them to the
 * appropriate Settings screen via [permissionLauncher] and they can return to retry.
 *
 * The downloaded APK MUST be signed with the same key as the currently installed app for
 * Android to allow the install — see KEYSTORE_SETUP.md.
 */
object ApkInstaller {

    fun install(
        activity: Activity,
        apk: File,
        permissionLauncher: ActivityResultLauncher<Intent>,
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !activity.packageManager.canRequestPackageInstalls()) {
            // Send user to "Install unknown apps" toggle for this package.
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${activity.packageName}"))
            permissionLauncher.launch(intent)
            return
        }

        val authority = "${activity.packageName}.fileprovider"
        val uri: Uri = FileProvider.getUriForFile(activity, authority, apk)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
        }
        activity.startActivity(intent)
    }
}
