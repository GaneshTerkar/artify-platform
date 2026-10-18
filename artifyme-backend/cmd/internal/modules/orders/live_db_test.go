package orders_test

import (
	"context"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/orders"
)

// List of files previously used in prior tasks - strictly prohibited from being reused.
var previouslyUsedImages = []string{
	"Screenshot_20211223-215639__01.jpg",
	"Screenshot_20211223-215655__01.jpg",
	"Screenshot_20211223-215703__01.jpg",
	"PhotoGrid_1581055403972.jpg",
	"PhotoGrid_1581055541054.jpg",
	"PhotoGrid_1581056422304.jpg",
	"PhotoGrid_1581056490239.jpg",
	"PhotoGrid_1581058556583.jpg",
	"PhotoGrid_1581058790907.jpg",
	"PhotoGrid_1581058907670.jpg",
	"PhotoGrid_1581059479847.jpg",
	"sample1",
	"sample2",
	"sample3",
}

// resolvePaintingsDir finds the Paintings directory if present.
func resolvePaintingsDir() string {
	candidates := []string{
		"Paintings",
		"./Paintings",
		"../Paintings",
		"../../Paintings",
		"../../../Paintings",
		"../../../../Paintings",
		"d:/ArtifyMe/artify-platform/artifyme-backend/Paintings",
	}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			abs, _ := filepath.Abs(c)
			return abs
		}
	}
	return ""
}

// createSyntheticPortrait generates a high-quality test portrait JPEG.
func createSyntheticPortrait(t *testing.T, dir, filename, label string, bgCol, fgCol color.RGBA) string {
	t.Helper()
	w, h := 400, 500
	img := image.NewRGBA(image.Rect(0, 0, w, h))

	// Draw gradient background
	for y := 0; y < h; y++ {
		factor := float64(y) / float64(h)
		r := uint8(float64(bgCol.R)*(1-factor) + float64(bgCol.R)*0.6*factor)
		g := uint8(float64(bgCol.G)*(1-factor) + float64(bgCol.G)*0.6*factor)
		b := uint8(float64(bgCol.B)*(1-factor) + float64(bgCol.B)*0.6*factor)
		for x := 0; x < w; x++ {
			img.SetRGBA(x, y, color.RGBA{R: r, G: g, B: b, A: 255})
		}
	}

	// Draw portrait head oval (center 200, 190, rx 85, ry 110)
	centerX, centerY := 200, 190
	rx, ry := 85, 110
	for y := centerY - ry; y <= centerY+ry; y++ {
		for x := centerX - rx; x <= centerX+rx; x++ {
			dx := float64(x - centerX) / float64(rx)
			dy := float64(y - centerY) / float64(ry)
			if dx*dx+dy*dy <= 1.0 {
				img.SetRGBA(x, y, fgCol)
			}
		}
	}

	// Draw shoulders / torso
	for y := centerY + ry - 20; y < h; y++ {
		widthAtY := int(float64(y-(centerY+ry-20))*1.5) + rx
		for x := centerX - widthAtY; x <= centerX+widthAtY; x++ {
			if x >= 0 && x < w {
				img.SetRGBA(x, y, color.RGBA{
					R: uint8(float64(fgCol.R) * 0.7),
					G: uint8(float64(fgCol.G) * 0.7),
					B: uint8(float64(fgCol.B) * 0.7),
					A: 255,
				})
			}
		}
	}

	outPath := filepath.Join(dir, filename)
	_ = os.MkdirAll(filepath.Dir(outPath), 0755)
	f, err := os.Create(outPath)
	if err != nil {
		t.Fatalf("Failed to create synthetic test image: %v", err)
	}
	defer f.Close()

	if err := jpeg.Encode(f, img, &jpeg.Options{Quality: 92}); err != nil {
		t.Fatalf("Failed to encode synthetic test image: %v", err)
	}
	return outPath
}

