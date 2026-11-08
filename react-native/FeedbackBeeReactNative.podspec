require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "FeedbackBeeReactNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => "15.1" }
  s.source       = { :git => "https://github.com/AshikNesin/feedbackbee.git", :tag => "react-native-v#{s.version}" }

  # vendor/ios is the Swift SDK from ../ios, copied by `pnpm vendor` (and on `pnpm pack`).
  unless File.directory?(File.join(__dir__, "vendor", "ios"))
    raise "react-native-feedbackbee: vendor/ios is missing. Install the package from `pnpm pack`, or run `pnpm vendor` in react-native/."
  end

  s.source_files  = "ios/**/*.{h,m,mm,swift}", "vendor/ios/**/*.swift"
  s.swift_version = "5.9"
  s.frameworks    = "UIKit", "AVFoundation"
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }

  install_modules_dependencies(s)
end
