import CoreVideo
import ExpoModulesCore

// The whole window, as the user sees it: natively presented screens (sheets, modals) aren't inside
// the app's root view, so a snapshot of that view misses them.
public class GlassWindowModule: Module {
  // Snapshots handed to JS, by id, until it releases them. Main thread only.
  private var shots: [Int: CVPixelBuffer] = [:]
  private var lastId = 0
  private var pool: CVPixelBufferPool?
  private var poolSize = (0, 0)

  public func definition() -> ModuleDefinition {
    Name("GlassWindow")

    // Where a view really is in its window. React Native measures from the shadow tree, which
    // places a presented screen at its own origin, not where UIKit shows it.
    AsyncFunction("frame") { (tag: Int) -> [Double]? in
      guard let view = self.appContext?.findView(withTag: tag, ofType: UIView.self), let window = view.window else { return nil }
      let r = view.convert(view.bounds, to: window)
      return [r.minX, r.minY, r.width, r.height]
    }.runOnQueue(.main)

    // The window, minus the window-level view that holds `skip` (the glass's own overlay; drawn view
    // by view, so it's never hidden on screen), into a GPU-shareable pixel buffer: Skia wraps it as
    // a texture with no copy (`address`, for MakeImageFromNativeBuffer). Plus a small RGBA sample of
    // it (one pixel per 4 points) for JS to compare and read colors from. `release(id)` when done.
    AsyncFunction("snapshot") { (skip: Int?, touched: Int?) -> [String: Any]? in
      // A touch-down snapshot on a native control (a UISwitch, a slider): it blocks the main thread
      // while the control tracks the finger, and the control can drop the tap. Skip it.
      if let tag = touched, let view = self.appContext?.findView(withTag: tag, ofType: UIView.self),
        view is UIControl || view.subviews.contains(where: { $0 is UIControl }) {
        return nil
      }
      let skipView = skip.flatMap { self.appContext?.findView(withTag: $0, ofType: UIView.self) }
      guard let window = skipView?.window ?? Self.keyWindow() else { return nil }
      var top = skipView
      while let v = top, v.superview !== window { top = v.superview }
      let scale = window.screen.scale
      let width = Int((window.bounds.width * scale).rounded())
      let height = Int((window.bounds.height * scale).rounded())
      guard let buffer = self.buffer(width, height) else { return nil }

      CVPixelBufferLockBaseAddress(buffer, [])
      defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
      guard let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
      let rowBytes = CVPixelBufferGetBytesPerRow(buffer)
      guard let context = CGContext(
        data: base, width: width, height: height, bitsPerComponent: 8, bytesPerRow: rowBytes,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
      ) else { return nil }
      context.clear(CGRect(x: 0, y: 0, width: width, height: height)) // pooled buffers keep old pixels
      context.translateBy(x: 0, y: CGFloat(height))
      context.scaleBy(x: scale, y: -scale)
      UIGraphicsPushContext(context)
      // What's on screen now (afterScreenUpdates: false): forcing pending updates first disrupts
      // animations already running, e.g. a switch's knob jumps back mid-flip.
      for view in window.subviews where !view.isHidden && view !== top {
        view.drawHierarchy(in: view.frame, afterScreenUpdates: false)
      }
      UIGraphicsPopContext()

      let step = max(1, Int(scale * 4))
      let w = width / step, h = height / step
      var sample = Data(count: w * h * 4)
      sample.withUnsafeMutableBytes { out in
        let dst = out.bindMemory(to: UInt8.self)
        let src = base.assumingMemoryBound(to: UInt8.self)
        for y in 0..<h {
          for x in 0..<w {
            let p = (y * step + step / 2) * rowBytes + (x * step + step / 2) * 4 // BGRA
            let q = (y * w + x) * 4 // RGBA
            dst[q] = src[p + 2]
            dst[q + 1] = src[p + 1]
            dst[q + 2] = src[p]
            dst[q + 3] = src[p + 3]
          }
        }
      }
      self.lastId += 1
      self.shots[self.lastId] = buffer
      let address = UInt(bitPattern: Unmanaged.passUnretained(buffer).toOpaque())
      return ["id": self.lastId, "address": Double(address), "width": w, "height": h, "pixels": sample]
    }.runOnQueue(.main)

    AsyncFunction("release") { (id: Int) in
      self.shots.removeValue(forKey: id)
    }.runOnQueue(.main)
  }

  /// A pooled IOSurface-backed BGRA buffer (Metal can use it as a texture as it is).
  private func buffer(_ width: Int, _ height: Int) -> CVPixelBuffer? {
    if pool == nil || poolSize != (width, height) {
      let attributes: [CFString: Any] = [
        kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey: width,
        kCVPixelBufferHeightKey: height,
        kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary,
        kCVPixelBufferMetalCompatibilityKey: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey: true,
      ]
      pool = nil
      CVPixelBufferPoolCreate(nil, nil, attributes as CFDictionary, &pool)
      poolSize = (width, height)
    }
    var buffer: CVPixelBuffer?
    guard let pool else { return nil }
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
    return buffer
  }

  private static func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows).first(where: \.isKeyWindow)
  }
}