// getSamplePortraitPath returns either the file in Paintings dir or generates a synthetic portrait.
func getSamplePortraitPath(t *testing.T, dir, filename, label string, cat orders.PaintingCategory) string {
	t.Helper()
	if dir != "" {
		p := filepath.Join(dir, filename)
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			return p
		}
	}
	tempDir := t.TempDir()
	var bg, fg color.RGBA
	switch cat {
	case "PENCIL":
		bg, fg = color.RGBA{240, 240, 240, 255}, color.RGBA{70, 75, 80, 255}
	case "CHARCOAL":
		bg, fg = color.RGBA{220, 220, 220, 255}, color.RGBA{25, 25, 30, 255}
	case "OIL":
		bg, fg = color.RGBA{250, 235, 215, 255}, color.RGBA{170, 95, 35, 255}
	case "ACRYLIC":
		bg, fg = color.RGBA{220, 245, 255, 255}, color.RGBA{25, 135, 215, 255}
	case "WATERCOLOR":
		bg, fg = color.RGBA{240, 255, 245, 255}, color.RGBA{35, 175, 135, 255}
	default:
		bg, fg = color.RGBA{230, 230, 230, 255}, color.RGBA{90, 90, 90, 255}
	}
	return createSyntheticPortrait(t, tempDir, filename, label, bg, fg)
}

// resolveUploadsDir finds or creates the uploads directory.
func resolveUploadsDir() string {
	candidates := []string{
		"uploads",
		"./uploads",
		"../uploads",
		"../../uploads",
		"../../../uploads",
		"../../../../uploads",
		"d:/ArtifyMe/artify-platform/artifyme-backend/uploads",
	}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			abs, _ := filepath.Abs(c)
			return abs
		}
	}
	fallback := "d:/ArtifyMe/artify-platform/artifyme-backend/uploads"
	_ = os.MkdirAll(fallback, 0755)
	return fallback
}

// connectLiveDB connects to the live PostgreSQL instance.
func connectLiveDB(t *testing.T) *pgxpool.Pool {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("Failed to connect to live DB (%s): %v", dbURL, err)
	}
	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("Failed to ping live DB (%s): %v", dbURL, err)
	}
	return pool
}

// assertUnusedImage verifies that a filename was never used in any earlier sessions.
func assertUnusedImage(t *testing.T, filename string) {
	t.Helper()
	base := filepath.Base(filename)
	for _, forbidden := range previouslyUsedImages {
		if strings.EqualFold(base, forbidden) || strings.Contains(strings.ToLower(base), strings.ToLower(forbidden)) {
			t.Fatalf("VIOLATION: Attempted to use previously used image %q! Must use only fresh images.", base)
		}
	}
}

// loadLocalImage decodes an image from disk.
func loadLocalImage(t *testing.T, path string) image.Image {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatalf("Failed to open image file %s: %v", path, err)
	}
	defer f.Close()

	img, _, err := image.Decode(f)
	if err != nil {
		t.Fatalf("Failed to decode image %s: %v", path, err)
	}
	return img
}

// ensureTestUser retrieves an existing user or creates a test user on the live DB.
func ensureTestUser(t *testing.T, pool *pgxpool.Pool, role, email, name string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(), "SELECT user_id FROM users WHERE email = $1", email).Scan(&id)
	if err == nil {
		if role == "ARTIST" {
			_, _ = pool.Exec(context.Background(), `
				INSERT INTO artist_profiles (artist_id, bio, experience_years, verified, created_at, updated_at)
				VALUES ($1, 'Master portrait artist with 7+ years experience.', 7, TRUE, NOW(), NOW())
				ON CONFLICT (artist_id) DO UPDATE SET verified = TRUE
			`, id)
		}
		if email != "ganesh@example.com" {
			t.Cleanup(func() {
				if role == "ARTIST" {
					_, _ = pool.Exec(context.Background(), "DELETE FROM artist_profiles WHERE artist_id = $1", id)
				}
				_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE user_id = $1", id)
			})
		}
		return id
	}

	err = pool.QueryRow(context.Background(), `
		INSERT INTO users (full_name, email, address, phone_number, password_hash, role, status, created_at, updated_at)
		VALUES ($1, $2, '123 Quality Assurance Lane', '+919876543210', 'test_password_hash', $3::user_role, 'ACTIVE', NOW(), NOW())
		RETURNING user_id
	`, name, email, role).Scan(&id)
	if err != nil {
		t.Fatalf("Failed to ensure test user (%s, %s): %v", role, email, err)
	}

	if role == "ARTIST" {
		_, _ = pool.Exec(context.Background(), `
			INSERT INTO artist_profiles (artist_id, bio, experience_years, verified, created_at, updated_at)
			VALUES ($1, 'Master portrait artist with 7+ years experience.', 7, TRUE, NOW(), NOW())
			ON CONFLICT (artist_id) DO UPDATE SET verified = TRUE
		`, id)
	}

	if email != "ganesh@example.com" {
		t.Cleanup(func() {
			if role == "ARTIST" {
				_, _ = pool.Exec(context.Background(), "DELETE FROM artist_profiles WHERE artist_id = $1", id)
			}
			_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE user_id = $1", id)
		})
	}

	return id
}

