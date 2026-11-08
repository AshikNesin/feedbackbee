package io.nesin.feedbackbee

import android.app.Application
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.FragmentActivity
import io.nesin.feedbackbee.sheet.FeedbackSheetFragment
import io.nesin.feedbackbee.sheet.FeedbackSheetView
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Renders the real sheet with Robolectric's native graphics in light and dark mode, checks the panel
 * pixels, and writes PNGs to `$FEEDBACKBEE_SNAPSHOT_DIR` when set (the docs and website screenshots).
 * Framed like the iOS snapshots: the sheet on the dimmed backdrop, 393dp wide at 2x.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xhdpi", application = SheetScreenshotTest.HostApplication::class)
class SheetScreenshotTest {

    @Test
    fun rendersPickerAndFormInLightAndDark() {
        for (dark in listOf(false, true)) {
            RuntimeEnvironment.setQualifiers(if (dark) "+night" else "+notnight")
            render(dark, "picker", OpenOptions())
            render(dark, "form", OpenOptions(kind = FeedbackKind.Issue, text = "The export button does nothing"))
        }
    }

    private fun render(dark: Boolean, screen: String, options: OpenOptions) {
        Robolectric.buildActivity(FragmentActivity::class.java).use { controller ->
            controller.get().setTheme(
                if (dark) android.R.style.Theme_Material_NoActionBar else android.R.style.Theme_Material_Light_NoActionBar,
            )
            val activity = controller.setup().get()
            FeedbackBee.open(options)
            activity.supportFragmentManager.executePendingTransactions()
            val fragment = activity.supportFragmentManager.fragments.filterIsInstance<FeedbackSheetFragment>().single()
            val sheet = fragment.requireView() as FeedbackSheetView
            shadowOf(Looper.getMainLooper()).idle() // let the sheet collect and render its first state
            // The form focuses the note; park focus on the root so the snapshot shows the fields at rest.
            sheet.descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
            sheet.findFocus()?.clearFocus()

            val density = activity.resources.displayMetrics.density
            val screenWidth = (393 * density).toInt()
            val sheetWidth = (360 * density).toInt()
            sheet.measure(
                View.MeasureSpec.makeMeasureSpec(sheetWidth, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
            )
            sheet.layout(0, 0, sheet.measuredWidth, sheet.measuredHeight)

            val top = (24 * density).toInt()
            val bitmap = Bitmap.createBitmap(screenWidth, sheet.measuredHeight + top, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(BACKDROP) // a mid-grey host app under the sheet's 40% dim, as in the iOS snapshots
            canvas.save()
            canvas.translate(((screenWidth - sheetWidth) / 2).toFloat(), top.toFloat())
            sheet.draw(canvas)
            canvas.restore()

            val panel = bitmap.getPixel(screenWidth / 2, top + sheet.measuredHeight - (4 * density).toInt())
            assertEquals("$screen panel, dark=$dark", if (dark) Color.rgb(24, 24, 27) else Color.WHITE, panel)

            System.getenv("FEEDBACKBEE_SNAPSHOT_DIR")?.takeIf { it.isNotBlank() }?.let { dir ->
                File(dir).mkdirs()
                File(dir, "android-$screen-${if (dark) "dark" else "light"}.png").outputStream().use {
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
                }
            }
            fragment.dismissNow()
        }
    }

    class HostApplication : Application() {
        override fun onCreate() {
            super.onCreate()
            FeedbackBee.init(this, projectId = "demo", endpoint = "https://bee.example.dev", shake = false)
        }
    }

    private companion object {
        val BACKDROP = Color.rgb(77, 77, 77)
    }
}
