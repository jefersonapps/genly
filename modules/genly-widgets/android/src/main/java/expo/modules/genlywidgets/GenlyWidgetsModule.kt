package expo.modules.genlywidgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.RemoteViews
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

private const val GROUP_ID = "com.genly.app.widget.GROUP_ID"
private fun provider(context: Context) = ComponentName(context.packageName, "${context.packageName}.widget.GroupWidget")

class GenlyWidgetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GenlyWidgets")
    AsyncFunction("requestGroupWidget") { groupId: Int, groupName: String ->
      require(groupId > 0)
      val context = requireNotNull(appContext.reactContext)
      val manager = AppWidgetManager.getInstance(context)
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !manager.isRequestPinAppWidgetSupported) {
        false
      } else {
        // Each confirmation carries its own group, even when requests overlap or JS dies.
        val intent = Intent(context, GroupWidgetPinnedReceiver::class.java).apply {
          data = Uri.parse("genly-widget-pin://${UUID.randomUUID()}")
          putExtra(GROUP_ID, groupId)
        }
        // The launcher fills in EXTRA_APPWIDGET_ID, so this explicit PendingIntent must be mutable.
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
          (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
        val callback = PendingIntent.getBroadcast(context, 0, intent, flags)
        val preview = RemoteViews(context.packageName, R.layout.genly_group_widget_preview).apply {
          setTextViewText(R.id.genly_group_widget_name, groupName)
        }
        val extras = Bundle().apply { putParcelable(AppWidgetManager.EXTRA_APPWIDGET_PREVIEW, preview) }
        manager.requestPinAppWidget(provider(context), extras, callback)
      }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("getGroupId") { widgetId: Int ->
      val context = requireNotNull(appContext.reactContext)
      val manager = AppWidgetManager.getInstance(context)
      if (manager.getAppWidgetInfo(widgetId)?.provider == provider(context)) {
        manager.getAppWidgetOptions(widgetId).getInt(GROUP_ID, 0)
      } else 0
    }
  }
}

class GroupWidgetPinnedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
    val groupId = intent.getIntExtra(GROUP_ID, 0)
    if (id == AppWidgetManager.INVALID_APPWIDGET_ID || groupId <= 0) return
    val manager = AppWidgetManager.getInstance(context)
    if (manager.getAppWidgetInfo(id)?.provider != provider(context)) return
    // Android persists options by widget ID, independently of the app's JS process.
    manager.updateAppWidgetOptions(id, Bundle().apply { putInt(GROUP_ID, groupId) })
    context.sendBroadcast(Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
      component = provider(context)
      putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(id))
    })
  }
}
