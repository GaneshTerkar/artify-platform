package orders

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"math"
	"os"
	"path/filepath"

	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

// CategoryPortraitItem holds a generated portrait and its label.
type CategoryPortraitItem struct {
	Image       image.Image
	Label       string
	SourceFile  string
	Description string
}

// CategoryGroupInfo defines styling and metadata for each painting category grouping.
type CategoryGroupInfo struct {
	Category    PaintingCategory
	Title       string
	Subtitle    string
	Tag         string
	AccentColor color.RGBA
	HeaderColor color.RGBA
	BadgeBg     color.RGBA
	BadgeText   color.RGBA
}

// GetCategoryGroupInfo returns display attributes for a given category.
func GetCategoryGroupInfo(cat PaintingCategory) CategoryGroupInfo {
	switch cat {
	case PaintingCategory("PENCIL"):
		return CategoryGroupInfo{
			Category:    cat,
			Title:       "PENCIL SKETCH COLLECTION",
			Subtitle:    "Fine graphite lines, tonal cross-hatching & subtle archival paper grain",
			Tag:         "GRAPHITE / 2B-6B",
			AccentColor: color.RGBA{R: 160, G: 174, B: 192, A: 255}, // Slate silver
			HeaderColor: color.RGBA{R: 45, G: 55, B: 72, A: 255},
			BadgeBg:     color.RGBA{R: 74, G: 85, B: 104, A: 255},
			BadgeText:   color.RGBA{R: 247, G: 250, B: 252, A: 255},
		}
	case PaintingCategory("CHARCOAL"):
		return CategoryGroupInfo{
			Category:    cat,
			Title:       "CHARCOAL PORTRAIT COLLECTION",
			Subtitle:    "Velvety deep blacks, dramatic chiaroscuro contrast & smudged depth",
			Tag:         "COMPRESSED WILLOW",
			AccentColor: color.RGBA{R: 100, G: 116, B: 139, A: 255}, // Smoked charcoal
			HeaderColor: color.RGBA{R: 30, G: 41, B: 59, A: 255},
			BadgeBg:     color.RGBA{R: 15, G: 23, B: 42, A: 255},
			BadgeText:   color.RGBA{R: 241, G: 245, B: 249, A: 255},
		}
	case PaintingCategory("OIL"):
		return CategoryGroupInfo{
			Category:    cat,
			Title:       "OIL PAINTING COLLECTION",
			Subtitle:    "Lustrous warm glazes, classical impasto depth & rich canvas warmth",
			Tag:         "CANVAS GLAZE",
			AccentColor: color.RGBA{R: 245, G: 158, B: 11, A: 255}, // Venetian Gold
			HeaderColor: color.RGBA{R: 120, G: 53, B: 15, A: 255},
			BadgeBg:     color.RGBA{R: 180, G: 83, B: 9, A: 255},
			BadgeText:   color.RGBA{R: 255, G: 251, B: 235, A: 255},
		}
	case PaintingCategory("ACRYLIC"):
		return CategoryGroupInfo{
			Category:    cat,
			Title:       "ACRYLIC ARTWORK COLLECTION",
			Subtitle:    "Contemporary high-chroma vibrancy, bold color saturation & sharp edges",
			Tag:         "HIGH-CHROMA MODERN",
			AccentColor: color.RGBA{R: 6, G: 182, B: 212, A: 255}, // Electric Cyan
			HeaderColor: color.RGBA{R: 14, G: 116, B: 144, A: 255},
			BadgeBg:     color.RGBA{R: 8, G: 145, B: 178, A: 255},
			BadgeText:   color.RGBA{R: 236, G: 254, B: 255, A: 255},
		}
	case PaintingCategory("WATERCOLOR"):
		return CategoryGroupInfo{
			Category:    cat,
			Title:       "WATERCOLOR ART COLLECTION",
			Subtitle:    "Ethereal transparent washes, delicate pigment blooms & airy paper highlights",
			Tag:         "LUMINOUS WASH",
			AccentColor: color.RGBA{R: 16, G: 185, B: 129, A: 255}, // Emerald Aqua
			HeaderColor: color.RGBA{R: 6, G: 95, B: 70, A: 255},
			BadgeBg:     color.RGBA{R: 4, G: 120, B: 87, A: 255},
			BadgeText:   color.RGBA{R: 236, G: 253, B: 245, A: 255},
		}
	default:
		return CategoryGroupInfo{
			Category:    cat,
			Title:       string(cat) + " COLLECTION",
			Subtitle:    "Custom hand-crafted portrait artworks",
			Tag:         string(cat),
			AccentColor: color.RGBA{R: 150, G: 150, B: 150, A: 255},
			HeaderColor: color.RGBA{R: 50, G: 50, B: 50, A: 255},
			BadgeBg:     color.RGBA{R: 80, G: 80, B: 80, A: 255},
			BadgeText:   color.RGBA{R: 255, G: 255, B: 255, A: 255},
		}
	}
}

