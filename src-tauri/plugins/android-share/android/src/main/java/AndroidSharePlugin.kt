package it.azzato.jugale.androidshare

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.webkit.WebView
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.UUID
import org.json.JSONObject
import org.json.JSONTokener

@InvokeArg
class ShareFileArg {
    lateinit var name: String
    lateinit var mime: String
    lateinit var contents: String
}

@InvokeArg
class ShareVariantArg {
    lateinit var text: String
    lateinit var file: ShareFileArg
}

@InvokeArg
class SharePromptArgs {
    lateinit var title: String
    var variants: Array<ShareVariantArg> = emptyArray()
}

// A distinct provider class prevents manifest merging with the updater FileProvider.
class AndroidShareFileProvider : FileProvider()

@TauriPlugin
class AndroidSharePlugin(private val activity: Activity) : Plugin(activity) {
    private val pendingLock = Any()
    private var pendingShare: JSObject? = null
    private var lastFingerprint: String? = null
    private var lastReceivedAt = 0L

    override fun load(webView: WebView) {
        val initialIntent = activity.intent
        captureIncoming(initialIntent, false)
        // The bytes are already copied into our pending buffer. Do not let Activity recreation
        // (rotation/process restore) replay the same one-shot share intent.
        if (initialIntent?.action == Intent.ACTION_SEND) activity.intent = Intent(Intent.ACTION_MAIN)
    }

    override fun onNewIntent(intent: Intent) {
        captureIncoming(intent, true)
    }

    @Command
    fun sharePrompt(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(SharePromptArgs::class.java)
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Invalid share arguments")
            return
        }

