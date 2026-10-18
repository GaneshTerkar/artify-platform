package orders

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

type FileUploader interface {
	UploadBytes(ctx context.Context, data []byte, filename, contentType, baseURL string) (string, error)
}

func loadImage(src string) (image.Image, error) {
	src = strings.TrimSpace(src)
	if src == "" {
		return nil, fmt.Errorf("empty image source")
	}

	// 1. Direct local file check
	if _, err := os.Stat(src); err == nil {
		f, err := os.Open(src)
		if err != nil {
			return nil, err
		}
		defer f.Close()
		img, _, err := image.Decode(f)
		return img, err
	}

	// 2. Check trimmed prefix and base name in local directories
	trimmed := strings.TrimPrefix(src, "/")
	if _, err := os.Stat(trimmed); err == nil {
		f, err := os.Open(trimmed)
		if err == nil {
			defer f.Close()
			if img, _, err := image.Decode(f); err == nil {
				return img, nil
			}
		}
	}

	baseName := filepath.Base(trimmed)
	for _, dir := range []string{"./uploads", "./Paintings", "./paintings"} {
		p := filepath.Join(dir, baseName)
		if _, err := os.Stat(p); err == nil {
			f, err := os.Open(p)
			if err == nil {
				defer f.Close()
				if img, _, err := image.Decode(f); err == nil {
					return img, nil
				}
			}
		}
	}

	// 3. Check if it's a URL referencing a local file in ./uploads or ./Paintings
	if strings.HasPrefix(src, "http://") || strings.HasPrefix(src, "https://") {
		parsed, err := url.Parse(src)
		if err == nil {
			bName := filepath.Base(parsed.Path)
			for _, dir := range []string{"./uploads", "./Paintings", "./paintings"} {
				p := filepath.Join(dir, bName)
				if _, err := os.Stat(p); err == nil {
					f, err := os.Open(p)
					if err == nil {
						defer f.Close()
						if img, _, err := image.Decode(f); err == nil {
							return img, nil
						}
					}
				}
			}
		}

		// 3. Fallback to HTTP GET
		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Get(src)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch image from %s: %w", src, err)
		}
		defer resp.Body.Close()

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, fmt.Errorf("HTTP error fetching %s: status %d", src, resp.StatusCode)
		}

		data, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read response body: %w", err)
		}

		img, _, err := image.Decode(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("failed to decode image from %s: %w", src, err)
		}
		return img, nil
	}

	// 4. Try relative path in ./uploads
	localUploads := filepath.Join("./uploads", filepath.Base(src))
	if _, err := os.Stat(localUploads); err == nil {
		f, err := os.Open(localUploads)
		if err != nil {
			return nil, err
		}
		defer f.Close()
		img, _, err := image.Decode(f)
		return img, err
	}

	return nil, fmt.Errorf("could not locate image source: %s", src)
}

// bilinearScale smoothly resamples src image to (dstW, dstH) using standard bilinear filtering.
func bilinearScale(src image.Image, dstW, dstH int) *image.RGBA {
	dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))
	bounds := src.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()

	if srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0 {
		return dst
	}

	xRatio := float64(srcW) / float64(dstW)
	yRatio := float64(srcH) / float64(dstH)

	for y := 0; y < dstH; y++ {
		srcY := (float64(y) + 0.5)*yRatio - 0.5
		if srcY < 0 {
			srcY = 0
		}
		yLow := int(srcY)
		yHigh := yLow + 1
		if yHigh >= srcH {
			yHigh = srcH - 1
		}
		yWeight := srcY - float64(yLow)

		for x := 0; x < dstW; x++ {
			srcX := (float64(x) + 0.5)*xRatio - 0.5
			if srcX < 0 {
				srcX = 0
			}
			xLow := int(srcX)
			xHigh := xLow + 1
			if xHigh >= srcW {
				xHigh = srcW - 1
			}
			xWeight := srcX - float64(xLow)

			c00 := src.At(bounds.Min.X+xLow, bounds.Min.Y+yLow)
			c10 := src.At(bounds.Min.X+xHigh, bounds.Min.Y+yLow)
			c01 := src.At(bounds.Min.X+xLow, bounds.Min.Y+yHigh)
			c11 := src.At(bounds.Min.X+xHigh, bounds.Min.Y+yHigh)

			r00, g00, b00, a00 := c00.RGBA()
			r10, g10, b10, a10 := c10.RGBA()
			r01, g01, b01, a01 := c01.RGBA()
			r11, g11, b11, a11 := c11.RGBA()

			rTop := float64(r00)*(1-xWeight) + float64(r10)*xWeight
			gTop := float64(g00)*(1-xWeight) + float64(g10)*xWeight
			bTop := float64(b00)*(1-xWeight) + float64(b10)*xWeight
			aTop := float64(a00)*(1-xWeight) + float64(a10)*xWeight

			rBot := float64(r01)*(1-xWeight) + float64(r11)*xWeight
			gBot := float64(g01)*(1-xWeight) + float64(g11)*xWeight
			bBot := float64(b01)*(1-xWeight) + float64(b11)*xWeight
			aBot := float64(a01)*(1-xWeight) + float64(a11)*xWeight

			r := uint8((rTop*(1-yWeight) + rBot*yWeight) / 257)
			g := uint8((gTop*(1-yWeight) + gBot*yWeight) / 257)
			b := uint8((bTop*(1-yWeight) + bBot*yWeight) / 257)
			a := uint8((aTop*(1-yWeight) + aBot*yWeight) / 257)

			dst.SetRGBA(x, y, color.RGBA{R: r, G: g, B: b, A: a})
		}
	}
	return dst
}

