package it.azzato.jugale.androidupdater

import java.security.MessageDigest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidUpdaterRulesTest {
    private val releaseUrl =
        "https://github.com/SaverioAzzato/jugale/releases/download/v1.14.2/JUGALE.apk"

    @Test
    fun `accepts a valid JUGALE release download`() {
        AndroidUpdaterRules.validateDownload(releaseUrl, "JUGALE-1.14.2.apk", 42)
    }

    @Test
    fun `rejects insecure foreign and lookalike release URLs`() {
        listOf(
            releaseUrl.replace("https://", "http://"),
            releaseUrl.replace("github.com", "example.com"),
            "https://github.com.evil.example/SaverioAzzato/jugale/releases/download/v1/app.apk",
            "https://github.com/OtherOwner/jugale/releases/download/v1/app.apk",
        ).forEach { url ->
            assertThrows(Exception::class.java) {
                AndroidUpdaterRules.validateInitialUrl(url)
            }
        }
    }

    @Test
    fun `rejects traversal non-APK filenames and invalid sizes`() {
        listOf("../JUGALE.apk", "JUGALE.zip", "folder/JUGALE.apk").forEach { fileName ->
            assertThrows(IllegalArgumentException::class.java) {
                AndroidUpdaterRules.validateDownload(releaseUrl, fileName, 42)
            }
        }
        assertThrows(IllegalArgumentException::class.java) {
            AndroidUpdaterRules.validateDownload(releaseUrl, "JUGALE.apk", 0)
        }
    }

    @Test
    fun `accepts only HTTPS redirect destinations`() {
        AndroidUpdaterRules.validateRedirectUrl("https://objects.githubusercontent.com/asset")
        assertThrows(IllegalStateException::class.java) {
            AndroidUpdaterRules.validateRedirectUrl("http://objects.githubusercontent.com/asset")
        }
    }

    @Test
    fun `normalizes validates and compares SHA-256 digests`() {
        val bytes = "abc".toByteArray()
        val actual = MessageDigest.getInstance("SHA-256").digest(bytes)
        val expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"

        assertNull(AndroidUpdaterRules.normalizeDigest(null))
        assertNull(AndroidUpdaterRules.normalizeDigest(" "))
        assertEquals(expected, AndroidUpdaterRules.normalizeDigest("sha256:${expected.uppercase()}"))
        AndroidUpdaterRules.verifyDigest(expected, actual)

        assertThrows(IllegalStateException::class.java) {
            AndroidUpdaterRules.normalizeDigest("not-a-digest")
        }
        assertThrows(IllegalStateException::class.java) {
            AndroidUpdaterRules.verifyDigest("0".repeat(64), actual)
        }
    }

    @Test
    fun `recognizes only the complete APK ZIP signature`() {
        assertTrue(AndroidUpdaterRules.hasApkSignature(byteArrayOf(0x50, 0x4b, 0x03, 0x04)))
        assertFalse(AndroidUpdaterRules.hasApkSignature(byteArrayOf(0x50, 0x4b, 0x03)))
        assertFalse(AndroidUpdaterRules.hasApkSignature(byteArrayOf(0x50, 0x4b, 0x05, 0x06)))
    }
}