// TestLiveCategoryWiseCollage tests:
// 1. Using provided sample portraits categorized by category names (PENCIL, CHARCOAL, OIL, ACRYLIC, WATERCOLOR)
// 2. Generating new category-wise portraits representing each group
// 3. Creating a composite collage arranging generated portraits by category showcasing distinct visual groupings
// 4. Verifying strictly NO previously used images are referenced.
func TestLiveCategoryWiseCollage(t *testing.T) {
	// Connect to live DB to verify connectivity
	pool := connectLiveDB(t)
	t.Cleanup(func() { pool.Close() })

	paintingsDir := resolvePaintingsDir()

	// 10 Completely fresh, never-before-used images mapped to the 5 official categories:
	freshCategoryMappings := map[orders.PaintingCategory][]struct {
		Filename    string
		Label       string
		Description string
	}{
		orders.PaintingCategory("PENCIL"): {
			{
				Filename:    "PhotoGrid_1581056549765.jpg",
				Label:       "Pencil Portrait #1",
				Description: "Man with mustache & glasses (Pencil)",
			},
			{
				Filename:    "PhotoGrid_1581056666012.jpg",
				Label:       "Pencil Portrait #2",
				Description: "Couple portrait (Graphite shading)",
			},
		},
		orders.PaintingCategory("CHARCOAL"): {
			{
				Filename:    "PhotoGrid_1581056344798.jpg",
				Label:       "Charcoal Portrait #1",
				Description: "Girl in bucket hat (Charcoal)",
			},
			{
				Filename:    "PhotoGrid_1581625154697.jpg",
				Label:       "Charcoal Portrait #2",
				Description: "Expressive portrait (Compressed willow)",
			},
		},
		orders.PaintingCategory("OIL"): {
			{
				Filename:    "PhotoGrid_1580669157513.jpg",
				Label:       "Oil Portrait #1",
				Description: "Couple in traditional attire (Oil glaze)",
			},
			{
				Filename:    "PhotoGrid_1590847935658.jpg",
				Label:       "Oil Portrait #2",
				Description: "Classic impasto artwork (Warm oil)",
			},
		},
		orders.PaintingCategory("ACRYLIC"): {
			{
				Filename:    "PhotoGrid_1581222315784.jpg",
				Label:       "Acrylic Portrait #1",
				Description: "Smiling couple (Vivid modern acrylic)",
			},
			{
				Filename:    "PhotoGrid_1581278322620.jpg",
				Label:       "Acrylic Portrait #2",
				Description: "Contemporary vibrant portrait (Acrylic)",
			},
		},
		orders.PaintingCategory("WATERCOLOR"): {
			{
				Filename:    "PhotoGrid_1581055639136.jpg",
				Label:       "Watercolor Portrait #1",
				Description: "Girl in neon green sweater (Watercolor)",
			},
			{
				Filename:    "PhotoGrid_1581055303423.jpg",
				Label:       "Watercolor Portrait #2",
				Description: "Delicate fluid wash portrait (Watercolor)",
			},
		},
	}

	groupedCollageInput := make(map[orders.PaintingCategory][]orders.CategoryPortraitItem)

	for cat, samples := range freshCategoryMappings {
		for _, s := range samples {
			// Enforce zero reuse constraint
			assertUnusedImage(t, s.Filename)

			// Load or synthesize fresh sample portrait
			fullPath := getSamplePortraitPath(t, paintingsDir, s.Filename, s.Label, cat)
			rawImg := loadLocalImage(t, fullPath)

			// Generate new category-wise portrait representing the group
			// (aspect ratio 220x240 for crisp portrait cards)
			generatedPortrait := orders.GenerateCategoryPortrait(rawImg, cat, 220, 240)
			if generatedPortrait == nil {
				t.Fatalf("Failed to generate category portrait for %s (%s)", cat, s.Filename)
			}

			groupedCollageInput[cat] = append(groupedCollageInput[cat], orders.CategoryPortraitItem{
				Image:       generatedPortrait,
				Label:       s.Label,
				SourceFile:  s.Filename,
				Description: s.Description,
			})
		}
	}

	// Build the master category-grouped collage
	uploadsDir := resolveUploadsDir()
	outputPath := filepath.Join(uploadsDir, "test_category_grouped_collage.jpg")
	t.Cleanup(func() {
		_ = os.Remove(outputPath)
	})

	collageImg, err := orders.BuildCategoryGroupedCollage(groupedCollageInput, outputPath)
	if err != nil {
		t.Fatalf("Failed to build category-grouped collage: %v", err)
	}

	// Verify output image dimensions and file persistence
	if collageImg.Bounds().Dx() != 1420 {
		t.Errorf("Expected collage width 1420, got %d", collageImg.Bounds().Dx())
	}
	if collageImg.Bounds().Dy() < 1800 {
		t.Errorf("Expected collage height >= 1800, got %d", collageImg.Bounds().Dy())
	}

	fi, err := os.Stat(outputPath)
	if err != nil {
		t.Fatalf("Collage output file not found at %s: %v", outputPath, err)
	}
	if fi.Size() < 50000 {
		t.Errorf("Collage output file is suspiciously small: %d bytes", fi.Size())
	}

	t.Logf("SUCCESS: Category-wise portraits generated and composite collage created at %s (%d bytes, %dx%d)",
		outputPath, fi.Size(), collageImg.Bounds().Dx(), collageImg.Bounds().Dy())
}

