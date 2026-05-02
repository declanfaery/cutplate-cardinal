Add-Type -AssemblyName System.Drawing

$assetsDir = Join-Path $PSScriptRoot '..\assets'

function Color-Hex($hex) {
  $clean = $hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb(
    [Convert]::ToInt32($clean.Substring(0, 2), 16),
    [Convert]::ToInt32($clean.Substring(2, 2), 16),
    [Convert]::ToInt32($clean.Substring(4, 2), 16)
  )
}

function Brush-Hex($hex) {
  return [System.Drawing.SolidBrush]::new((Color-Hex $hex))
}

function Fill-Path($graphics, $brush, [ScriptBlock]$build) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  & $build $path
  $graphics.FillPath($brush, $path)
  $path.Dispose()
}

function Stroke-Path($graphics, $color, $width, [ScriptBlock]$build) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  & $build $path
  $pen = [System.Drawing.Pen]::new((Color-Hex $color), $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $graphics.DrawPath($pen, $path)
  $pen.Dispose()
  $path.Dispose()
}

function Draw-Cardinal($graphics, $x, $y, $scale) {
  $state = $graphics.Save()
  $graphics.TranslateTransform($x, $y)
  $graphics.ScaleTransform($scale, $scale)

  $cardinal = Brush-Hex '#c91f32'
  $cardinalDark = Brush-Hex '#7d1020'
  $wing = Brush-Hex '#ec3747'
  $wingLine = '#a91625'
  $mask = Brush-Hex '#211817'
  $beak = Brush-Hex '#f0ad2d'
  $beakDark = Brush-Hex '#cc7c17'
  $white = Brush-Hex '#ffffff'
  $ink = Brush-Hex '#060606'
  $leg = '#9b5b28'

  Fill-Path $graphics $cardinalDark {
    param($p)
    $p.AddBezier(107, 77, 126, 76, 148, 79, 170, 89)
    $p.AddBezier(170, 89, 146, 100, 124, 98, 102, 88)
    $p.CloseFigure()
  }
  Fill-Path $graphics (Brush-Hex '#df2637') {
    param($p)
    $p.AddBezier(104, 83, 124, 83, 145, 85, 160, 91)
    $p.AddBezier(160, 91, 139, 94, 121, 93, 100, 89)
    $p.CloseFigure()
  }
  Fill-Path $graphics $cardinal {
    param($p)
    $p.AddBezier(51, 64, 51, 38, 72, 22, 95, 29)
    $p.AddBezier(95, 29, 119, 36, 130, 61, 119, 84)
    $p.AddBezier(119, 84, 107, 110, 73, 113, 57, 92)
    $p.AddBezier(57, 92, 52, 85, 50, 75, 51, 64)
    $p.CloseFigure()
  }
  Fill-Path $graphics $cardinal {
    param($p)
    $p.AddLine(63, 32, 58, 3)
    $p.AddLine(58, 3, 76, 25)
    $p.AddLine(76, 25, 82, 4)
    $p.AddLine(82, 4, 88, 31)
    $p.AddBezier(88, 31, 79, 25, 70, 25, 63, 32)
    $p.CloseFigure()
  }
  Fill-Path $graphics $mask {
    param($p)
    $p.AddBezier(54, 50, 63, 35, 82, 34, 94, 45)
    $p.AddBezier(94, 45, 84, 47, 76, 55, 72, 68)
    $p.AddBezier(72, 68, 61, 66, 54, 60, 54, 50)
    $p.CloseFigure()
  }
  Fill-Path $graphics $beak {
    param($p)
    $p.AddLine(55, 57, 11, 69)
    $p.AddLine(11, 69, 56, 79)
    $p.CloseFigure()
  }
  Fill-Path $graphics $beakDark {
    param($p)
    $p.AddLine(52, 70, 11, 69)
    $p.AddLine(11, 69, 55, 76)
    $p.CloseFigure()
  }
  $graphics.FillEllipse($white, 69, 38, 14, 14)
  $graphics.FillEllipse($ink, 71.5, 42.5, 7, 7)
  $graphics.FillEllipse($white, 72.7, 43.2, 2.2, 2.2)
  Fill-Path $graphics $wing {
    param($p)
    $p.AddBezier(79, 67, 93, 64, 105, 72, 112, 84)
    $p.AddBezier(112, 84, 100, 95, 78, 98, 62, 88)
    $p.AddBezier(62, 88, 66, 79, 71, 71, 79, 67)
    $p.CloseFigure()
  }
  Stroke-Path $graphics $wingLine 3 {
    param($p)
    $p.StartFigure()
    $p.AddBezier(83, 78, 94, 82, 103, 82, 112, 77)
    $p.StartFigure()
    $p.AddBezier(78, 88, 91, 92, 103, 90, 114, 83)
  }
  Stroke-Path $graphics $leg 4.5 {
    param($p)
    $p.StartFigure()
    $p.AddLine(72, 103, 65, 127)
    $p.StartFigure()
    $p.AddLine(91, 104, 93, 127)
  }
  Stroke-Path $graphics $leg 3.8 {
    param($p)
    $p.StartFigure()
    $p.AddLine(63, 127, 53, 130)
    $p.StartFigure()
    $p.AddLine(65, 127, 75, 127)
    $p.StartFigure()
    $p.AddLine(93, 127, 84, 130)
    $p.StartFigure()
    $p.AddLine(94, 127, 105, 127)
  }

  @($cardinal, $cardinalDark, $wing, $mask, $beak, $beakDark, $white, $ink) | ForEach-Object { $_.Dispose() }
  $graphics.Restore($state)
}

function New-CardinalPng($path, $size, $background, $transparent, $drawDisc) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  if ($transparent) {
    $graphics.Clear([System.Drawing.Color]::Transparent)
  } else {
    $graphics.Clear((Color-Hex $background))
  }

  if ($drawDisc) {
    $disc = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 255, 248, 223))
    $graphics.FillEllipse($disc, $size * 0.12, $size * 0.12, $size * 0.76, $size * 0.76)
    $disc.Dispose()
  }

  $scale = $size / 235
  $x = $size * 0.12
  $y = $size * 0.20
  Draw-Cardinal $graphics $x $y $scale

  $graphics.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
New-CardinalPng (Join-Path $assetsDir 'icon.png') 1024 '#f4f7f2' $false $true
New-CardinalPng (Join-Path $assetsDir 'adaptive-icon.png') 1024 '#f4f7f2' $true $false
New-CardinalPng (Join-Path $assetsDir 'splash-icon.png') 1024 '#ffffff' $true $false
New-CardinalPng (Join-Path $assetsDir 'favicon.png') 192 '#f4f7f2' $false $true
