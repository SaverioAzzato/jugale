package it.azzato.jugale.androidupdater

import java.net.URI
import java.security.MessageDigest

internal object AndroidUpdaterRules {
    private val apkFileName = Regex("[A-Za-z0-9._-]+\\.apk", RegexOption.IGNORE_CASE)
    private val sha256 = Regex("[0-9a-f]{64}")
    private val apkZipSignature = byteArrayOf(0x50, 0x4b, 0x03, 0x04)

    fun validateDownload(rawUrl: String, fileName: String, expectedSize: Long) {
        validateInitialUrl(rawUrl)
        require(apkFileName.matches(fileName)) { "Invalid APK filename" }
        require(expectedSize > 0) { "GitHub did not provide a valid APK size" }
    }

    fun validateInitialUrl(rawUrl: String) {
        val uri = URI(rawUrl)
        check(uri.scheme.equals("https", ignoreCase = true)) { "APK URL must use HTTPS" }
        check(uri.host.equals("github.com", ignoreCase = true)) { "APK must come from github.com" }
        check(uri.path.startsWith("/SaverioAzzato/jugale/releases/download/")) {
            "APK is not a JUGALE release asset"
        }
    }

    fun validateRedirectUrl(rawUrl: String) {
        val uri = URI(rawUrl)
        check(uri.scheme.equals("https", ignoreCase = true)) { "Update redirect must use HTTPS" }
    }

    fun verifyDigest(expected: String?, actualBytes: ByteArray) {
        val normalized = normalizeDigest(expected) ?: return
        val actual = actualBytes.joinToString("") { "%02x".format(it) }
        check(MessageDigest.isEqual(normalized.toByteArray(), actual.toByteArray())) {
            "APK SHA-256 verification failed"
        }
    }

    fun normalizeDigest(expected: String?): String? {
        if (expected.isNullOrBlank()) return null
        val normalized = expected.removePrefix("sha256:").lowercase()
        check(sha256.matches(normalized)) { "GitHub returned an invalid APK digest" }
        return normalized
    }

    fun hasApkSignature(bytes: ByteArray): Boolean = bytes.contentEquals(apkZipSignature)
}
