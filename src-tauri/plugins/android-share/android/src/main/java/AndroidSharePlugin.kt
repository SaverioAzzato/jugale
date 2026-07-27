package it.azzato.jugale.androidshare

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.UUID

@InvokeArg
class ShareFileArg {
    lateinit var name: String
    lateinit var mime: String
    lateinit var contents: String
}

@InvokeArg
class SharePromptArgs {
    lateinit var title: String
    lateinit var text: String
    var files: Array<ShareFileArg> = emptyArray()
}

// A distinct provider class prevents manifest merging with the updater FileProvider.
class AndroidShareFileProvider : FileProvider()

@TauriPlugin
class AndroidSharePlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun sharePrompt(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(SharePromptArgs::class.java)
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Invalid share arguments")
            return
        }

        try {
            val uris = prepareFiles(args)
            activity.runOnUiThread {
                try {
                    openChooser(args, uris)
                    invoke.resolve()
                } catch (error: Exception) {
                    invoke.reject(error.message ?: "Could not open Android sharing")
                }
            }
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Could not prepare shared files")
        }
    }

    private fun prepareFiles(args: SharePromptArgs): ArrayList<Uri> {
        require(args.title.isNotBlank() && args.title.length <= MAX_TITLE_CHARS) { "Invalid share title" }
        require(args.text.toByteArray(StandardCharsets.UTF_8).size <= MAX_TEXT_BYTES) { "Prompt is too large" }
        require(args.files.isNotEmpty() && args.files.size <= MAX_FILES) { "Invalid attachment count" }

        val names = mutableSetOf<String>()
        var totalBytes = 0
        args.files.forEach { file ->
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

        return ArrayList(args.files.map { attachment ->
            val target = File(requestDir, attachment.name)
            target.writeText(attachment.contents, StandardCharsets.UTF_8)
            FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.android-share.fileprovider",
                target,
            )
        })
    }

    private fun openChooser(args: SharePromptArgs, uris: ArrayList<Uri>) {
        val homogeneousMime = args.files.map { it.mime }.distinct().singleOrNull()
        val intent = Intent(if (uris.size == 1) Intent.ACTION_SEND else Intent.ACTION_SEND_MULTIPLE).apply {
            type = homogeneousMime ?: "*/*"
            putExtra(Intent.EXTRA_TEXT, args.text)
            if (uris.size == 1) putExtra(Intent.EXTRA_STREAM, uris[0])
            else putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
            clipData = ClipData.newUri(activity.contentResolver, args.files[0].name, uris[0]).also { clip ->
                uris.drop(1).forEach { clip.addItem(ClipData.Item(it)) }
            }
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        activity.startActivity(Intent.createChooser(intent, args.title))
    }

    private companion object {
        val ALLOWED_FILES = mapOf(
            "character.schema.json" to "application/json",
            "character.json" to "application/json",
            "schema-changelog.md" to "text/markdown",
            "prompt.txt" to "text/plain",
        )
        const val MAX_FILES = 4
        const val MAX_TITLE_CHARS = 120
        const val MAX_TEXT_BYTES = 1 * 1024 * 1024
        const val MAX_FILE_BYTES = 5 * 1024 * 1024
        const val MAX_TOTAL_BYTES = 10 * 1024 * 1024
    }
}
