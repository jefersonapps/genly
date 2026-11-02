package expo.modules.genlyupdates

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/** Android owns the transfer. JS only observes it and explicitly opens the installer. */
class GenlyUpdatesModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  private val manager get() = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
  private val prefs get() = context.getSharedPreferences("genly_update_download", Context.MODE_PRIVATE)

  override fun definition() = ModuleDefinition {
    Name("GenlyUpdates")
    AsyncFunction("getDownload") { getDownload() }
    AsyncFunction("startDownload") { version: String, url: String, notes: String, size: Double ->
      startDownload(version, url, notes, size.toLong())
    }
    AsyncFunction("cancelDownload") { cancelDownload() }
    AsyncFunction("installDownload") {
      installDownload()
    }.runOnQueue(expo.modules.kotlin.functions.Queues.MAIN)
  }

  @Synchronized
  private fun getDownload(): Map<String, Any>? {
    val id = prefs.getLong("id", -1L)
    if (id < 0) return null
    val result = mutableMapOf<String, Any>(
      "id" to id.toString(),
      "version" to (prefs.getString("version", "") ?: ""),
      "downloadUrl" to (prefs.getString("url", "") ?: ""),
      "releaseNotes" to (prefs.getString("notes", "") ?: ""),
      "expectedBytes" to prefs.getLong("size", 0L).toDouble(),
      "receivedBytes" to 0.0,
      "totalBytes" to -1.0,
      "status" to "missing",
      "reason" to 0
    )
    manager.query(DownloadManager.Query().setFilterById(id))?.use { cursor ->
      if (!cursor.moveToFirst()) return result
      val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
      val received = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
      val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
      val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
      result["status"] = when (status) {
        DownloadManager.STATUS_PENDING -> "pending"
        DownloadManager.STATUS_RUNNING -> "running"
        DownloadManager.STATUS_PAUSED -> "paused"
        DownloadManager.STATUS_SUCCESSFUL -> "complete"
        else -> "failed"
      }
      result["receivedBytes"] = received.coerceAtLeast(0).toDouble()
      result["totalBytes"] = total.toDouble()
      result["reason"] = reason
      if (status == DownloadManager.STATUS_SUCCESSFUL) {
        val expected = prefs.getLong("size", 0L)
        val filename = prefs.getString("filename", "") ?: ""
        val file = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), filename)
        if (!file.isFile || file.length() == 0L || (expected > 0 && file.length() != expected)) {
          result["status"] = "failed"
          result["reason"] = DownloadManager.ERROR_FILE_ERROR
        }
      }
    }
    return result
  }

  @Synchronized
  private fun startDownload(version: String, url: String, notes: String, size: Long): Map<String, Any> {
    // A second tap, screen remount or JS restart must not replace an existing transfer.
    val existing = getDownload()
    if (existing != null && existing["status"] in listOf("pending", "running", "paused", "complete")) return existing
    val uri = Uri.parse(url)
    require(uri.scheme == "https" && !uri.host.isNullOrBlank()) { "Invalid download URL" }
    cancelDownload()
    val safeVersion = version.replace(Regex("[^a-zA-Z0-9.-]"), "")
    require(safeVersion.isNotEmpty()) { "Invalid version" }
    val filename = "Genly_Update_${safeVersion}.apk"
    val directory = requireNotNull(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS))
    directory.mkdirs()
    // Clean only this module's APKs, inside our app-specific folder.
    directory.listFiles()?.filter { it.name.startsWith("Genly_Update_") && it.name.endsWith(".apk") }
      ?.forEach { it.delete() }
    val request = DownloadManager.Request(uri)
      .setTitle("Atualização do Genly $version")
      .setDescription("Baixando atualização do aplicativo")
      .setMimeType("application/vnd.android.package-archive")
      .setAllowedOverMetered(true)
      .setAllowedOverRoaming(false)
      .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
      .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, filename)
    val id = manager.enqueue(request)
    // Commit before returning so the next process can recover the same download ID.
    val saved = prefs.edit().putLong("id", id).putString("version", version)
      .putString("url", url).putString("notes", notes).putString("filename", filename)
      .putLong("size", size.coerceAtLeast(0)).commit()
    if (!saved) {
      manager.remove(id)
      error("Unable to save download state")
    }
    return requireNotNull(getDownload())
  }

  @Synchronized
  private fun cancelDownload() {
    val id = prefs.getLong("id", -1L)
    if (id >= 0) manager.remove(id)
    prefs.edit().clear().commit()
  }

  private fun installDownload(): String {
    val state = getDownload()
    check(state?.get("status") == "complete") { "Update download is not ready" }
    val activity = requireNotNull(appContext.currentActivity)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
      activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}")))
      return "permission"
    }
    val uri = requireNotNull(manager.getUriForDownloadedFile(prefs.getLong("id", -1L)))
    activity.startActivity(Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, "application/vnd.android.package-archive")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    })
    return "opened"
  }
}
