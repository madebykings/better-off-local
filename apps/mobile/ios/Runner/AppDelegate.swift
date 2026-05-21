import Flutter
import UIKit
// import GoogleMaps  // Uncomment after running: cd ios && pod install

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // ── Google Maps ────────────────────────────────────────────────────────
    // Must be called before super.application() and before the Flutter engine
    // initialises the map view. The key is stored in Info.plist under GMSApiKey
    // so it can be replaced without modifying this file.
    //
    // TODO: Uncomment the two lines below after running `pod install`:
    //   let mapsKey = Bundle.main.object(forInfoDictionaryKey: "GMSApiKey") as? String ?? ""
    //   GMSServices.provideAPIKey(mapsKey)

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}
