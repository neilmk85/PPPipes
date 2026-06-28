package com.example.pos_mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.util.Log
import android.widget.RemoteViews

class PipesWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (widgetId in appWidgetIds) {
            try {
                updateWidget(context, appWidgetManager, widgetId)
            } catch (e: Exception) {
                Log.e(TAG, "onUpdate failed for widget $widgetId", e)
            }
        }
    }

    companion object {
        private const val TAG = "PipesWidget"
        private const val PREFS_NAME = "HomeWidgetPlugin"

        fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_pipes)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            // home_widget may save ints as Int, Long, or serialised String depending on version
            val available = readInt(prefs, "pipes_available")
            val loaded    = readInt(prefs, "pipes_loaded_today")
            val updatedAt = prefs.getString("widget_updated_at", null)

            Log.d(TAG, "Widget data — available=$available loaded=$loaded ts=$updatedAt")

            views.setTextViewText(R.id.tv_available, if (available >= 0) fmt(available) else "—")
            views.setTextViewText(R.id.tv_loaded,    if (loaded    >= 0) fmt(loaded)    else "—")
            views.setTextViewText(R.id.tv_updated,   updatedAt ?: "Open app to load data")

            // Draw donut chart
            val dp = context.resources.displayMetrics.density
            val chartPx = (80 * dp).toInt()
            val chartBitmap = drawDonut(
                if (available > 0) available else 0,
                if (loaded    > 0) loaded    else 0,
                chartPx
            )
            views.setImageViewBitmap(R.id.iv_chart, chartBitmap)

            // Tap to open app
            try {
                val intent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val pi = PendingIntent.getActivity(
                    context, widgetId, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_root, pi)
                views.setOnClickPendingIntent(R.id.btn_refresh,  pi)
            } catch (e: Exception) {
                Log.e(TAG, "PendingIntent failed", e)
            }

            appWidgetManager.updateAppWidget(widgetId, views)
        }

        /** Reads an int stored by home_widget regardless of whether it's Int, Long, or String. */
        private fun readInt(prefs: SharedPreferences, key: String): Int {
            if (!prefs.contains(key)) return -1
            return try {
                prefs.getInt(key, -1)
            } catch (_: ClassCastException) {
                try {
                    prefs.getLong(key, -1L).toInt()
                } catch (_: ClassCastException) {
                    prefs.getString(key, null)?.toIntOrNull() ?: -1
                }
            }
        }

        private fun drawDonut(available: Int, loaded: Int, sizePx: Int): Bitmap {
            val bmp    = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            val paint  = Paint(Paint.ANTI_ALIAS_FLAG)
            val stroke = sizePx * 0.16f
            val pad    = stroke / 2f + sizePx * 0.03f
            val oval   = RectF(pad, pad, sizePx - pad, sizePx - pad)
            val total  = available + loaded

            // Background track ring
            paint.style      = Paint.Style.STROKE
            paint.strokeWidth = stroke
            paint.color      = Color.parseColor("#1E293B")
            canvas.drawOval(oval, paint)

            if (total > 0) {
                val availDeg = (available.toFloat() / total) * 360f

                // Available — purple arc
                paint.color = Color.parseColor("#7C3AED")
                canvas.drawArc(oval, -90f, availDeg, false, paint)

                // Loaded today — blue arc
                val loadedDeg = 360f - availDeg
                if (loadedDeg > 0.5f) {
                    paint.color = Color.parseColor("#3B82F6")
                    canvas.drawArc(oval, -90f + availDeg, loadedDeg, false, paint)
                }
            }

            // Center total
            paint.style     = Paint.Style.FILL
            paint.typeface  = Typeface.DEFAULT_BOLD
            paint.textAlign = Paint.Align.CENTER
            paint.textSize  = sizePx * 0.20f
            paint.color     = Color.WHITE
            val cx = sizePx / 2f
            val cy = sizePx / 2f
            canvas.drawText(
                if (total > 0) shortNum(total) else "—",
                cx, cy + paint.textSize * 0.38f, paint
            )

            // "total" sub-label
            if (total > 0) {
                paint.typeface = Typeface.DEFAULT
                paint.textSize = sizePx * 0.09f
                paint.color    = Color.parseColor("#64748B")
                canvas.drawText("total", cx, cy + paint.textSize + sizePx * 0.26f, paint)
            }

            return bmp
        }

        /** Compact number for donut centre: 999, 1.2k, 12k */
        private fun shortNum(n: Int): String = when {
            n >= 10_000 -> "${n / 1000}k"
            n >= 1_000  -> "${n / 1000}.${n % 1000 / 100}k"
            else        -> n.toString()
        }

        /** Full formatted number for stat cards: 999, 1,234 */
        private fun fmt(n: Int): String = when {
            n >= 10_000 -> "${n / 1000}k"
            n >= 1_000  -> "${n / 1000},${(n % 1000).toString().padStart(3, '0')}"
            else        -> n.toString()
        }
    }
}