// GenerateCollage composites the customer's reference photo into the bottom-left
// corner of the artist's finished artwork, matching the ArtifyMe collage format.
// It normalizes the canvas to the exact standard 4:5 portrait card ratio (1200 x 1500)
// matching the platform's order cards and public gallery frames with high-resolution clarity.
func GenerateCollage(ctx context.Context, orderID uuid.UUID, mainImageURL, refImageURL string, uploader FileUploader, baseURL string) (string, error) {
	if mainImageURL == "" || refImageURL == "" {
		return "", fmt.Errorf("both main and reference image URLs are required")
	}

	slog.Info("generating artwork collage with 4:5 exact card ratio enhancement", "order_id", orderID, "main", mainImageURL, "ref", refImageURL)

	mainImg, err := loadImage(mainImageURL)
	if err != nil {
		return "", fmt.Errorf("failed to load final artwork: %w", err)
	}

	refImg, err := loadImage(refImageURL)
	if err != nil {
		return "", fmt.Errorf("failed to load reference photo: %w", err)
	}

	mainBounds := mainImg.Bounds()
	mainW := mainBounds.Dx()
	mainH := mainBounds.Dy()

	refBounds := refImg.Bounds()
	refW := refBounds.Dx()
	refH := refBounds.Dy()

	if mainW <= 0 || mainH <= 0 || refW <= 0 || refH <= 0 {
		return "", fmt.Errorf("invalid image dimensions")
	}

	// Exact target canvas resolution: 1200 x 1500 (4:5 Card Ratio)
	canvasW := 1200
	canvasH := 1500
	canvas := image.NewRGBA(image.Rect(0, 0, canvasW, canvasH))

	mainRatio := float64(mainW) / float64(mainH)
	targetRatio := float64(canvasW) / float64(canvasH) // 0.80

	if mainRatio >= 0.76 && mainRatio <= 0.84 {
		// Native 4:5 portrait artwork: scale directly to fill the 1200x1500 canvas
		scaledMain := bilinearScale(mainImg, canvasW, canvasH)
		draw.Draw(canvas, canvas.Bounds(), scaledMain, image.Point{}, draw.Src)
	} else {
		// Non-4:5 artwork (Landscape, Square, or Ultra-wide):
		// 1. Create luxurious ambient background by downsampling main image to 24x30 and scaling up to 1200x1500
		tiny := bilinearScale(mainImg, 24, 30)
		ambient := bilinearScale(tiny, canvasW, canvasH)
		draw.Draw(canvas, canvas.Bounds(), ambient, image.Point{}, draw.Src)

		// 2. Darken ambient background with deep studio wash
		darkWash := color.RGBA{R: 11, G: 15, B: 25, A: 190}
		draw.Draw(canvas, canvas.Bounds(), &image.Uniform{darkWash}, image.Point{}, draw.Over)

		// 3. Scale main artwork to fit within canvas bounds without ANY cropping
		var drawW, drawH int
		if mainRatio > targetRatio {
			// Wider than 4:5: Fit width
			drawW = canvasW
			drawH = int(float64(canvasW) / mainRatio)
		} else {
			// Taller than 4:5: Fit height
			drawH = canvasH
			drawW = int(float64(canvasH) * mainRatio)
		}

		scaledMain := bilinearScale(mainImg, drawW, drawH)
		offsetX := (canvasW - drawW) / 2
		offsetY := (canvasH - drawH) / 2

		// 4. Subtle drop shadow behind the main artwork
		if offsetY > 0 || offsetX > 0 {
			shadowColor := color.RGBA{R: 0, G: 0, B: 0, A: 140}
			shadowRect := image.Rect(offsetX, offsetY+4, offsetX+drawW, offsetY+drawH+12)
			draw.Draw(canvas, shadowRect, &image.Uniform{shadowColor}, image.Point{}, draw.Over)
		}

		// 5. Draw main artwork centered
		mainRect := image.Rect(offsetX, offsetY, offsetX+drawW, offsetY+drawH)
		draw.Draw(canvas, mainRect, scaledMain, image.Point{}, draw.Over)
	}

	// 6. High-Definition Reference Photo Inset in bottom-left
	insetW := 280
	insetH := int(float64(refH) * float64(insetW) / float64(refW))
	if insetH > 350 {
		insetH = 350
		insetW = int(float64(refW) * float64(insetH) / float64(refH))
	}

	border := 7
	margin := 36

	cardW := insetW + border*2
	cardH := insetH + border*2
	cardX := margin
	cardY := canvasH - cardH - margin

	// Drop shadow for reference card
	shadowOffset := 6
	shadowColor := color.RGBA{R: 0, G: 0, B: 0, A: 140}
	shadowRect := image.Rect(cardX+shadowOffset, cardY+shadowOffset, cardX+cardW+shadowOffset, cardY+cardH+shadowOffset)
	draw.Draw(canvas, shadowRect, &image.Uniform{shadowColor}, image.Point{}, draw.Over)

	// Crisp white photo card border
	cardRect := image.Rect(cardX, cardY, cardX+cardW, cardY+cardH)
	draw.Draw(canvas, cardRect, &image.Uniform{color.White}, image.Point{}, draw.Over)

	// Scaled reference photo
	scaledRef := bilinearScale(refImg, insetW, insetH)
	innerRect := image.Rect(cardX+border, cardY+border, cardX+border+insetW, cardY+border+insetH)
	draw.Draw(canvas, innerRect, scaledRef, image.Point{}, draw.Over)

	// 7. Encode output JPEG with high quality (94)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, canvas, &jpeg.Options{Quality: 94}); err != nil {
		return "", fmt.Errorf("failed to encode collage JPEG: %w", err)
	}

	// 8. Save/upload file
	filename := fmt.Sprintf("collage_%s.jpg", orderID.String())
	if uploader != nil {
		collageURL, err := uploader.UploadBytes(ctx, buf.Bytes(), filename, "image/jpeg", baseURL)
		if err != nil {
			return "", fmt.Errorf("failed to upload collage: %w", err)
		}
		slog.Info("collage successfully created and uploaded with 4:5 exact card ratio", "order_id", orderID, "url", collageURL)
		return collageURL, nil
	}

	// Fallback to local save if uploader is nil
	localPath := resolveUploadFilePath(filename)
	_ = os.MkdirAll(filepath.Dir(localPath), 0755)
	if err := os.WriteFile(localPath, buf.Bytes(), 0644); err != nil {
		return "", fmt.Errorf("failed to write local collage: %w", err)
	}
	localURL := fmt.Sprintf("%s/uploads/%s", strings.TrimRight(baseURL, "/"), filename)
	return localURL, nil
}

func resolveUploadFilePath(filename string) string {
	candidates := []string{
		"./uploads",
		"../uploads",
		"../../uploads",
		"../../../uploads",
		"../../../../uploads",
		"d:/ArtifyMe/artify-platform/artifyme-backend/uploads",
	}
	for _, dir := range candidates {
		if fi, err := os.Stat(dir); err == nil && fi.IsDir() {
			return filepath.Join(dir, filename)
		}
	}
	_ = os.MkdirAll("./uploads", 0755)
	return filepath.Join("./uploads", filename)
}
