package it.azzato.jugale.androidshare

import java.nio.charset.StandardCharsets
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidShareRulesTest {
    private fun variant(
        name: String = "character.json",
        mime: String = "application/json",
        contents: String = "{}",
        text: String = "Edit this character",
    ) = OutgoingShareVariant(text, OutgoingShareFile(name, mime, contents))

    @Test
    fun `accepts the shipped outgoing variants`() {
        AndroidShareRules.validateOutgoing(
            "Share character",
            listOf(
                variant(name = "jugale-request.json"),
                variant(name = "prompt.txt", mime = "text/plain", contents = "prompt"),
            ),
        )
    }

    @Test
    fun `rejects unknown duplicate mismatched and empty attachments`() {
        assertThrows(IllegalStateException::class.java) {
            AndroidShareRules.validateOutgoing("Share", listOf(variant(name = "other.json")))
        }
        assertThrows(IllegalArgumentException::class.java) {
            AndroidShareRules.validateOutgoing("Share", listOf(variant(mime = "text/plain")))
        }
        assertThrows(IllegalArgumentException::class.java) {
            AndroidShareRules.validateOutgoing("Share", listOf(variant(), variant()))
        }
        assertThrows(IllegalArgumentException::class.java) {
            AndroidShareRules.validateOutgoing("Share", listOf(variant(contents = "")))
        }
    }

    @Test
    fun `enforces title variant and byte limits`() {
        assertThrows(IllegalArgumentException::class.java) {
            AndroidShareRules.validateOutgoing(" ", listOf(variant()))
        }
        assertThrows(IllegalArgumentException::class.java) {
            AndroidShareRules.validateOutgoing("Share", emptyList())
        }
        val oversized = "x".repeat(AndroidShareRules.MAX_FILE_BYTES + 1)
        assertThrows(IllegalArgumentException::class.java) {
            AndroidShareRules.validateOutgoing("Share", listOf(variant(contents = oversized)))
        }
    }

    @Test
    fun `normalizes the incoming MIME and rejects unsupported types`() {
        assertEquals("application/json", AndroidShareRules.validateIncomingMime("Application/JSON"))
        val error = assertThrows(IncomingShareException::class.java) {
            AndroidShareRules.validateIncomingMime("text/plain")
        }
        assertEquals("unsupported-type", error.code)
    }

    @Test
    fun `decodes strict UTF-8 strips a BOM and rejects malformed bytes`() {
        val withBom = byteArrayOf(0xef.toByte(), 0xbb.toByte(), 0xbf.toByte()) +
            "{\"name\":\"Èowyn\"}".toByteArray(StandardCharsets.UTF_8)
        assertEquals("{\"name\":\"Èowyn\"}", AndroidShareRules.decodeStrictUtf8(withBom))

        val error = assertThrows(IncomingShareException::class.java) {
            AndroidShareRules.decodeStrictUtf8(byteArrayOf(0xc3.toByte(), 0x28))
        }
        assertEquals("invalid-utf8", error.code)
    }

    @Test
    fun `computes stable SHA-256 fingerprints and applies the duplicate window`() {
        assertEquals(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            AndroidShareRules.sha256Hex("abc".toByteArray()),
        )
        assertTrue(AndroidShareRules.isRecentDuplicate("same", "same", 2_999, 1_000))
        assertFalse(AndroidShareRules.isRecentDuplicate("same", "same", 3_000, 1_000))
        assertFalse(AndroidShareRules.isRecentDuplicate("new", "old", 1_100, 1_000))
    }
}