// TestLiveOrderFullLifecycleAndGalleryConfirmation tests the complete live order workflow:
// PLACED -> CONFIRMED -> ASSIGNED_ARTIST -> IN_PROGRESS -> COMPLETED (with auto-collage, gallery=false)
// -> Public gallery excludes unconfirmed -> Admin confirms -> gallery=true, final_image_url=collage
// -> Public gallery includes confirmed collaged artwork.
func TestLiveOrderFullLifecycleAndGalleryConfirmation(t *testing.T) {
	pool := connectLiveDB(t)
	t.Cleanup(func() { pool.Close() })

	ctx := context.Background()
	repo := orders.NewRepository(pool)
	baseURL := "http://localhost:8080"
	service := orders.NewService(repo, nil, baseURL)

	// Ensure live DB test users exist
	adminID := ensureTestUser(t, pool, "ADMIN", "ganesh@example.com", "Ganesh Terkar")
	artistID := ensureTestUser(t, pool, "ARTIST", "rohan.artist@example.com", "Rohan Artist")
	customerID := ensureTestUser(t, pool, "CUSTOMER", "priya.customer@example.com", "Priya Customer")
	deliveryAgentID := ensureTestUser(t, pool, "DELIVERY_AGENT", "vikram.delivery@example.com", "Vikram Delivery")

	// Strictly fresh unused images for this live test:
	refPhotoFile := "fresh_test_ref_girl_glasses.jpg"
	artworkFile := "fresh_test_artwork_pencil_sketch.jpg"
	assertUnusedImage(t, refPhotoFile)
	assertUnusedImage(t, artworkFile)

	paintingsDir := resolvePaintingsDir()
	refPhotoPath := getSamplePortraitPath(t, paintingsDir, refPhotoFile, "Reference Portrait", "WATERCOLOR")
	artworkPath := getSamplePortraitPath(t, paintingsDir, artworkFile, "Pencil Artwork", "PENCIL")

	notes := fmt.Sprintf("Live DB automated test order %s", time.Now().Format(time.RFC3339))

	// STEP 1: Customer creates order
	createIn := orders.CreateOrderInput{
		UserID:            customerID,
		PaintingCategory:  "PENCIL",
		ReferenceImageURL: refPhotoPath,
		Size:              "A4",
		PersonsIncluded:   "SINGLE",
		DeliveryAddress:   "123 Quality Assurance Lane, Test City, 411001",
		CustomerNotes:     &notes,
	}
	ord, err := service.CreateOrder(ctx, customerID, createIn)
	if err != nil {
		t.Fatalf("Step 1 failed: service.CreateOrder: %v", err)
	}
	orderID := ord.OrderID
	uploadsDir := resolveUploadsDir()
	t.Cleanup(func() {
		// Cleanup test order history and record
		_, _ = pool.Exec(context.Background(), "DELETE FROM order_status_history WHERE order_id = $1", orderID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM payments WHERE order_id = $1", orderID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM orders WHERE order_id = $1", orderID)
		// Cleanup generated collage file if created
		_ = os.Remove(filepath.Join(uploadsDir, fmt.Sprintf("collage_%s.jpg", orderID.String())))
	})

	if ord.Status != orders.StatusPlaced {
		t.Fatalf("Expected status PLACED, got %s", ord.Status)
	}

	// STEP 2: Payment confirmation -> CONFIRMED
	ord, err = service.TransitionStatus(ctx, orderID, adminID, "ADMIN", orders.StatusConfirmed, nil, nil, nil)
	if err != nil {
		t.Fatalf("Step 2 failed: TransitionStatus to CONFIRMED: %v", err)
	}
	if ord.Status != orders.StatusConfirmed {
		t.Fatalf("Expected status CONFIRMED, got %s", ord.Status)
	}

	// STEP 3: Admin assigns artist -> ASSIGNED_ARTIST
	ord, err = service.AssignOrder(ctx, orderID, adminID, "ADMIN", artistID)
	if err != nil {
		t.Fatalf("Step 3 failed: AssignOrder: %v", err)
	}
	if ord.Status != orders.StatusAssignedArtist {
		t.Fatalf("Expected status ASSIGNED_ARTIST, got %s", ord.Status)
	}
	if ord.ArtistID == nil || *ord.ArtistID != artistID {
		t.Fatalf("Expected artist_id %s, got %v", artistID, ord.ArtistID)
	}

	// STEP 4: Artist starts order -> IN_PROGRESS
	ord, err = service.TransitionStatus(ctx, orderID, artistID, "ARTIST", orders.StatusInProgress, nil, nil, nil)
	if err != nil {
		t.Fatalf("Step 4 failed: TransitionStatus to IN_PROGRESS: %v", err)
	}
	if ord.Status != orders.StatusInProgress {
		t.Fatalf("Expected status IN_PROGRESS, got %s", ord.Status)
	}

	// STEP 5: Artist completes drawing with final artwork -> COMPLETED
	// Automatically generates collage from reference photo and finished artwork
	ord, err = service.TransitionStatus(ctx, orderID, artistID, "ARTIST", orders.StatusCompleted, nil, &artworkPath, nil)
	if err != nil {
		t.Fatalf("Step 5 failed: TransitionStatus to COMPLETED: %v", err)
	}
	if ord.Status != orders.StatusCompleted {
		t.Fatalf("Expected status COMPLETED, got %s", ord.Status)
	}
	if ord.CollageImageURL == nil || *ord.CollageImageURL == "" {
		t.Fatalf("Expected collage_image_url to be generated, got nil or empty")
	}
	if ord.OriginalFinalImageURL == nil || *ord.OriginalFinalImageURL == "" {
		t.Fatalf("Expected original_final_image_url to store sketch, got nil")
	}
	// CRITICAL REQUIREMENT: Must NOT be published to gallery before admin confirms
	if ord.IsPublishedToGallery {
		t.Fatalf("Expected is_published_to_gallery=FALSE before admin confirmation, got TRUE")
	}

	// STEP 6: Verify unconfirmed artwork is NOT in public gallery
	galleryBefore, err := service.ListGalleryPaintings(ctx, "PENCIL")
	if err != nil {
		t.Fatalf("Step 6 failed: ListGalleryPaintings: %v", err)
	}
	for _, p := range galleryBefore {
		if p.ID == orderID.String() {
			t.Fatalf("UNAUTHORIZED: Unconfirmed completed order %s appeared in public gallery!", orderID)
		}
	}

	// STEP 7: Admin assigns Delivery Agent -> ASSIGNED_DELIVERY_AGENT
	ord, err = service.AssignDeliveryAgent(ctx, orderID, adminID, "ADMIN", deliveryAgentID)
	if err != nil {
		t.Fatalf("Step 7 failed: AssignDeliveryAgent: %v", err)
	}
	if ord.Status != orders.StatusAssignedDeliveryAgent {
		t.Fatalf("Expected status ASSIGNED_DELIVERY_AGENT, got %s", ord.Status)
	}
	if ord.DeliveryAgentID == nil || *ord.DeliveryAgentID != deliveryAgentID {
		t.Fatalf("Expected delivery_agent_id %s, got %v", deliveryAgentID, ord.DeliveryAgentID)
	}

	// STEP 8: Delivery Agent starts transit -> IN_TRANSIT
	ord, err = service.TransitionStatus(ctx, orderID, deliveryAgentID, "DELIVERY_AGENT", orders.StatusInTransit, nil, nil, nil)
	if err != nil {
		t.Fatalf("Step 8 failed: TransitionStatus to IN_TRANSIT: %v", err)
	}
	if ord.Status != orders.StatusInTransit {
		t.Fatalf("Expected status IN_TRANSIT, got %s", ord.Status)
	}

	// STEP 9: Delivery Agent moves out for delivery -> OUT_FOR_DELIVERY
	ord, err = service.TransitionStatus(ctx, orderID, deliveryAgentID, "DELIVERY_AGENT", orders.StatusOutForDelivery, nil, nil, nil)
	if err != nil {
		t.Fatalf("Step 9 failed: TransitionStatus to OUT_FOR_DELIVERY: %v", err)
	}
	if ord.Status != orders.StatusOutForDelivery {
		t.Fatalf("Expected status OUT_FOR_DELIVERY, got %s", ord.Status)
	}

	// STEP 10: Delivery Agent confirms doorstep delivery -> DELIVERED
	ord, err = service.TransitionStatus(ctx, orderID, deliveryAgentID, "DELIVERY_AGENT", orders.StatusDelivered, nil, nil, nil)
	if err != nil {
		t.Fatalf("Step 10 failed: TransitionStatus to DELIVERED: %v", err)
	}
	if ord.Status != orders.StatusDelivered {
		t.Fatalf("Expected status DELIVERED, got %s", ord.Status)
	}

	// STEP 11: Admin inspects collage & delivered artwork, and confirms publication -> PUBLISHED
	ord, err = service.ConfirmGalleryPublish(ctx, orderID, adminID, "ADMIN")
	if err != nil {
		t.Fatalf("Step 11 failed: ConfirmGalleryPublish: %v", err)
	}
	if ord.Status != orders.StatusPublished {
		t.Fatalf("Expected status PUBLISHED, got %s", ord.Status)
	}
	if !ord.IsPublishedToGallery {
		t.Fatalf("Expected is_published_to_gallery=TRUE after admin confirmation, got FALSE")
	}
	if ord.FinalImageURL == nil || *ord.FinalImageURL != *ord.CollageImageURL {
		t.Fatalf("Expected final_image_url to equal collage_image_url %q, got %v",
			*ord.CollageImageURL, ord.FinalImageURL)
	}

	// STEP 12: Verify confirmed collaged artwork IS now visible in public gallery
	galleryAfter, err := service.ListGalleryPaintings(ctx, "PENCIL")
	if err != nil {
		t.Fatalf("Step 12 failed: ListGalleryPaintings after publish: %v", err)
	}
	foundInGallery := false
	for _, p := range galleryAfter {
		if p.ID == orderID.String() {
			foundInGallery = true
			if p.ImageURL != *ord.CollageImageURL {
				t.Fatalf("Gallery item image_url %q does not match collage URL %q",
					p.ImageURL, *ord.CollageImageURL)
			}
			break
		}
	}
	if !foundInGallery {
		t.Fatalf("Confirmed order %s was not found in public gallery!", orderID)
	}

	// STEP 13: Verify complete audit history in DB
	history, err := service.History(ctx, orderID, adminID, "ADMIN")
	if err != nil {
		t.Fatalf("Step 13 failed: service.History: %v", err)
	}
	if len(history) < 8 {
		t.Fatalf("Expected at least 8 status transitions in history, got %d", len(history))
	}

	t.Logf("SUCCESS: Live DB full multi-role order workflow (Customer -> Admin -> Artist -> Delivery Agent -> Admin Publish) passed 100%% for order %s", orderID)
}

