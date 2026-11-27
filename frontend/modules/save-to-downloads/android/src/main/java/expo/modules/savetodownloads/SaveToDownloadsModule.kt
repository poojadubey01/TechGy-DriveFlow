package expo.modules.savetodownloads

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Saves a file the app made into the phone's Downloads folder (MediaStore, Android 10+), where
 * it shows up in the Files app like any download. Needs no storage permission.
 */
class SaveToDownloadsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SaveToDownloads")

    Constant("isAvailable") { Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q }

    // Copies `fileUri` (a file:// URI in the app's storage) into Downloads. Android adds " (1)"
    // etc. when the name is taken. Returns the saved file's content URI and its final name.
    AsyncFunction("save") { fileUri: String, fileName: String, mimeType: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        throw CodedException("ERR_UNSUPPORTED", "Saving to Downloads needs Android 10 or newer", null)
      }
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val source = File(Uri.parse(fileUri).path ?: throw CodedException("ERR_SOURCE", "Not a file URI: $fileUri", null))
      val resolver = context.contentResolver
      val values = ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, fileName)
        put(MediaStore.Downloads.MIME_TYPE, mimeType)
        put(MediaStore.Downloads.IS_PENDING, 1)
      }
      val item = resolver.insert(MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values)
        ?: throw CodedException("ERR_SAVE", "Couldn't create the file in Downloads", null)
      try {
        val out = resolver.openOutputStream(item) ?: throw CodedException("ERR_SAVE", "Couldn't write to Downloads", null)
        out.use { o -> source.inputStream().use { it.copyTo(o) } }
        // Visible to other apps only once it's complete.
        resolver.update(item, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
      } catch (e: Exception) {
        resolver.delete(item, null, null)
        throw e
      }
      var name = fileName
      resolver.query(item, arrayOf(MediaStore.Downloads.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst()) name = c.getString(0)
      }
      mapOf("uri" to item.toString(), "name" to name)
    }

    // Opens a saved file in the app the user picks for its type (e.g. a PDF viewer).
    AsyncFunction("open") { contentUri: String, mimeType: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(Uri.parse(contentUri), mimeType)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
      } catch (e: android.content.ActivityNotFoundException) {
        throw CodedException("ERR_NO_APP", "No app on this phone opens this file", e)
      }
    }
  }
}
