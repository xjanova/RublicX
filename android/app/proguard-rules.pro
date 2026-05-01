# Keep the JS bridge interface so the WebView can call into Kotlin.
-keep class online.rublicx.app.WebBridge { *; }
-keep class online.rublicx.app.** { *; }

# Standard WebView keeps
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