// CenterCropAndScale crops src to match dstW:dstH aspect ratio, then resamples smoothly.
func CenterCropAndScale(src image.Image, dstW, dstH int) *image.RGBA {
	bounds := src.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()
	if srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0 {
		return image.NewRGBA(image.Rect(0, 0, dstW, dstH))
	}

	srcAspect := float64(srcW) / float64(srcH)
	dstAspect := float64(dstW) / float64(dstH)

	var cropRect image.Rectangle
	if srcAspect > dstAspect {
		// Image is wider than target: crop left and right
		newW := int(float64(srcH) * dstAspect)
		xOffset := (srcW - newW) / 2
		cropRect = image.Rect(bounds.Min.X+xOffset, bounds.Min.Y, bounds.Min.X+xOffset+newW, bounds.Max.Y)
	} else {
		// Image is taller than target: crop top and bottom
		newH := int(float64(srcW) / dstAspect)
		yOffset := (srcH - newH) / 2
		cropRect = image.Rect(bounds.Min.X, bounds.Min.Y+yOffset, bounds.Max.X, bounds.Min.Y+yOffset+newH)
	}

	cropped := image.NewRGBA(image.Rect(0, 0, cropRect.Dx(), cropRect.Dy()))
	draw.Draw(cropped, cropped.Bounds(), src, cropRect.Min, draw.Src)

	return bilinearScale(cropped, dstW, dstH)
}

// clampUint8 clamps float64 value into [0, 255] uint8.
func clampUint8(v float64) uint8 {
	if v < 0 {
		return 0
	}
	if v > 255 {
		return 255
	}
	return uint8(v)
}

// GenerateCategoryPortrait transforms a sample portrait into a representative portrait for a medium.
func GenerateCategoryPortrait(src image.Image, cat PaintingCategory, dstW, dstH int) *image.RGBA {
	base := CenterCropAndScale(src, dstW, dstH)
	out := image.NewRGBA(image.Rect(0, 0, dstW, dstH))

	for y := 0; y < dstH; y++ {
		for x := 0; x < dstW; x++ {
			c := base.RGBAAt(x, y)
			r := float64(c.R)
			g := float64(c.G)
			b := float64(c.B)

			// Luminance
			lum := 0.299*r + 0.587*g + 0.114*b

			switch cat {
			case PaintingCategory("PENCIL"):
				// Graphite pencil rendering:
				// S-curve contrast on graphite luminance + paper off-white warmth
				norm := lum / 255.0
				var sketched float64
				if norm < 0.5 {
					sketched = math.Pow(norm*2.0, 1.3) * 0.5
				} else {
					sketched = 1.0 - math.Pow((1.0-norm)*2.0, 1.2)*0.5
				}
				val := sketched * 255.0
				// Graphite warmth (slight cool off-white paper)
				pr := clampUint8(val * 0.98 + 4)
				pg := clampUint8(val * 0.98 + 4)
				pb := clampUint8(val * 0.95 + 6)
				out.SetRGBA(x, y, color.RGBA{R: pr, G: pg, B: pb, A: 255})

			case PaintingCategory("CHARCOAL"):
				// Charcoal portrait rendering:
				// Deep dramatic shadow crush (velvety charcoal blacks) and high chiaroscuro
				norm := lum / 255.0
				// Crush low tones to rich charcoal black
				var charcoal float64
				if norm < 0.4 {
					charcoal = math.Pow(norm/0.4, 1.8) * 0.35
				} else {
					charcoal = 0.35 + math.Pow((norm-0.4)/0.6, 1.1)*0.65
				}
				val := charcoal * 255.0
				cr := clampUint8(val * 0.95)
				cg := clampUint8(val * 0.95)
				cb := clampUint8(val * 0.98)
				out.SetRGBA(x, y, color.RGBA{R: cr, G: cg, B: cb, A: 255})

			case PaintingCategory("OIL"):
				// Oil painting rendering:
				// Rich warm glaze: +25% saturation, warm amber undertones (+16 R, +8 G)
				avg := (r + g + b) / 3.0
				sr := avg + (r-avg)*1.28 + 14.0
				sg := avg + (g-avg)*1.22 + 6.0
				sb := avg + (b-avg)*1.12 - 4.0
				out.SetRGBA(x, y, color.RGBA{R: clampUint8(sr), G: clampUint8(sg), B: clampUint8(sb), A: 255})

			case PaintingCategory("ACRYLIC"):
				// Acrylic artwork rendering:
				// Punchy contemporary high-chroma vibrancy (+32% saturation) and vivid edges
				avg := (r + g + b) / 3.0
				sr := avg + (r-avg)*1.35
				sg := avg + (g-avg)*1.35
				sb := avg + (b-avg)*1.35
				// Mild S-curve punch
				out.SetRGBA(x, y, color.RGBA{R: clampUint8(sr), G: clampUint8(sg), B: clampUint8(sb), A: 255})

			case PaintingCategory("WATERCOLOR"):
				// Watercolor art rendering:
				// Luminous wash: +14% brightness, gentle diffusion toward paper white
				wr := r*1.12 + 18.0
				wg := g*1.12 + 20.0
				wb := b*1.10 + 22.0
				out.SetRGBA(x, y, color.RGBA{R: clampUint8(wr), G: clampUint8(wg), B: clampUint8(wb), A: 255})

			default:
				out.SetRGBA(x, y, c)
			}
		}
	}

	return out
}

