package online.rublicx.app

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Queries the GitHub Releases API for the latest published RublicX release and returns:
 *   - tag (vX.Y.Z+sha)
 *   - versionCode (parsed from the tag — we encode major.minor.patch as 6-digit + suffix)
 *   - apkUrl (download URL of the .apk asset)
 *
 * The version comparison is done against BuildConfig.VERSION_CODE (set by CI from
 * GITHUB_RUN_NUMBER, monotonically increasing). Any tag whose versionCode is greater
 * than the installed one triggers the in-app update banner.
 */
object UpdateChecker {

    data class ReleaseInfo(
        val tag: String,
        val versionCode: Int,
        val apkUrl: String,
    )

    fun fetchLatest(): ReleaseInfo? {
        val url = URL(BuildConfig.RELEASE_API)
        val conn = url.openConnection() as HttpURLConnection
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.requestMethod = "GET"
        conn.setRequestProperty("Accept", "application/vnd.github+json")
        conn.setRequestProperty("User-Agent", "RublicX-Android/${BuildConfig.VERSION_NAME}")
        try {
            if (conn.responseCode != 200) return null
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val obj = JSONObject(body)
            val tag = obj.optString("tag_name").orEmpty()
            val assets = obj.optJSONArray("assets") ?: return null
            var apkUrl: String? = null
            for (i in 0 until assets.length()) {
                val asset = assets.getJSONObject(i)
                val name = asset.optString("name")
                if (name.endsWith(".apk", ignoreCase = true)) {
                    apkUrl = asset.optString("browser_download_url")
                    break
                }
            }
            apkUrl ?: return null
            val versionCode = parseVersionCodeFromTag(tag)
            return ReleaseInfo(tag = tag, versionCode = versionCode, apkUrl = apkUrl)
        } finally {
            conn.disconnect()
        }
    }

    /**
     * Parse the build number from a release tag and return the SAME formula CI uses for the
     * APK's BuildConfig.VERSION_CODE: 100 + run_number. The CI workflow sets
     *
     *     CODE=$((${{ github.run_number }} + 100))
     *
     * and tags the release "v<pkg>-build.<run_number>". So tag "v0.1.0-build.6" → 106, which is
     * exactly what the installed APK from run 6 has. That's how we reliably tell "you're up to
     * date" vs "an update is available". A previous version of this parser used a semver-encoded
     * scheme that always returned a number larger than the installed code → banner looped.
     */
    fun parseVersionCodeFromTag(tag: String): Int {
        val cleaned = tag.removePrefix("v").trim()
        // -build.<n> is the canonical CI pattern. We also accept +<n> as a fallback.
        val buildSuffix = Regex("[-+](?:build\\.)?(\\d+)").find(cleaned)
        val build = buildSuffix?.groupValues?.getOrNull(1)?.toIntOrNull() ?: 0
        return 100 + build
    }
}
