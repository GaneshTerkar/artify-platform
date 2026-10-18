package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/ganeshterkar/artifyme-backend/cmd/internal/config"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/files"
	"github.com/ganeshterkar/artifyme-backend/cmd/internal/modules/orders"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable"
	ctx := context.Background()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("failed to connect to db: %v", err)
	}
	defer pool.Close()

	cfg := &config.Config{
		App: config.AppConfig{
			Port: "8080",
		},
	}
	_ = os.MkdirAll("./uploads", 0755)

	filesService := files.NewService(cfg)
	baseURL := "http://localhost:8080"

	// Existing admin: ganesh@example.com
	var adminID uuid.UUID
	err = pool.QueryRow(ctx, "SELECT user_id FROM users WHERE email = 'ganesh@example.com'").Scan(&adminID)
	if err != nil {
		log.Fatalf("could not find admin user: %v", err)
	}
	fmt.Printf("Admin found: %s (%s)\n", adminID, "ganesh@example.com")

	// Same password hash for password123
	passHash := "$2a$12$TmQnbHcozVIcNumYQtmCm.EeNUp7xRi4C4cknj8cY2eEbaaf5FKMu"

	// 1. Create or get Verified Artist: Rohan Sharma
	artistID := uuid.New()
	err = pool.QueryRow(ctx, `
		INSERT INTO users (user_id, full_name, email, address, phone_number, password_hash, role, status, created_at, updated_at)
		VALUES ($1, 'Rohan Sharma', 'rohan.artist@example.com', 'Studio 4, Kala Ghoda Arts, Mumbai', '+919876543210', $2, 'ARTIST', 'ACTIVE', NOW(), NOW())
		ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
		RETURNING user_id
	`, artistID, passHash).Scan(&artistID)
	if err != nil {
		log.Fatalf("failed to insert artist: %v", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO artist_profiles (artist_id, experience_years, bio, verified, created_at, updated_at)
		VALUES ($1, 7, 'Master of pencil and charcoal realism with 7+ years of portrait experience.', TRUE, NOW(), NOW())
		ON CONFLICT (artist_id) DO UPDATE SET verified = TRUE, experience_years = 7
	`, artistID)
	if err != nil {
		log.Fatalf("failed to upsert artist profile: %v", err)
	}
	fmt.Printf("Verified Artist configured: %s (rohan.artist@example.com)\n", artistID)

	// 2. Create or get Customer: Priya Patel
	customerID := uuid.New()
	err = pool.QueryRow(ctx, `
		INSERT INTO users (user_id, full_name, email, address, phone_number, password_hash, role, status, created_at, updated_at)
		VALUES ($1, 'Priya Patel', 'priya.customer@example.com', '42 MG Road, Bangalore, Karnataka', '+919123456789', $2, 'CUSTOMER', 'ACTIVE', NOW(), NOW())
		ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
		RETURNING user_id
	`, customerID, passHash).Scan(&customerID)
	if err != nil {
		log.Fatalf("failed to insert customer: %v", err)
	}
	fmt.Printf("Customer configured: %s (priya.customer@example.com)\n", customerID)

	// Clean out prior orders for fresh test setup
	_, _ = pool.Exec(ctx, "DELETE FROM order_status_history;")
	_, _ = pool.Exec(ctx, "DELETE FROM payments;")
	_, _ = pool.Exec(ctx, "DELETE FROM orders;")

	// Seeds for Order 1 & 2
	order1ID := uuid.New()
	order1Ref := ""
	order1Sketch := ""
	collage1URL := ""

	order2ID := uuid.New()
	order2Ref := ""
	order2Sketch := ""
	collage2URL := ""

	// ORDER 1: COMPLETED, Admin Confirmed & Published to Gallery (is_published_to_gallery = TRUE)
	_, err = pool.Exec(ctx, `
		INSERT INTO orders (
			order_id, user_id, artist_id, painting_category, reference_image_url,
			final_image_url, collage_image_url, original_final_image_url, is_published_to_gallery,
			size, persons_included, status, delivery_address, total_price, customer_notes,
			created_at, updated_at, updated_by
		) VALUES (
			$1, $2, $3, 'PENCIL', $4,
			$5, $5, $6, TRUE,
			'A3', 'SINGLE', 'COMPLETED', '42 MG Road, Bangalore, Karnataka', 1999.00,
			'Please capture subtle shading on the portrait.', NOW() - INTERVAL '3 days', NOW(), $7
		)
	`, order1ID, customerID, artistID, order1Ref, collage1URL, order1Sketch, adminID)
	if err != nil {
		log.Fatalf("failed to insert order 1: %v", err)
	}
	fmt.Printf("✓ Order 1 inserted: COMPLETED & Published to Gallery\n")

	// ORDER 2: COMPLETED, NOT yet confirmed by Admin (is_published_to_gallery = FALSE)
	_, err = pool.Exec(ctx, `
		INSERT INTO orders (
			order_id, user_id, artist_id, painting_category, reference_image_url,
			final_image_url, collage_image_url, original_final_image_url, is_published_to_gallery,
			size, persons_included, status, delivery_address, total_price, customer_notes,
			created_at, updated_at, updated_by
		) VALUES (
			$1, $2, $3, 'CHARCOAL', $4,
			$5, $6, NULL, FALSE,
			'A2', 'COUPLE', 'COMPLETED', 'Flat 302, Palm Heights, Pune, Maharashtra', 2999.00,
			'High contrast charcoal finish requested.', NOW() - INTERVAL '2 days', NOW(), $3
		)
	`, order2ID, customerID, artistID, order2Ref, order2Sketch, collage2URL)
	if err != nil {
		log.Fatalf("failed to insert order 2: %v", err)
	}
	fmt.Printf("✓ Order 2 inserted: COMPLETED & Pending Admin Inspection (is_published_to_gallery = FALSE)\n")

	// ORDER 3: IN_PROGRESS (Artist actively drawing)
	order3ID := uuid.New()
	_, err = pool.Exec(ctx, `
		INSERT INTO orders (
			order_id, user_id, artist_id, painting_category, reference_image_url,
			final_image_url, collage_image_url, original_final_image_url, is_published_to_gallery,
			size, persons_included, status, delivery_address, total_price, customer_notes,
			created_at, updated_at, updated_by
		) VALUES (
			$1, $2, $3, 'OIL', '',
			NULL, NULL, NULL, FALSE,
			'A2', 'SINGLE', 'IN_PROGRESS', 'Villa 12, Green Glen, Hyderabad, Telangana', 3999.00,
			'Oil painting on stretched canvas.', NOW() - INTERVAL '1 day', NOW(), $3
		)
	`, order3ID, customerID, artistID)
	if err != nil {
		log.Fatalf("failed to insert order 3: %v", err)
	}
	fmt.Printf("✓ Order 3 inserted: IN_PROGRESS\n")

	// ORDER 4: ASSIGNED_ARTIST (Assigned to Rohan, awaiting artist confirmation & start)
	order4ID := uuid.New()
	_, err = pool.Exec(ctx, `
		INSERT INTO orders (
			order_id, user_id, artist_id, painting_category, reference_image_url,
			final_image_url, collage_image_url, original_final_image_url, is_published_to_gallery,
			size, persons_included, status, delivery_address, total_price, customer_notes,
			created_at, updated_at, updated_by
		) VALUES (
			$1, $2, $3, 'WATERCOLOR', '',
			NULL, NULL, NULL, FALSE,
			'A3', 'COUPLE', 'ASSIGNED_ARTIST', '104 Sea View, Bandra West, Mumbai', 2499.00,
			'Vibrant watercolor palette please.', NOW() - INTERVAL '12 hours', NOW(), $4
		)
	`, order4ID, customerID, artistID, adminID)
	if err != nil {
		log.Fatalf("failed to insert order 4: %v", err)
	}
	fmt.Printf("✓ Order 4 inserted: ASSIGNED_ARTIST\n")

	// ORDER 5: CONFIRMED (Payment Confirmed, awaiting artist assignment by admin)
	order5ID := uuid.New()
	_, err = pool.Exec(ctx, `
		INSERT INTO orders (
			order_id, user_id, artist_id, painting_category, reference_image_url,
			final_image_url, collage_image_url, original_final_image_url, is_published_to_gallery,
			size, persons_included, status, delivery_address, total_price, customer_notes,
			created_at, updated_at, updated_by
		) VALUES (
			$1, $2, NULL, 'ACRYLIC', '',
			NULL, NULL, NULL, FALSE,
			'A4', 'SINGLE', 'CONFIRMED', '7 Park Avenue, Kolkata, West Bengal', 1499.00,
			'Warm lighting tone.', NOW() - INTERVAL '6 hours', NOW(), $2
		)
	`, order5ID, customerID)
	if err != nil {
		log.Fatalf("failed to insert order 5: %v", err)
	}
	fmt.Printf("✓ Order 5 inserted: CONFIRMED (Payment Confirmed, ready for assignment)\n")

	// ORDER 6: PLACED (Payment Pending)
	order6ID := uuid.New()
	_, err = pool.Exec(ctx, `
		INSERT INTO orders (
			order_id, user_id, artist_id, painting_category, reference_image_url,
			final_image_url, collage_image_url, original_final_image_url, is_published_to_gallery,
			size, persons_included, status, delivery_address, total_price, customer_notes,
			created_at, updated_at, updated_by
		) VALUES (
			$1, $2, NULL, 'PENCIL', '',
			NULL, NULL, NULL, FALSE,
			'A4', 'SINGLE', 'PLACED', '88 Civil Lines, Jaipur, Rajasthan', 999.00,
			'Draft order awaiting customer payment.', NOW() - INTERVAL '1 hour', NOW(), $2
		)
	`, order6ID, customerID)
	if err != nil {
		log.Fatalf("failed to insert order 6: %v", err)
	}
	fmt.Printf("✓ Order 6 inserted: PLACED (Payment Pending)\n")

	fmt.Println("\n=======================================================")
	fmt.Println("TEST DATA SEEDING COMPLETE!")
	fmt.Println("Admin: ganesh@example.com / password123")
	fmt.Println("Artist: rohan.artist@example.com / password123")
	fmt.Println("Customer: priya.customer@example.com / password123")
	fmt.Println("=======================================================")
}
