package io.nesin.feedbackbee.shake

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager

internal class ShakeDetector(
    context: Context,
    private val onShake: () -> Unit,
    private val analyzer: ShakeAnalyzer = ShakeAnalyzer(),
) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private var listening = false

    val isSupported: Boolean get() = accelerometer != null

    fun start() {
        if (listening || accelerometer == null) return
        analyzer.reset()
        // Lets sensor hubs with a FIFO deliver samples in batches so the CPU can sleep between them.
        // Safe because the analyzer uses each sample's own timestamp; a shake fires at most 100 ms later.
        listening = sensorManager?.registerListener(
            this, accelerometer, SensorManager.SENSOR_DELAY_GAME, MAX_REPORT_LATENCY_US,
        ) == true
    }

    fun stop() {
        if (!listening) return
        sensorManager?.unregisterListener(this)
        listening = false
    }

    override fun onSensorChanged(event: SensorEvent) {
        val (x, y, z) = event.values
        val timestampMs = event.timestamp / NANOS_PER_MILLI
        if (analyzer.onSample(timestampMs, x, y, z)) onShake()
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private companion object {
        const val NANOS_PER_MILLI = 1_000_000L
        const val MAX_REPORT_LATENCY_US = 100_000
    }
}