        try {
            val variants = prepareVariants(args)
            activity.runOnUiThread {
                try {
                    openChooser(args, variants)
                    invoke.resolve()
                } catch (error: Exception) {
                    invoke.reject(error.message ?: "Could not open Android sharing")
                }
            }
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Could not prepare shared files")
        }
    }

    @Command
    fun takePendingShare(invoke: Invoke) {
        val result = synchronized(pendingLock) {
            val current = pendingShare
            pendingShare = null
            current
        }
        invoke.resolve(result ?: JSObject().apply { put("status", "empty") })
    }

    private fun captureIncoming(intent: Intent?, emit: Boolean) {
        if (intent?.action != Intent.ACTION_SEND) return
        val payload = try {
            readIncoming(intent)
        } catch (error: IncomingShareException) {
            JSObject().apply {
                put("status", "error")
                put("error", error.code)
            }
        } catch (_: Exception) {
            JSObject().apply {
                put("status", "error")
                put("error", "unreadable")
            }
        }

        val fingerprint = payload.optString("id", "error:${payload.optString("error")}")
        val now = System.currentTimeMillis()
        synchronized(pendingLock) {
            if (fingerprint == lastFingerprint && now - lastReceivedAt < DUPLICATE_WINDOW_MS) return
            lastFingerprint = fingerprint
            lastReceivedAt = now
            pendingShare = payload
        }
        if (emit) trigger("character-share", payload)
    }

    private fun readIncoming(intent: Intent): JSObject {
        val mime = intent.type?.lowercase() ?: throw IncomingShareException("unsupported-type")
        if (mime !in ALLOWED_INCOMING_MIMES) throw IncomingShareException("unsupported-type")
        if (intent.action == Intent.ACTION_SEND_MULTIPLE || (intent.clipData?.itemCount ?: 0) > 1) {
            throw IncomingShareException("multiple-files")
        }
        val uri = streamUri(intent) ?: intent.clipData?.takeIf { it.itemCount == 1 }?.getItemAt(0)?.uri
            ?: throw IncomingShareException("missing-file")
        val bytes = activity.contentResolver.openInputStream(uri)?.use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                output.write(buffer, 0, count)
                if (output.size() > MAX_INCOMING_BYTES) throw IncomingShareException("too-large")
            }
            output.toByteArray()
        } ?: throw IncomingShareException("unreadable")
        if (bytes.isEmpty()) throw IncomingShareException("empty-file")

        val text = try {
            StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes))
                .toString()
                .removePrefix("\uFEFF")
        } catch (_: Exception) {
            throw IncomingShareException("invalid-utf8")
        }
        val parsed = try { JSONTokener(text).nextValue() } catch (_: Exception) { null }
        if (parsed !is JSONObject) throw IncomingShareException("invalid-json")

        val digest = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        return JSObject().apply {
            put("status", "character")
            put("id", digest)
            put("name", displayName(uri))
            put("mime", mime)
            put("contents", text)
        }
    }

    @Suppress("DEPRECATION")
    private fun streamUri(intent: Intent): Uri? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }

    private fun displayName(uri: Uri): String {
        return try {
            activity.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            } ?: "character.json"
        } catch (_: Exception) {
            "character.json"
        }
    }

    private data class PreparedVariant(val args: ShareVariantArg, val uri: Uri)

    private fun prepareVariants(args: SharePromptArgs): List<PreparedVariant> {
        require(args.title.isNotBlank() && args.title.length <= MAX_TITLE_CHARS) { "Invalid share title" }
        require(args.variants.isNotEmpty() && args.variants.size <= MAX_VARIANTS) { "Invalid share variant count" }

        val names = mutableSetOf<String>()
        var totalBytes = 0
        args.variants.forEach { variant ->
            require(variant.text.toByteArray(StandardCharsets.UTF_8).size <= MAX_TEXT_BYTES) { "Prompt is too large" }
            val file = variant.file
            val expectedMime = ALLOWED_FILES[file.name] ?: error("Attachment filename is not allowed")
            require(file.mime == expectedMime) { "Attachment MIME does not match its filename" }
            require(names.add(file.name)) { "Duplicate attachment filename" }
            val size = file.contents.toByteArray(StandardCharsets.UTF_8).size
            require(size in 1..MAX_FILE_BYTES) { "Attachment is empty or too large" }
            totalBytes += size
            require(totalBytes <= MAX_TOTAL_BYTES) { "Share payload is too large" }
        }

        val shareRoot = File(activity.cacheDir, "shares")
        check(shareRoot.exists() || shareRoot.mkdirs()) { "Could not create share cache" }
        shareRoot.listFiles()?.forEach { stale ->
            check(stale.deleteRecursively()) { "Could not clean stale share cache" }
        }
        val requestDir = File(shareRoot, UUID.randomUUID().toString())
        check(requestDir.mkdir()) { "Could not create share request cache" }

        return args.variants.map { variant ->
            val attachment = variant.file
            val target = File(requestDir, attachment.name)
            target.writeText(attachment.contents, StandardCharsets.UTF_8)
            PreparedVariant(
                variant,
                FileProvider.getUriForFile(
                    activity,
                    "${activity.packageName}.android-share.fileprovider",
                    target,
                ),
            )
        }
    }

    private fun sendIntent(title: String, variant: PreparedVariant) =
        Intent(Intent.ACTION_SEND).apply {
            type = variant.args.file.mime
            putExtra(Intent.EXTRA_TEXT, variant.args.text)
            putExtra(Intent.EXTRA_TITLE, title)
            putExtra(Intent.EXTRA_STREAM, variant.uri)
            clipData = ClipData.newUri(activity.contentResolver, variant.args.file.name, variant.uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

    private fun openChooser(args: SharePromptArgs, variants: List<PreparedVariant>) {
        val intents = variants.map { sendIntent(args.title, it) }
        val chooser = Intent.createChooser(intents.first(), args.title)
        if (intents.size > 1) {
            chooser.putExtra(Intent.EXTRA_ALTERNATE_INTENTS, intents.drop(1).toTypedArray())
        }
        activity.startActivity(chooser)
    }

    private companion object {
        val ALLOWED_FILES = mapOf(
            "character.schema.json" to "application/json",
            "character.json" to "application/json",
            "schema-changelog.md" to "text/markdown",
            "prompt.txt" to "text/plain",
            "jugale-request.json" to "application/json",
        )
        const val MAX_VARIANTS = 4
        const val MAX_TITLE_CHARS = 120
        const val MAX_TEXT_BYTES = 1 * 1024 * 1024
        const val MAX_FILE_BYTES = 5 * 1024 * 1024
        const val MAX_TOTAL_BYTES = 10 * 1024 * 1024
        val ALLOWED_INCOMING_MIMES = setOf("application/json")
        const val MAX_INCOMING_BYTES = 5 * 1024 * 1024
        const val DUPLICATE_WINDOW_MS = 2_000L
    }
}

private class IncomingShareException(val code: String) : Exception(code)
