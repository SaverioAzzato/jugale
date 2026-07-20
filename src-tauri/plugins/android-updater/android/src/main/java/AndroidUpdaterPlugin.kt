package it.azzato.jugale.androidupdater

import android.app.Activity
import android.content.Intent
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.security.MessageDigest

@InvokeArg
class DownloadArgs {
    lateinit var url: String
    lateinit var fileName: String
    var expectedSize: Long = 0
    var expectedDigest: String? = null
}

@TauriPlugin
class AndroidUpdaterPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun downloadAndInstall(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(DownloadArgs::class.java)
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Invalid update arguments")
            return
        }

        Thread {
            try {
                val apk = downloadVerifiedApk(args)
                activity.runOnUiThread {
                    try {
                        openInstaller(apk)
                        invoke.resolve()
                    } catch (error: Exception) {
                        invoke.reject(error.message ?: "Could not open Android package installer")
                    }
                }
            } catch (error: Exception) {
                invoke.reject(error.message ?: "Android update download failed")
            }
        }.start()
    }

    private fun downloadVerifiedApk(args: DownloadArgs): File {
        validateInitialUrl(args.url)
        require(args.fileName.matches(Regex("[A-Za-z0-9._-]+\\.apk", RegexOption.IGNORE_CASE))) {
            "Invalid APK filename"
        }
        require(args.expectedSize > 0) { "GitHub did not provide a valid APK size" }

        val updatesDir = File(activity.cacheDir, "updates")
        check(updatesDir.exists() || updatesDir.mkdirs()) { "Could not create update cache" }
        val partial = File(updatesDir, "${args.fileName}.part")
        val target = File(updatesDir, args.fileName)
        updatesDir.listFiles()?.forEach { cached ->
            if (cached != target && !cached.delete()) error("Could not clean stale update cache")
        }
        partial.delete()

        val digest = MessageDigest.getInstance("SHA-256")
        var connection: HttpURLConnection? = null
        try {
            connection = openFollowingRedirects(args.url)
            val reportedLength = connection.contentLengthLong
            if (reportedLength > 0 && reportedLength != args.expectedSize) {
                error("APK size changed before download (${reportedLength} != ${args.expectedSize})")
            }

            var downloaded = 0L
            val signature = ByteArray(4)
            var signatureBytes = 0
            connection.inputStream.use { input ->
                FileOutputStream(partial).use { output ->
                    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        if (signatureBytes < signature.size) {
                            val copy = minOf(count, signature.size - signatureBytes)
                            buffer.copyInto(signature, signatureBytes, 0, copy)
                            signatureBytes += copy
                        }
                        output.write(buffer, 0, count)
                        digest.update(buffer, 0, count)
                        downloaded += count
                        if (downloaded > args.expectedSize) error("APK is larger than GitHub metadata")
                    }
                    output.fd.sync()
                }
            }

            check(downloaded == args.expectedSize) {
                "Incomplete APK download (${downloaded} of ${args.expectedSize} bytes)"
            }
            check(signature.contentEquals(byteArrayOf(0x50, 0x4b, 0x03, 0x04))) {
                "Downloaded file is not an APK/ZIP"
            }
            verifyDigest(args.expectedDigest, digest.digest())

            if (target.exists() && !target.delete()) error("Could not replace cached APK")
            check(partial.renameTo(target)) { "Could not finalize downloaded APK" }
            return target
        } catch (error: Exception) {
            partial.delete()
            throw error
        } finally {
            connection?.disconnect()
        }
    }

    private fun validateInitialUrl(rawUrl: String) {
        val uri = URI(rawUrl)
        check(uri.scheme.equals("https", ignoreCase = true)) { "APK URL must use HTTPS" }
        check(uri.host.equals("github.com", ignoreCase = true)) { "APK must come from github.com" }
        check(uri.path.startsWith("/SaverioAzzato/jugale/releases/download/")) {
            "APK is not a JUGALE release asset"
        }
    }

    private fun openFollowingRedirects(initialUrl: String): HttpURLConnection {
        var current = URL(initialUrl)
        repeat(MAX_REDIRECTS + 1) { redirectCount ->
            check(current.protocol.equals("https", ignoreCase = true)) { "Update redirect must use HTTPS" }
            val connection = current.openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = CONNECT_TIMEOUT_MS
            connection.readTimeout = READ_TIMEOUT_MS
            connection.setRequestProperty("Accept", "application/octet-stream")
            connection.setRequestProperty("User-Agent", "JUGALE-Android-Updater")
            connection.connect()

            when (connection.responseCode) {
                HttpURLConnection.HTTP_OK -> return connection
                HttpURLConnection.HTTP_MOVED_PERM,
                HttpURLConnection.HTTP_MOVED_TEMP,
                HttpURLConnection.HTTP_SEE_OTHER,
                307,
                308 -> {
                    if (redirectCount == MAX_REDIRECTS) {
                        connection.disconnect()
                        error("Too many update redirects")
                    }
                    val location = connection.getHeaderField("Location")
                        ?: run {
                            connection.disconnect()
                            error("Update redirect has no destination")
                        }
                    current = URL(current, location)
                    connection.disconnect()
                }
                else -> {
                    val status = connection.responseCode
                    connection.disconnect()
                    error("APK download failed: HTTP $status")
                }
            }
        }
        error("Too many update redirects")
    }

    private fun verifyDigest(expected: String?, actualBytes: ByteArray) {
        if (expected.isNullOrBlank()) return
        val normalized = expected.removePrefix("sha256:").lowercase()
        check(normalized.matches(Regex("[0-9a-f]{64}"))) { "GitHub returned an invalid APK digest" }
        val actual = actualBytes.joinToString("") { "%02x".format(it) }
        check(MessageDigest.isEqual(normalized.toByteArray(), actual.toByteArray())) {
            "APK SHA-256 verification failed"
        }
    }

    private fun openInstaller(apk: File) {
        val uri = FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.android-updater.fileprovider",
            apk,
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, APK_MIME)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.startActivity(intent)
    }

    private companion object {
        const val APK_MIME = "application/vnd.android.package-archive"
        const val MAX_REDIRECTS = 10
        const val CONNECT_TIMEOUT_MS = 30_000
        const val READ_TIMEOUT_MS = 60_000
    }
}
