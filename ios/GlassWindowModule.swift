import ExpoModulesCore

// The whole window, as the user sees it: natively presented screens (sheets, modals) aren't inside
// the app's root view, so a snapshot of that view misses them.
public class GlassWindowModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GlassWindow")

    // Where a view really is in its window. React Native measures from the shadow tree, which
    // places a presented screen at its own origin, not where UIKit shows it.
    AsyncFunction("frame") { (tag: Int) -> [Double]? in
      guard let view = self.appContext?.findView(withTag: tag, ofType: UIView.self), let window = view.window else { return nil }
      let r = view.convert(view.bounds, to: window)
      return [r.minX, r.minY, r.width, r.height]
    }.runOnQueue(.main)

    // The window's pixels (RGBA, premultiplied, top row first), leaving out the window-level view
    // that holds `skip` (the glass's own overlay). Drawn view by view, so the overlay is never
    // hidden on screen.
    AsyncFunction("snapshot") { (skip: Int?) -> [String: Any]? in
      let skipView = skip.flatMap { self.appContext?.findView(withTag: $0, ofType: UIView.self) }
      guard let window = skipView?.window ?? Self.keyWindow() else { return nil }
      var top = skipView
      while let v = top, v.superview !== window { top = v.superview }
      let scale = window.screen.scale
      let width = Int((window.bounds.width * scale).rounded())
      let height = Int((window.bounds.height * scale).rounded())
      var pixels = Data(count: width * height * 4)
      let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
        guard let context = CGContext(
          data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
          space: CGColorSpace(name: CGColorSpace.sRGB)!,
          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
        ) else { return false }
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: scale, y: -scale)
        UIGraphicsPushContext(context)
        // Waiting for pending screen updates once is enough: they're committed for every view after it.
        var first = true
        for view in window.subviews where !view.isHidden && view !== top {
          view.drawHierarchy(in: view.frame, afterScreenUpdates: first)
          first = false
        }
        UIGraphicsPopContext()
        return true
      }
      return drawn ? ["width": width, "height": height, "pixels": pixels] : nil
    }.runOnQueue(.main)
  }

  private static func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows).first(where: \.isKeyWindow)
  }
}
