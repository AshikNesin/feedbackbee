package io.nesin.feedbackbarn.shake

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
        listening = sensorManager?.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME) == true
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
    }
}
