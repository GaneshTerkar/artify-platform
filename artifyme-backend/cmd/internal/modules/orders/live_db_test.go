package orders_test

import (
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
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

// resolvePaintingsDir finds the Paintings directory across various working directories.
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

// TestLiveCategoryWiseCollage tests:
// 1. Using provided sample portraits categorized by category names (PENCIL, CHARCOAL, OIL, ACRYLIC, WATERCOLOR)
// 2. Generating new category-wise portraits representing each group
// 3. Creating a composite collage arranging generated portraits by category showcasing distinct visual groupings
// 4. Verifying strictly NO previously used images are referenced.
func TestLiveCategoryWiseCollage(t *testing.T) {
	// Connect to live DB to verify connectivity
	pool := connectLiveDB(t)
	defer pool.Close()

	paintingsDir := resolvePaintingsDir()
	if paintingsDir == "" {
		t.Fatalf("Paintings directory not found")
	}

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

			fullPath := filepath.Join(paintingsDir, s.Filename)
			if _, err := os.Stat(fullPath); err != nil {
				t.Fatalf("Required fresh image %s missing from %s", s.Filename, paintingsDir)
			}

			// Load original raw sample
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
	defer pool.Close()

	ctx := context.Background()
	repo := orders.NewRepository(pool)
	baseURL := "http://localhost:8080"
	service := orders.NewService(repo, nil, baseURL)

	// Fetch live DB users
	var adminID, artistID, customerID uuid.UUID
	err := pool.QueryRow(ctx, "SELECT user_id FROM users WHERE role = 'ADMIN' LIMIT 1").Scan(&adminID)
	if err != nil {
		t.Fatalf("Failed to find ADMIN user in live DB: %v", err)
	}
	err = pool.QueryRow(ctx, "SELECT user_id FROM users WHERE role = 'ARTIST' LIMIT 1").Scan(&artistID)
	if err != nil {
		t.Fatalf("Failed to find ARTIST user in live DB: %v", err)
	}
	err = pool.QueryRow(ctx, "SELECT user_id FROM users WHERE role = 'CUSTOMER' LIMIT 1").Scan(&customerID)
	if err != nil {
		t.Fatalf("Failed to find CUSTOMER user in live DB: %v", err)
	}

	// Verify artist is verified
	var artistVerified bool
	err = pool.QueryRow(ctx, "SELECT verified FROM artist_profiles WHERE artist_id = $1", artistID).Scan(&artistVerified)
	if err != nil || !artistVerified {
		t.Fatalf("Artist %s must be verified in live DB: err=%v, verified=%v", artistID, err, artistVerified)
	}

	// Strictly fresh unused images for this live test:
	refPhotoFile := "PhotoGrid_1581055639136.jpg" // Fresh unused
	artworkFile := "PhotoGrid_1581056549765.jpg"  // Fresh unused
	assertUnusedImage(t, refPhotoFile)
	assertUnusedImage(t, artworkFile)

	paintingsDir := resolvePaintingsDir()
	refPhotoPath := filepath.Join(paintingsDir, refPhotoFile)
	artworkPath := filepath.Join(paintingsDir, artworkFile)

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
	t.Cleanup(func() {
		// Cleanup test order history and record
		_, _ = pool.Exec(context.Background(), "DELETE FROM order_status_history WHERE order_id = $1", orderID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM payments WHERE order_id = $1", orderID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM orders WHERE order_id = $1", orderID)
	})

	if ord.Status != orders.StatusPlaced {
		t.Fatalf("Expected status PLACED, got %s", ord.Status)
	}

	// STEP 2: Payment confirmation -> CONFIRMED
	ord, err = service.TransitionStatus(ctx, orderID, adminID, "ADMIN", orders.StatusConfirmed, nil, nil)
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
	ord, err = service.TransitionStatus(ctx, orderID, artistID, "ARTIST", orders.StatusInProgress, nil, nil)
	if err != nil {
		t.Fatalf("Step 4 failed: TransitionStatus to IN_PROGRESS: %v", err)
	}
	if ord.Status != orders.StatusInProgress {
		t.Fatalf("Expected status IN_PROGRESS, got %s", ord.Status)
	}

	// STEP 5: Artist completes drawing with final artwork -> COMPLETED
	// Automatically generates collage from reference photo and finished artwork
	ord, err = service.TransitionStatus(ctx, orderID, artistID, "ARTIST", orders.StatusCompleted, nil, &artworkPath)
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

	// STEP 7: Admin inspects collage and confirms publication
	ord, err = service.ConfirmGalleryPublish(ctx, orderID, adminID, "ADMIN")
	if err != nil {
		t.Fatalf("Step 7 failed: ConfirmGalleryPublish: %v", err)
	}
	if !ord.IsPublishedToGallery {
		t.Fatalf("Expected is_published_to_gallery=TRUE after admin confirmation, got FALSE")
	}
	if ord.FinalImageURL == nil || *ord.FinalImageURL != *ord.CollageImageURL {
		t.Fatalf("Expected final_image_url to equal collage_image_url %q, got %v",
			*ord.CollageImageURL, ord.FinalImageURL)
	}

	// STEP 8: Verify confirmed collaged artwork IS now visible in public gallery
	galleryAfter, err := service.ListGalleryPaintings(ctx, "PENCIL")
	if err != nil {
		t.Fatalf("Step 8 failed: ListGalleryPaintings after publish: %v", err)
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

	// STEP 9: Verify complete audit history in DB
	history, err := service.History(ctx, orderID, adminID, "ADMIN")
	if err != nil {
		t.Fatalf("Step 9 failed: service.History: %v", err)
	}
	if len(history) < 4 {
		t.Fatalf("Expected at least 4 status transitions in history, got %d", len(history))
	}

	t.Logf("SUCCESS: Live DB full order workflow and gallery confirmation passed 100%% for order %s", orderID)
}

// TestLiveRoleAuthorizationEnforcement verifies security boundaries on the live DB.
func TestLiveRoleAuthorizationEnforcement(t *testing.T) {
	pool := connectLiveDB(t)
	defer pool.Close()

	ctx := context.Background()
	repo := orders.NewRepository(pool)
	service := orders.NewService(repo, nil, "http://localhost:8080")

	var adminID, artistID, customerID uuid.UUID
	_ = pool.QueryRow(ctx, "SELECT user_id FROM users WHERE role = 'ADMIN' LIMIT 1").Scan(&adminID)
	_ = pool.QueryRow(ctx, "SELECT user_id FROM users WHERE role = 'ARTIST' LIMIT 1").Scan(&artistID)
	_ = pool.QueryRow(ctx, "SELECT user_id FROM users WHERE role = 'CUSTOMER' LIMIT 1").Scan(&customerID)

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
		_, _ = pool.Exec(context.Background(), "DELETE FROM orders WHERE order_id = $1", testOrd.OrderID)
	})

	// Customer cannot jump transition to completed
	_, err = service.TransitionStatus(ctx, testOrd.OrderID, customerID, "CUSTOMER", orders.StatusCompleted, nil, nil)
	if err != orders.ErrInvalidTransition {
		t.Fatalf("Expected ErrInvalidTransition when CUSTOMER tries to jump to COMPLETED, got %v", err)
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
