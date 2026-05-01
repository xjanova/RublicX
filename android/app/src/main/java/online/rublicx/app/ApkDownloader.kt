package online.rublicx.app

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

object ApkDownloader {

    /**
     * Downloads the APK at [url] into the app's internal "updates/" directory and reports
     * progress (0..100) on the main thread via [onProgress]. Result is the local File on
     * success or the exception on failure.
     */
    suspend fun download(
        ctx: Context,
        url: String,
        onProgress: (Int) -> Unit,
    ): Result<File> = withContext(Dispatchers.IO) {
        try {
            val dir = File(ctx.filesDir, "updates").apply { if (!exists()) mkdirs() }
            // Always overwrite — old APK file is no longer needed after install.
            val out = File(dir, "rublicx-latest.apk")
            if (out.exists()) out.delete()

            val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 8000
                readTimeout = 30000
                requestMethod = "GET"
                instanceFollowRedirects = true
                setRequestProperty("User-Agent", "RublicX-Android/${BuildConfig.VERSION_NAME}")
                setRequestProperty("Accept", "application/octet-stream")
            }
            try {
                if (conn.responseCode !in 200..299) {
                    return@withContext Result.failure(Exception("HTTP ${conn.responseCode}"))
                }
                val total = conn.contentLengthLong.coerceAtLeast(1L)
                conn.inputStream.use { input ->
                    FileOutputStream(out).use { output ->
                        val buf = ByteArray(64 * 1024)
                        var read: Int
                        var sum = 0L
                        var lastReportedPct = -1
                        while (input.read(buf).also { read = it } != -1) {
                            output.write(buf, 0, read)
                            sum += read
                            val pct = ((sum * 100) / total).toInt().coerceIn(0, 100)
                            if (pct != lastReportedPct) {
                                lastReportedPct = pct
                                withContext(Dispatchers.Main) { onProgress(pct) }
                            }
                        }
                        output.flush()
                    }
                }
            } finally {
                conn.disconnect()
            }
            withContext(Dispatchers.Main) { onProgress(100) }
            Result.success(out)
        } catch (t: Throwable) {
            Result.failure(t)
        }
    }
}
