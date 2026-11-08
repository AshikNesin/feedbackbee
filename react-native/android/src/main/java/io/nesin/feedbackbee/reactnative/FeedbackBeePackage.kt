package io.nesin.feedbackbee.reactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class FeedbackBeePackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == FeedbackBeeModule.NAME) FeedbackBeeModule(reactContext) else null

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            FeedbackBeeModule.NAME to ReactModuleInfo(
                FeedbackBeeModule.NAME,
                FeedbackBeeModule::class.java.name,
                false, // canOverrideExistingModule
                false, // needsEagerInit: created on first call, not at app start
                false, // isCxxModule
                true, // isTurboModule
            ),
        )
    }
}
