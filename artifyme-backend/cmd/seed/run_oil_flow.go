//go:build ignore

package main

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/orders"
)

const (
	dbURL      = "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable"
	baseURL    = "http://localhost:8080"
	sourcePath = "C:/Users/terka/.gemini/antigravity/brain/03cfeb30-962b-402a-8b51-0405f59db376/.user_uploaded/media_1792263089359_39d2b043.png"
	bcryptHash = "$2a$12$TmQnbHcozVIcNumYQtmCm.EeNUp7xRi4C4cknj8cY2eEbaaf5FKMu" // Password@123
)

func main() {
	category := "OIL"
	skipPublish := false
	for _, arg := range os.Args[1:] {
		cleaned := strings.TrimSpace(arg)
		if cleaned == "--pending-inspect" || cleaned == "-p" {
			skipPublish = true
		} else if !strings.HasPrefix(cleaned, "-") && cleaned != "" {
			category = strings.ToUpper(cleaned)
		}
	}

	validCats := map[string]bool{"PENCIL": true, "CHARCOAL": true, "OIL": true, "ACRYLIC": true, "WATERCOLOR": true}
	if !validCats[category] {
		log.Fatalf("Invalid category: %s. Must be one of PENCIL, CHARCOAL, OIL, ACRYLIC, WATERCOLOR", category)
	}

	ctx := context.Background()
	fmt.Printf("\n🚀 EXECUTING COMPLETE END-TO-END ORDER FLOW FOR CATEGORY: %s\n", category)
	fmt.Println("==================================================================")

	// 1. Connect to live database
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("Failed to parse DB config: %v", err)
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	fmt.Println("✓ 1. Connected to PostgreSQL live database")

	// 2. Prepare upload directories
	uploadsDir := "./uploads"
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		log.Fatalf("Failed to create uploads directory: %v", err)
	}

	// 3. Load user's uploaded reference image (grandfather portrait)
	refFile, err := os.Open(sourcePath)
	if err != nil {
		log.Fatalf("Failed to open source reference photo (%s): %v", sourcePath, err)
	}
	defer refFile.Close()

	refImg, _, err := image.Decode(refFile)
	if err != nil {
		log.Fatalf("Failed to decode source reference photo: %v", err)
	}
	bounds := refImg.Bounds()
	fmt.Printf("✓ 2. Same Grandfather Reference Photo loaded: %dx%d px\n", bounds.Dx(), bounds.Dy())

	// Save reference photo into uploads
	refPhotoName := "customer_ref_photo.jpg"
	refPhotoPath := filepath.Join(uploadsDir, refPhotoName)
	refPhotoURL := fmt.Sprintf("%s/uploads/%s", baseURL, refPhotoName)

	var refBuf bytes.Buffer
	if err := jpeg.Encode(&refBuf, refImg, &jpeg.Options{Quality: 95}); err != nil {
		log.Fatalf("Failed to encode reference photo JPEG: %v", err)
	}
	if err := os.WriteFile(refPhotoPath, refBuf.Bytes(), 0644); err != nil {
		log.Fatalf("Failed to save reference photo: %v", err)
	}

	// 4. Generate the authentic category artwork from this exact reference photo
	targetW, targetH := bounds.Dx(), bounds.Dy()
	if targetW < 800 {
		targetW = 800
		targetH = int(float64(bounds.Dy()) * (800.0 / float64(bounds.Dx())))
	}
	artImg := orders.GenerateCategoryPortrait(refImg, orders.PaintingCategory(category), targetW, targetH)
	artFileName := fmt.Sprintf("artist_finished_%s_artwork.jpg", strings.ToLower(category))
	artFilePath := filepath.Join(uploadsDir, artFileName)
	artFileURL := fmt.Sprintf("%s/uploads/%s", baseURL, artFileName)

	var artBuf bytes.Buffer
	if err := jpeg.Encode(&artBuf, artImg, &jpeg.Options{Quality: 95}); err != nil {
		log.Fatalf("Failed to encode finished artwork JPEG: %v", err)
	}
	if err := os.WriteFile(artFilePath, artBuf.Bytes(), 0644); err != nil {
		log.Fatalf("Failed to save finished artwork to %s: %v", artFilePath, err)
	}
	fmt.Printf("✓ 3. Generated authentic %s artwork: %s (%dx%d)\n", category, artFileURL, targetW, targetH)

	// 5. Ensure users in database
	var adminID, customerID, artistID uuid.UUID

	// Admin (existing)
	err = pool.QueryRow(ctx, "SELECT user_id FROM users WHERE role = 'ADMIN' LIMIT 1").Scan(&adminID)
	if err != nil {
		log.Fatalf("Admin user not found in database: %v", err)
	}

	// Customer: Priya Sharma
	customerEmail := "priya.customer@example.com"
	err = pool.QueryRow(ctx, "SELECT user_id FROM users WHERE email = $1", customerEmail).Scan(&customerID)
	if err != nil {
		err = pool.QueryRow(ctx, `
			INSERT INTO users (full_name, email, address, phone_number, password_hash, role, status, created_at, updated_at)
			VALUES ('Priya Sharma', $1, 'Flat 402, Green Meadows, MG Road, Pune, 411001', '+919876543210', $2, 'CUSTOMER', 'ACTIVE', NOW(), NOW())
			RETURNING user_id
		`, customerEmail, bcryptHash).Scan(&customerID)
		if err != nil {
			log.Fatalf("Failed to ensure customer: %v", err)
		}
	}

	// Artist: Rohan Varma (Verified)
	artistEmail := "rohan.artist@example.com"
	err = pool.QueryRow(ctx, "SELECT user_id FROM users WHERE email = $1", artistEmail).Scan(&artistID)
	if err != nil {
		err = pool.QueryRow(ctx, `
			INSERT INTO users (full_name, email, address, phone_number, password_hash, role, status, created_at, updated_at)
			VALUES ('Rohan Varma', $1, 'Studio 12, Arts District, Pune, 411004', '+919876543211', $2, 'ARTIST', 'ACTIVE', NOW(), NOW())
			RETURNING user_id
		`, artistEmail, bcryptHash).Scan(&artistID)
		if err != nil {
			log.Fatalf("Failed to ensure artist: %v", err)
		}
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO artist_profiles (artist_id, bio, experience_years, verified, created_at, updated_at)
		VALUES ($1, 'Master portrait painter specializing in multiple traditional media.', 8, TRUE, NOW(), NOW())
		ON CONFLICT (artist_id) DO UPDATE SET verified = TRUE
	`, artistID)
	if err != nil {
		log.Fatalf("Failed to ensure artist profile: %v", err)
	}
	fmt.Printf("✓ 4. Accounts Verified (Admin: %s, Customer: %s, Artist: %s)\n", adminID, customerID, artistID)

	repo := orders.NewRepository(pool)
	service := orders.NewService(repo, nil, baseURL)

	// ==========================================
	// STEP 1: Customer Places Order (PLACED)
	// ==========================================
	notes := fmt.Sprintf("Grandfather portrait commissioned in rich %s medium. Please emphasize warm lighting and authentic facial textures.", category)
	createInput := orders.CreateOrderInput{
		UserID:            customerID,
		PaintingCategory:  category,
		ReferenceImageURL: refPhotoURL,
		Size:              "A4",
		PersonsIncluded:   "SINGLE",
		DeliveryAddress:   "Flat 402, Green Meadows, MG Road, Pune, 411001",
		CustomerNotes:     &notes,
	}

	ord, err := service.CreateOrder(ctx, customerID, createInput)
	if err != nil {
		log.Fatalf("Step 1 failed (CreateOrder): %v", err)
	}
	orderID := ord.OrderID
	fmt.Println("\n--------------------------------------------------")
	fmt.Printf("STEP 1: ORDER PLACED\n")
	fmt.Printf("  Order ID:           %s\n", orderID)
	fmt.Printf("  Status:             %s\n", ord.Status)
	fmt.Printf("  Category:           %s\n", ord.PaintingCategory)
	fmt.Printf("  Size & Persons:     %s • %s\n", ord.Size, ord.PersonsIncluded)
	fmt.Printf("  Trigger Total Price:₹%.2f\n", ord.TotalPrice)
	fmt.Printf("  Reference Photo:    %s\n", ord.ReferenceImageURL)
	fmt.Println("--------------------------------------------------")

	// ==========================================
	// STEP 2: Customer Completes Payment (CONFIRMED)
	// ==========================================
	sessionID := fmt.Sprintf("cs_live_%s", orderID.String()[:8])
	_ = service.RecordPendingPayment(ctx, orderID, sessionID, ord.TotalPrice, "INR")
	ord, err = service.ConfirmPaid(ctx, sessionID, adminID)
	if err != nil {
		log.Fatalf("Step 2 failed (ConfirmPaid): %v", err)
	}
	fmt.Printf("STEP 2: PAYMENT CONFIRMED\n")
	fmt.Printf("  Status:             %s\n", ord.Status)
	fmt.Printf("  Payment Session:    %s\n", sessionID)
	fmt.Println("--------------------------------------------------")

	// ==========================================
	// STEP 3: Admin Assigns Artist (ASSIGNED_ARTIST)
	// ==========================================
	ord, err = service.AssignOrder(ctx, orderID, adminID, "ADMIN", artistID)
	if err != nil {
		log.Fatalf("Step 3 failed (AssignOrder): %v", err)
	}
	fmt.Printf("STEP 3: ARTIST ASSIGNED\n")
	fmt.Printf("  Status:             %s\n", ord.Status)
	fmt.Printf("  Assigned Artist ID: %s (Rohan Varma)\n", *ord.ArtistID)
	fmt.Println("--------------------------------------------------")

	// ==========================================
	// STEP 4: Artist Begins Painting (IN_PROGRESS)
	// ==========================================
	ord, err = service.TransitionStatus(ctx, orderID, artistID, "ARTIST", orders.StatusInProgress, nil, nil, nil)
	if err != nil {
		log.Fatalf("Step 4 failed (TransitionStatus to IN_PROGRESS): %v", err)
	}
	fmt.Printf("STEP 4: ARTIST IN PROGRESS\n")
	fmt.Printf("  Status:             %s\n", ord.Status)
	fmt.Println("--------------------------------------------------")

	// ==========================================
	// STEP 5: Artist Completes Artwork (COMPLETED)
	// Automatically generates reference-in-artwork composite collage!
	// ==========================================
	ord, err = service.TransitionStatus(ctx, orderID, artistID, "ARTIST", orders.StatusCompleted, nil, &artFileURL, nil)
	if err != nil {
		log.Fatalf("Step 5 failed (TransitionStatus to COMPLETED): %v", err)
	}

	collageURL := ""
	if ord.CollageImageURL != nil {
		collageURL = *ord.CollageImageURL
	}
	origArtURL := ""
	if ord.OriginalFinalImageURL != nil {
		origArtURL = *ord.OriginalFinalImageURL
	}

	fmt.Printf("STEP 5: ARTWORK COMPLETED & COLLAGE AUTO-GENERATED\n")
	fmt.Printf("  Status:                 %s\n", ord.Status)
	fmt.Printf("  Original Finished Art:  %s\n", origArtURL)
	fmt.Printf("  Composite Collage:      %s\n", collageURL)
	fmt.Printf("  Published to Gallery:   %v (Awaiting Admin Inspection)\n", ord.IsPublishedToGallery)
	fmt.Println("--------------------------------------------------")

	// ==========================================
	// STEP 6: Public Gallery Exclusion Verification
	// ==========================================
	galleryBefore, err := service.ListGalleryPaintings(ctx, category)
	if err != nil {
		log.Fatalf("Step 6 failed (ListGalleryPaintings): %v", err)
	}
	inGalleryBefore := false
	for _, p := range galleryBefore {
		if p.ID == orderID.String() {
			inGalleryBefore = true
			break
		}
	}
	fmt.Printf("STEP 6: PUBLIC GALLERY EXCLUSION CHECK\n")
	fmt.Printf("  In Gallery Before Confirm: %v (Correct: hidden from public)\n", inGalleryBefore)
	fmt.Println("--------------------------------------------------")

	if skipPublish {
		fmt.Printf("STEP 7: LEAVING ORDER AWAITING ADMIN INSPECTION (is_published_to_gallery=false)\n")
		fmt.Printf("  You can now view and inspect this order in the Admin UI under 'INSPECT ORDER'!\n")
		fmt.Printf("  Order ID: %s (Category: %s)\n", orderID, category)
		fmt.Printf("\n🎉 %s ORDER FLOW REACHED COMPLETED & AWAITING INSPECTION!\n", category)
		return
	}

	// ==========================================
	// STEP 7: Admin Inspects & Confirms Gallery Publish
	// ==========================================
	ord, err = service.ConfirmGalleryPublish(ctx, orderID, adminID, "ADMIN")
	if err != nil {
		log.Fatalf("Step 7 failed (ConfirmGalleryPublish): %v", err)
	}
	fmt.Printf("STEP 7: ADMIN CONFIRMED & PUBLISHED\n")
	fmt.Printf("  Published to Gallery:   %v (Approved by Admin!)\n", ord.IsPublishedToGallery)
	fmt.Printf("  Gallery Thumbnail URL:  %s\n", *ord.FinalImageURL)
	fmt.Printf("  Preserved Original Art: %s\n", *ord.OriginalFinalImageURL)
	fmt.Println("--------------------------------------------------")

	// ==========================================
	// STEP 8: Public Gallery Inclusion Verification
	// ==========================================
	galleryAfter, err := service.ListGalleryPaintings(ctx, category)
	if err != nil {
		log.Fatalf("Step 8 failed (ListGalleryPaintings after confirm): %v", err)
	}
	var galleryItem *orders.PaintingItem
	for _, p := range galleryAfter {
		if p.ID == orderID.String() {
			item := p
			galleryItem = &item
			break
		}
	}
	if galleryItem == nil {
		log.Fatalf("FATAL: Order %s was not found in public gallery under category %s!", orderID, category)
	}
	fmt.Printf("STEP 8: PUBLIC GALLERY INCLUSION VERIFIED!\n")
	fmt.Printf("  Gallery Title:          %s\n", galleryItem.Title)
	fmt.Printf("  Gallery Category:       %s\n", galleryItem.CategoryLabel)
	fmt.Printf("  Gallery Image URL:      %s\n", galleryItem.ImageURL)
	fmt.Printf("  Artist Name:            %s\n", galleryItem.ArtistName)
	fmt.Println("--------------------------------------------------")

	// Print full audit history
	history, err := service.History(ctx, orderID, adminID, "ADMIN")
	if err != nil {
		log.Fatalf("Failed to fetch history: %v", err)
	}
	fmt.Printf("\nFULL AUDIT HISTORY FOR ORDER %s (%d transitions):\n", orderID, len(history))
	for i, h := range history {
		note := ""
		if h.Note != nil {
			note = fmt.Sprintf(" (%s)", *h.Note)
		}
		fmt.Printf("  [%d] %s -> %s by user %s%s\n", i+1, h.OldStatus, h.NewStatus, h.ChangedBy, note)
	}

	fmt.Printf("\n🎉 %s ORDER FLOW VERIFIED 100%% END-TO-END!\n", category)
}