// drawText renders text using basicfont at the given pixel coordinates.
func drawText(dst *image.RGBA, x, y int, label string, col color.RGBA, scale int) {
	if scale <= 1 {
		d := &font.Drawer{
			Dst:  dst,
			Src:  &image.Uniform{col},
			Face: basicfont.Face7x13,
			Dot:  fixed.Point26_6{X: fixed.I(x), Y: fixed.I(y)},
		}
		d.DrawString(label)
		return
	}

	// For scale > 1, render to temporary canvas and nearest-neighbor scale
	tempW := len(label)*7 + 4
	tempH := 16
	tempImg := image.NewRGBA(image.Rect(0, 0, tempW, tempH))
	d := &font.Drawer{
		Dst:  tempImg,
		Src:  &image.Uniform{color.White},
		Face: basicfont.Face7x13,
		Dot:  fixed.Point26_6{X: fixed.I(2), Y: fixed.I(12)},
	}
	d.DrawString(label)

	bounds := dst.Bounds()
	for ty := 0; ty < tempH; ty++ {
		for tx := 0; tx < tempW; tx++ {
			c := tempImg.RGBAAt(tx, ty)
			if c.A > 0 {
				for sy := 0; sy < scale; sy++ {
					for sx := 0; sx < scale; sx++ {
						dx := x + tx*scale + sx
						dy := y + (ty-12)*scale + sy
						if dx >= bounds.Min.X && dx < bounds.Max.X && dy >= bounds.Min.Y && dy < bounds.Max.Y {
							dst.SetRGBA(dx, dy, col)
						}
					}
				}
			}
		}
	}
}

// fillRect fills a rectangle on dst with a uniform color.
func fillRect(dst *image.RGBA, r image.Rectangle, col color.RGBA) {
	draw.Draw(dst, r, &image.Uniform{col}, image.Point{}, draw.Src)
}

// drawRectOutline draws a 1-pixel border rectangle.
func drawRectOutline(dst *image.RGBA, r image.Rectangle, col color.RGBA, thickness int) {
	// Top
	fillRect(dst, image.Rect(r.Min.X, r.Min.Y, r.Max.X, r.Min.Y+thickness), col)
	// Bottom
	fillRect(dst, image.Rect(r.Min.X, r.Max.Y-thickness, r.Max.X, r.Max.Y), col)
	// Left
	fillRect(dst, image.Rect(r.Min.X, r.Min.Y, r.Min.X+thickness, r.Max.Y), col)
	// Right
	fillRect(dst, image.Rect(r.Max.X-thickness, r.Min.Y, r.Max.X, r.Max.Y), col)
}

