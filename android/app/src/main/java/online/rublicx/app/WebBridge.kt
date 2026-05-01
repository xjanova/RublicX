package online.rublicx.app

import android.app.Activity
import android.webkit.JavascriptInterface

/**
 * JS bridge exposed as `window.RublicXNative` so the web bundle can detect that it's running
 * inside the Android shell (vs. Pages) and respond accordingly. The web layer's update
 * banner uses this to skip its own SW-based update flow when native updates are available.
 */
class WebBridge(private val activity: Activity) {

    @JavascriptInterface
    fun isNative(): Boolean = true

    @JavascriptInterface
    fun appVersion(): String = BuildConfig.VERSION_NAME

    @JavascriptInterface
    fun appVersionCode(): Int = BuildConfig.VERSION_CODE

    @JavascriptInterface
    fun openExternalBrowser(url: String) {
        try {
            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
            intent.flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            activity.startActivity(intent)
        } catch (_: Throwable) {}
    }
}
