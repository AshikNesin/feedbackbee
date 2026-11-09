# kotlinx.serialization: generated serializers are found without reflection;
# keep the companion lookups R8 cannot see.
-keepclassmembers @kotlinx.serialization.Serializable class io.nesin.feedbackbee.app.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keepattributes *Annotation*, InnerClasses
