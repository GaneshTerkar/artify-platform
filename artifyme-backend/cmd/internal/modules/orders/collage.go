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

	// 2. Check if it's a URL referencing a local file in ./uploads or ./Paintings
	if strings.HasPrefix(src, "http://") || strings.HasPrefix(src, "https://") {
		parsed, err := url.Parse(src)
		if err == nil {
			baseName := filepath.Base(parsed.Path)
			localUploads := filepath.Join("./uploads", baseName)
			if _, err := os.Stat(localUploads); err == nil {
				f, err := os.Open(localUploads)
				if err == nil {
					defer f.Close()
					img, _, err := image.Decode(f)
					if err == nil {
						return img, nil
					}
				}
			}

			localPaintings := filepath.Join("./Paintings", baseName)
			if _, err := os.Stat(localPaintings); err == nil {
				f, err := os.Open(localPaintings)
				if err == nil {
					defer f.Close()
					img, _, err := image.Decode(f)
					if err == nil {
						return img, nil
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

	xRatio := float64(srcW-1) / float64(dstW)
	yRatio := float64(srcH-1) / float64(dstH)

	for y := 0; y < dstH; y++ {
		srcY := float64(y) * yRatio
		yLow := int(srcY)
		yHigh := yLow + 1
		if yHigh >= srcH {
			yHigh = srcH - 1
		}
		yWeight := srcY - float64(yLow)

		for x := 0; x < dstW; x++ {
			srcX := float64(x) * xRatio
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
func GenerateCollage(ctx context.Context, orderID uuid.UUID, mainImageURL, refImageURL string, uploader FileUploader, baseURL string) (string, error) {
	if mainImageURL == "" || refImageURL == "" {
		return "", fmt.Errorf("both main and reference image URLs are required")
	}

	slog.Info("generating artwork collage", "order_id", orderID, "main", mainImageURL, "ref", refImageURL)

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

	// Inset sizing: ~24% of the main canvas width
	insetW := int(float64(mainW) * 0.24)
	if insetW < 140 && mainW >= 280 {
		insetW = 140
	}
	if insetW > mainW/3 {
		insetW = mainW / 3
	}

	// Maintain aspect ratio of reference image
	insetH := int(float64(refH) * float64(insetW) / float64(refW))
	maxAllowedH := int(float64(mainH) * 0.35)
	if insetH > maxAllowedH && maxAllowedH > 0 {
		insetH = maxAllowedH
		insetW = int(float64(refW) * float64(insetH) / float64(refH))
	}

	// Crisp border and corner margin
	border := int(float64(insetW) * 0.035)
	if border < 4 {
		border = 4
	}

	margin := int(float64(mainW) * 0.02)
	if margin < 12 {
		margin = 12
	}

	cardW := insetW + border*2
	cardH := insetH + border*2

	// Position at bottom-left
	cardX := margin
	cardY := mainH - cardH - margin
	if cardY < 0 {
		cardY = 0
	}

	// Create output canvas
	canvas := image.NewRGBA(image.Rect(0, 0, mainW, mainH))

	// 1. Draw main finished artwork onto canvas
	draw.Draw(canvas, canvas.Bounds(), mainImg, mainBounds.Min, draw.Src)

	// 2. Draw subtle drop shadow behind the inset photo
	shadowOffset := border / 2
	if shadowOffset < 2 {
		shadowOffset = 2
	}
	shadowColor := color.RGBA{R: 0, G: 0, B: 0, A: 65}
	shadowRect := image.Rect(
		cardX+shadowOffset,
		cardY+shadowOffset,
		cardX+cardW+shadowOffset,
		cardY+cardH+shadowOffset,
	)
	draw.Draw(canvas, shadowRect, &image.Uniform{shadowColor}, image.Point{}, draw.Over)

	// 3. Draw clean white photo card border
	cardRect := image.Rect(cardX, cardY, cardX+cardW, cardY+cardH)
	draw.Draw(canvas, cardRect, &image.Uniform{color.White}, image.Point{}, draw.Over)

	// 4. Scale reference image and draw inside card
	scaledRef := bilinearScale(refImg, insetW, insetH)
	innerRect := image.Rect(cardX+border, cardY+border, cardX+border+insetW, cardY+border+insetH)
	draw.Draw(canvas, innerRect, scaledRef, image.Point{}, draw.Over)

	// 5. Encode output JPEG with high quality
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, canvas, &jpeg.Options{Quality: 92}); err != nil {
		return "", fmt.Errorf("failed to encode collage JPEG: %w", err)
	}

	// 6. Save/upload file
	filename := fmt.Sprintf("collage_%s.jpg", orderID.String())
	if uploader != nil {
		collageURL, err := uploader.UploadBytes(ctx, buf.Bytes(), filename, "image/jpeg", baseURL)
		if err != nil {
			return "", fmt.Errorf("failed to upload collage: %w", err)
		}
		slog.Info("collage successfully created and uploaded", "order_id", orderID, "url", collageURL)
		return collageURL, nil
	}

	// Fallback to local save if uploader is nil
	localPath := filepath.Join("./uploads", filename)
	if err := os.WriteFile(localPath, buf.Bytes(), 0644); err != nil {
		return "", fmt.Errorf("failed to write local collage: %w", err)
	}
	localURL := fmt.Sprintf("%s/uploads/%s", strings.TrimRight(baseURL, "/"), filename)
	return localURL, nil
}