// TestLiveRoleAuthorizationEnforcement verifies security boundaries on the live DB.
func TestLiveRoleAuthorizationEnforcement(t *testing.T) {
	pool := connectLiveDB(t)
	t.Cleanup(func() { pool.Close() })

	ctx := context.Background()
	repo := orders.NewRepository(pool)
	service := orders.NewService(repo, nil, "http://localhost:8080")

	adminID := ensureTestUser(t, pool, "ADMIN", "ganesh@example.com", "Ganesh Terkar")
	artistID := ensureTestUser(t, pool, "ARTIST", "rohan.artist@example.com", "Rohan Artist")
	customerID := ensureTestUser(t, pool, "CUSTOMER", "priya.customer@example.com", "Priya Customer")

	// Non-admin attempting to confirm gallery publish must be rejected immediately
	fakeOrderID := uuid.New()
	_, err := service.ConfirmGalleryPublish(ctx, fakeOrderID, customerID, "CUSTOMER")
	if err != orders.ErrForbidden {
		t.Fatalf("Expected ErrForbidden when CUSTOMER calls ConfirmGalleryPublish, got %v", err)
	}

	// Create a temporary live test order in PLACED status
	testIn := orders.CreateOrderInput{
		UserID:            customerID,
		PaintingCategory:  "PENCIL",
		ReferenceImageURL: "PhotoGrid_1581055639136.jpg",
		Size:              "A4",
		PersonsIncluded:   "SINGLE",
		DeliveryAddress:   "Test Auth Address",
	}
	testOrd, err := service.CreateOrder(ctx, customerID, testIn)
	if err != nil {
		t.Fatalf("Failed to create test order for auth testing: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM order_status_history WHERE order_id = $1", testOrd.OrderID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM orders WHERE order_id = $1", testOrd.OrderID)
	})

	// Customer cannot jump transition to completed
	_, err = service.TransitionStatus(ctx, testOrd.OrderID, customerID, "CUSTOMER", orders.StatusCompleted, nil, nil, nil)
	if err != orders.ErrInvalidTransition {
		t.Fatalf("Expected ErrInvalidTransition when CUSTOMER tries to jump to COMPLETED, got %v", err)
	}

	// Unassigned artist cannot update an order
	_, err = service.TransitionStatus(ctx, testOrd.OrderID, artistID, "ARTIST", orders.StatusInProgress, nil, nil, nil)
	if err == nil {
		t.Fatalf("Expected error when unassigned artist tries to update order, got nil")
	}

	// Delivery agent cannot update an unassigned order
	deliveryAgentID := ensureTestUser(t, pool, "DELIVERY_AGENT", "vikram.delivery@example.com", "Vikram Delivery")
	_, err = service.TransitionStatus(ctx, testOrd.OrderID, deliveryAgentID, "DELIVERY_AGENT", orders.StatusInTransit, nil, nil, nil)
	if err == nil {
		t.Fatalf("Expected error when unassigned delivery agent tries to update order, got nil")
	}

	// Random unverified artist cannot be assigned
	randomArtistID := uuid.New()
	_, err = service.AssignOrder(ctx, testOrd.OrderID, adminID, "ADMIN", randomArtistID)
	if err != orders.ErrArtistNotVerified {
		t.Fatalf("Expected ErrArtistNotVerified when assigning unverified artist, got %v", err)
	}

	t.Log("SUCCESS: Role authorization security boundaries verified against live DB.")
}

// TestLiveCatalogPricingAndProducts verifies catalog metadata and dynamic price estimation.
func TestLiveCatalogPricingAndProducts(t *testing.T) {
	prod := orders.DefaultPortraitProduct()
	if prod.ID != "portrait-sketch" {
		t.Fatalf("Expected product ID 'portrait-sketch', got %s", prod.ID)
	}
	if len(prod.Categories) != 5 {
		t.Fatalf("Expected 5 categories in catalog, got %d", len(prod.Categories))
	}

	// Verify all 5 categories price estimates
	categories := []string{"PENCIL", "CHARCOAL", "OIL", "ACRYLIC", "WATERCOLOR"}
	for _, c := range categories {
		priceSingle := orders.EstimatePrice(c, "A4", "SINGLE")
		priceCouple := orders.EstimatePrice(c, "A4", "COUPLE")
		if priceSingle <= 0 || priceCouple <= priceSingle {
			t.Errorf("Invalid price calculations for category %s: single=%.2f, couple=%.2f",
				c, priceSingle, priceCouple)
		}
	}

	t.Log("SUCCESS: Catalog products and price formulas verified.")
}
