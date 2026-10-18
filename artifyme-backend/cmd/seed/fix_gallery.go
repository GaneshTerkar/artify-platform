package main

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "postgres://postgres:root@localhost:5432/artifyme?sslmode=disable")
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer pool.Close()

	// 1. Delete any dummy seed orders that point to non-existent sample files
	tag, err := pool.Exec(ctx, `
		DELETE FROM orders 
		WHERE final_image_url LIKE '%sample1_sketch_girl%' 
		   OR final_image_url LIKE '%sample2_sketch_woman%';
	`)
	if err != nil {
		log.Printf("Delete dummy orders error: %v", err)
	} else {
		fmt.Printf("Deleted %d dummy seed orders with missing sample files\n", tag.RowsAffected())
	}

	// 2. Ensure real pencil sketch order (ed342bda) is published to gallery if it exists
	var pencilOrderID string
	err = pool.QueryRow(ctx, `
		SELECT order_id FROM orders 
		WHERE painting_category = 'PENCIL' AND collage_image_url LIKE '%collage_ed342bda%'
		LIMIT 1;
	`).Scan(&pencilOrderID)
	if err == nil {
		_, _ = pool.Exec(ctx, `
			UPDATE orders 
			SET status = 'COMPLETED', is_published_to_gallery = TRUE 
			WHERE order_id = $1;
		`, pencilOrderID)
		fmt.Printf("Published real pencil sketch order: %s\n", pencilOrderID)
	}

	rows, err := pool.Query(ctx, `
		SELECT order_id, painting_category, status, is_published_to_gallery, reference_image_url, collage_image_url, final_image_url
		FROM orders
		ORDER BY created_at DESC;
	`)
	if err != nil {
		log.Fatalf("Query error: %v", err)
	}
	defer rows.Close()

	fmt.Println("\nAll Orders in DB:")
	for rows.Next() {
		var id, cat, st string
		var pub bool
		var ref, col, fin *string
		if err := rows.Scan(&id, &cat, &st, &pub, &ref, &col, &fin); err != nil {
			log.Fatal(err)
		}
		r := "<nil>"
		if ref != nil {
			r = *ref
		}
		c := "<nil>"
		if col != nil {
			c = *col
		}
		f := "<nil>"
		if fin != nil {
			f = *fin
		}
		fmt.Printf("  [%s] %s | status=%s | pub=%v | ref=%s | col=%s | fin=%s\n", cat, id[:8], st, pub, r, c, f)
	}
}
