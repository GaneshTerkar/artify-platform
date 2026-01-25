package logger

import (
	"log/slog"
	"os"
)

func InitLogger() {
	level := slog.LevelInfo

	switch os.Getenv("LOG_LEVEL") {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}

	logger := slog.New(
		slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level: level,
		}),
	)

	slog.SetDefault(logger)
	slog.Info("Logger initialized", "level", level.String())
}
