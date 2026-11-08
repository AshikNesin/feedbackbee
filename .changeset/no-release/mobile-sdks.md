# No release: FeedbackBee iOS SDK and React Native module

Add the app-owned iOS SDK (`ios/`), the React Native module (`react-native/`), an
optional `currentActivity` argument on the Android SDK's `init`, and a
`mobile-sdks.yml` workflow listed in `.groot/boilerplate-sync.json`
`additional_exclusions`. groot's published packages are unchanged; the upload
contract only gains `ios` as a documented `os_name` value.
