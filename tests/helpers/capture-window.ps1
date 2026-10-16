param([long]$WindowHandle, [string]$Destination)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class ReaCutWindowCapture {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr window, IntPtr target, uint flags);
}
'@
$handle = [IntPtr]::new($WindowHandle)
$rect = New-Object ReaCutWindowCapture+Rect
if (-not [ReaCutWindowCapture]::GetWindowRect($handle, [ref]$rect)) { throw 'Test window not found' }
$image = New-Object System.Drawing.Bitmap(($rect.Right - $rect.Left), ($rect.Bottom - $rect.Top))
$graphics = [System.Drawing.Graphics]::FromImage($image)
$target = $graphics.GetHdc()
try {
  if (-not [ReaCutWindowCapture]::PrintWindow($handle, $target, 2)) { throw 'Test window capture failed' }
} finally { $graphics.ReleaseHdc($target) }
try { $image.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png) }
finally { $graphics.Dispose(); $image.Dispose() }
