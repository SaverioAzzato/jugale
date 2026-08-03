package it.azzato.jugale.androidshare

import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.security.MessageDigest

internal data class OutgoingShareFile(
    val name: String,
    val mime: String,
    val contents: String,
)

internal data class OutgoingShareVariant(
    val text: String,
    val file: OutgoingShareFile,
)

internal object AndroidShareRules {
    private val allowedFiles = mapOf(
        "character.schema.json" to "application/json",
        "character.json" to "application/json",
        "schema-changelog.md" to "text/markdown",
        "prompt.txt" to "text/plain",
        "jugale-request.json" to "application/json",
    )
    private val allowedIncomingMimes = setOf("application/json")

    const val MAX_VARIANTS = 4
    const val MAX_TITLE_CHARS = 120
    const val MAX_TEXT_BYTES = 1 * 1024 * 1024
    const val MAX_FILE_BYTES = 5 * 1024 * 1024
    const val MAX_TOTAL_BYTES = 10 * 1024 * 1024
    const val MAX_INCOMING_BYTES = 5 * 1024 * 1024
    const val DUPLICATE_WINDOW_MS = 2_000L

    fun validateOutgoing(title: String, variants: List<OutgoingShareVariant>) {
        require(title.isNotBlank() && title.length <= MAX_TITLE_CHARS) { "Invalid share title" }
        require(variants.isNotEmpty() && variants.size <= MAX_VARIANTS) { "Invalid share variant count" }

        val names = mutableSetOf<String>()
        var totalBytes = 0
        variants.forEach { variant ->
            require(variant.text.toByteArray(StandardCharsets.UTF_8).size <= MAX_TEXT_BYTES) {
                "Prompt is too large"
            }
            val file = variant.file
            val expectedMime = allowedFiles[file.name] ?: error("Attachment filename is not allowed")
            require(file.mime == expectedMime) { "Attachment MIME does not match its filename" }
            require(names.add(file.name)) { "Duplicate attachment filename" }
            val size = file.contents.toByteArray(StandardCharsets.UTF_8).size
            require(size in 1..MAX_FILE_BYTES) { "Attachment is empty or too large" }
            totalBytes += size
            require(totalBytes <= MAX_TOTAL_BYTES) { "Share payload is too large" }
        }
    }

    fun validateIncomingMime(rawMime: String?): String {
        val mime = rawMime?.lowercase() ?: throw IncomingShareException("unsupported-type")
        if (mime !in allowedIncomingMimes) throw IncomingShareException("unsupported-type")
        return mime
    }

    fun decodeStrictUtf8(bytes: ByteArray): String = try {
        StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes))
            .toString()
            .removePrefix("\uFEFF")
    } catch (_: Exception) {
        throw IncomingShareException("invalid-utf8")
    }

    fun sha256Hex(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    fun isRecentDuplicate(fingerprint: String, previous: String?, now: Long, previousAt: Long): Boolean =
        fingerprint == previous && now - previousAt < DUPLICATE_WINDOW_MS
}

internal class IncomingShareException(val code: String) : Exception(code)
