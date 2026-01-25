package db

import (
	"fmt"
	"log/slog"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func RunMigrations(databaseURL, migrationPath string) error {
	migrationPath = filepath.ToSlash(migrationPath)
	sourceURL := "file://" + migrationPath

	slog.Debug(
		"resolved migration path",
		"migration_path", migrationPath,
		"source_url", sourceURL,
	)

	m, err := migrate.New(sourceURL, databaseURL)
	if err != nil {
		slog.Error("migration initialization failed", "source", sourceURL, "error", err)
		return fmt.Errorf("migration init failed: %w", err)
	}

	slog.Info("running database migrations")

	err = m.Up()
	switch err {
	case nil:
		slog.Info("database migrations applied successfully")

	case migrate.ErrNoChange:
		slog.Debug("database schema already up to date")

	default:
		slog.Error("database migration failed", "error", err)
		return fmt.Errorf("migration up failed: %w", err)
	}

	return nil
}