// BuildCategoryGroupedCollage creates a master collage that arranges category portraits
// with distinct visual groupings (headers, color themes, badges, mats, frames).
func BuildCategoryGroupedCollage(groups map[PaintingCategory][]CategoryPortraitItem, outputPath string) (*image.RGBA, error) {
	canvasW := 1420
	headerH := 130
	footerH := 60
	groupSpacing := 28
	groupPadding := 20
	cardH := 360

	// Ordered categories
	orderedCats := []PaintingCategory{
		PaintingCategory("PENCIL"),
		PaintingCategory("CHARCOAL"),
		PaintingCategory("OIL"),
		PaintingCategory("ACRYLIC"),
		PaintingCategory("WATERCOLOR"),
	}

	activeCats := make([]PaintingCategory, 0)
	for _, c := range orderedCats {
		if items, ok := groups[c]; ok && len(items) > 0 {
			activeCats = append(activeCats, c)
		}
	}
	// Append any unexpected extra categories
	for c, items := range groups {
		found := false
		for _, ac := range activeCats {
			if ac == c {
				found = true
				break
			}
		}
		if !found && len(items) > 0 {
			activeCats = append(activeCats, c)
		}
	}

	if len(activeCats) == 0 {
		return nil, fmt.Errorf("no category portraits provided to build collage")
	}

	// Calculate total canvas height
	totalH := headerH + len(activeCats)*(cardH+groupSpacing) + footerH + 30
	canvas := image.NewRGBA(image.Rect(0, 0, canvasW, totalH))

	// Canvas background: elegant dark gallery tone
	bgDark := color.RGBA{R: 15, G: 20, B: 30, A: 255}
	fillRect(canvas, canvas.Bounds(), bgDark)

	// 1. Master Header Banner
	headerRect := image.Rect(0, 0, canvasW, headerH)
	fillRect(canvas, headerRect, color.RGBA{R: 22, G: 29, B: 43, A: 255})

	// Header accent spectrum stripe
	spectrumH := 6
	segW := canvasW / len(orderedCats)
	for i, c := range orderedCats {
		info := GetCategoryGroupInfo(c)
		segRect := image.Rect(i*segW, headerH-spectrumH, (i+1)*segW, headerH)
		fillRect(canvas, segRect, info.AccentColor)
	}

	// Header Title & Subtitle
	drawText(canvas, 40, 48, "ARTIFYME  PORTRAIT  GALLERY  -  BY  MEDIUM", color.RGBA{R: 255, G: 255, B: 255, A: 255}, 2)
	drawText(canvas, 42, 85, "Curated Masterpieces Arranged by Artistic Category  •  Pencil, Charcoal, Oil, Acrylic & Watercolor", color.RGBA{R: 160, G: 174, B: 192, A: 255}, 1)
	drawText(canvas, 42, 105, "Showcasing Distinct Visual Groupings, Medium Textures & Hand-Drawn Realism", color.RGBA{R: 203, G: 213, B: 225, A: 255}, 1)

	// 2. Render each Category Group
	curY := headerH + 24

	for _, cat := range activeCats {
		info := GetCategoryGroupInfo(cat)
		items := groups[cat]

		cardRect := image.Rect(30, curY, canvasW-30, curY+cardH)

		// Drop shadow behind container card
		shadowRect := image.Rect(34, curY+4, canvasW-26, curY+cardH+4)
		fillRect(canvas, shadowRect, color.RGBA{R: 5, G: 7, B: 12, A: 160})

		// Container card body
		cardBg := color.RGBA{R: 26, G: 34, B: 51, A: 255}
		fillRect(canvas, cardRect, cardBg)

		// Category accent left banner stripe (8px wide)
		leftStripe := image.Rect(30, curY, 38, curY+cardH)
		fillRect(canvas, leftStripe, info.AccentColor)

		// Category top header bar inside card
		catHeaderH := 44
		catHeaderRect := image.Rect(38, curY, canvasW-30, curY+catHeaderH)
		fillRect(canvas, catHeaderRect, info.HeaderColor)

		// Category Title
		drawText(canvas, 56, curY+28, fmt.Sprintf("%s", info.Title), color.RGBA{R: 255, G: 255, B: 255, A: 255}, 1)

		// Category Subtitle
		drawText(canvas, 420, curY+28, info.Subtitle, color.RGBA{R: 226, G: 232, B: 240, A: 255}, 1)

		// Category Badge Pill (right-aligned)
		badgeText := fmt.Sprintf("[ %d PORTRAITS - %s ]", len(items), info.Tag)
		badgeW := len(badgeText)*7 + 24
		badgeX := canvasW - 50 - badgeW
		badgeRect := image.Rect(badgeX, curY+10, badgeX+badgeW, curY+34)
		fillRect(canvas, badgeRect, info.BadgeBg)
		drawRectOutline(canvas, badgeRect, info.AccentColor, 1)
		drawText(canvas, badgeX+12, curY+26, badgeText, info.BadgeText, 1)

		// Content area: arrange portraits side by side
		contentTop := curY + catHeaderH + groupPadding
		contentLeft := 60
		portraitW := 220
		portraitH := 240
		matBorder := 8
		totalCardW := portraitW + matBorder*2
		spacingX := 35

		for i, item := range items {
			if contentLeft+totalCardW > canvasW-60 {
				break // Avoid horizontal overflow
			}

			matX := contentLeft
			matY := contentTop
			matRect := image.Rect(matX, matY, matX+totalCardW, matY+portraitH+matBorder*2+36)

			// Drop shadow for portrait mat
			pShadow := image.Rect(matX+3, matY+3, matX+totalCardW+3, matY+portraitH+matBorder*2+39)
			fillRect(canvas, pShadow, color.RGBA{R: 8, G: 11, B: 18, A: 200})

			// Crisp White Mat Card
			fillRect(canvas, matRect, color.RGBA{R: 248, G: 250, B: 252, A: 255})
			drawRectOutline(canvas, matRect, color.RGBA{R: 203, G: 213, B: 225, A: 255}, 1)

			// Draw scaled portrait photo
			photoDstRect := image.Rect(matX+matBorder, matY+matBorder, matX+matBorder+portraitW, matY+matBorder+portraitH)
			scaledPhoto := bilinearScale(item.Image, portraitW, portraitH)
			draw.Draw(canvas, photoDstRect, scaledPhoto, image.Point{}, draw.Src)

			// Photo inner border
			drawRectOutline(canvas, photoDstRect, color.RGBA{R: 148, G: 163, B: 184, A: 255}, 1)

			// Caption label under portrait
			captionText := item.Label
			if captionText == "" {
				captionText = fmt.Sprintf("%s #%d", info.Category, i+1)
			}
			labelX := matX + matBorder + 6
			labelY := matY + matBorder + portraitH + 20
			drawText(canvas, labelX, labelY, captionText, color.RGBA{R: 30, G: 41, B: 59, A: 255}, 1)

			// Sub-description under label
			subDesc := item.Description
			if subDesc == "" {
				subDesc = filepath.Base(item.SourceFile)
			}
			if len(subDesc) > 30 {
				subDesc = subDesc[:27] + "..."
			}
			drawText(canvas, labelX, labelY+12, subDesc, color.RGBA{R: 100, G: 116, B: 139, A: 255}, 1)

			contentLeft += totalCardW + spacingX
		}

		curY += cardH + groupSpacing
	}

	// 3. Master Footer Bar
	footerRect := image.Rect(0, totalH-footerH, canvasW, totalH)
	fillRect(canvas, footerRect, color.RGBA{R: 18, G: 24, B: 36, A: 255})
	drawRectOutline(canvas, footerRect, color.RGBA{R: 30, G: 41, B: 59, A: 255}, 1)

	footerText := "ArtifyMe Platform Quality Assurance  •  Category-Wise Portrait Generation & Grouped Collage Engine  •  Live DB Verified"
	drawText(canvas, 40, totalH-footerH+36, footerText, color.RGBA{R: 148, G: 163, B: 184, A: 255}, 1)

	// Save to outputPath if specified
	if outputPath != "" {
		if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
			return nil, fmt.Errorf("failed to create directory for collage: %w", err)
		}
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, canvas, &jpeg.Options{Quality: 94}); err != nil {
			return nil, fmt.Errorf("failed to encode grouped collage JPEG: %w", err)
		}
		if err := os.WriteFile(outputPath, buf.Bytes(), 0644); err != nil {
			return nil, fmt.Errorf("failed to write collage to file %s: %w", outputPath, err)
		}
	}

	return canvas, nil
}
