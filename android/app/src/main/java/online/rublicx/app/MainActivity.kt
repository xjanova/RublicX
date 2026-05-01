package online.rublicx.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import online.rublicx.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var webView: WebView
    private val scope = CoroutineScope(Dispatchers.Main)

    private val cameraPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            // After permission grant, retry pending camera request inside WebView
            pendingCameraRequest?.let {
                if (granted) it.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) else it.deny()
                pendingCameraRequest = null
            }
        }

    private val installerPermission =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            // No-op — caller will retry installation when user returns.
        }

    private var pendingCameraRequest: PermissionRequest? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Switch from splash theme to normal theme.
        setTheme(R.style.Theme_RublicX)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        WindowInsetsControllerCompat(window, binding.root).isAppearanceLightStatusBars = false

        webView = binding.webview
        configureWebView(webView)
        webView.loadUrl(BuildConfig.WEB_URL)

        binding.updateBanner.visibility = View.GONE
        binding.updateButton.setOnClickListener { triggerUpdate() }
        binding.updateLater.setOnClickListener { hideBanner() }

        // Check for updates on launch (single shot). The web app's SW handles in-session updates.
        checkForApkUpdate()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(wv: WebView) {
        WebView.setWebContentsDebuggingEnabled(true)
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            allowFileAccess = false
            allowContentAccess = false
            userAgentString = "$userAgentString RublicX/${BuildConfig.VERSION_NAME}"
        }
        wv.addJavascriptInterface(WebBridge(this), "RublicXNative")
        wv.webViewClient = WebViewClient()
        wv.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                val needsCamera = request.resources.any { it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }
                if (needsCamera) {
                    if (ActivityCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA)
                        == PackageManager.PERMISSION_GRANTED) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                    } else {
                        pendingCameraRequest = request
                        cameraPermission.launch(Manifest.permission.CAMERA)
                    }
                } else {
                    request.deny()
                }
            }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    private fun checkForApkUpdate() {
        scope.launch {
            val info = withContext(Dispatchers.IO) {
                runCatching { UpdateChecker.fetchLatest() }.getOrNull()
            } ?: return@launch
            val current = BuildConfig.VERSION_CODE
            if (info.versionCode > current) {
                showBanner(info)
            }
        }
    }

    private var pendingUpdate: UpdateChecker.ReleaseInfo? = null

    private fun showBanner(info: UpdateChecker.ReleaseInfo) {
        pendingUpdate = info
        binding.updateBanner.visibility = View.VISIBLE
        binding.updateProgress.progress = 0
        binding.updateProgress.visibility = View.GONE
        binding.updateLabel.text = getString(R.string.update_available_title)
    }

    private fun hideBanner() {
        binding.updateBanner.visibility = View.GONE
    }

    private fun triggerUpdate() {
        val info = pendingUpdate ?: return
        binding.updateButton.isEnabled = false
        binding.updateLater.isEnabled = false
        binding.updateProgress.visibility = View.VISIBLE
        scope.launch {
            ApkDownloader.download(this@MainActivity, info.apkUrl) { pct ->
                binding.updateProgress.progress = pct
                binding.updateLabel.text = getString(R.string.updating, pct)
            }.onSuccess { apkFile ->
                ApkInstaller.install(this@MainActivity, apkFile, installerPermission)
            }.onFailure {
                binding.updateLabel.text = getString(R.string.install_failed)
                binding.updateButton.isEnabled = true
                binding.updateLater.isEnabled = true
            }
        }
    }
}
