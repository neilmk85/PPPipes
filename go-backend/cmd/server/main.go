package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nilesh/pos-backend/internal/config"
	"github.com/nilesh/pos-backend/internal/database"
	"github.com/nilesh/pos-backend/internal/router"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/nilesh/pos-backend/internal/websocket"
)

func main() {
	// Load .env file if it exists
	if err := config.LoadEnvFile(".env"); err != nil {
		slog.Info("no .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Initialize logger
	initLogger(cfg.Env)

	slog.Info("P&P Pipe Products Backend starting",
		"env", cfg.Env,
		"port", cfg.Port,
		"frontend_url", cfg.FrontendUrl,
	)

	// Connect to database
	db, err := database.Connect(cfg.DBDsn, cfg.Env == "development")
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}

	// Initialize JWT configuration
	util.InitJWT(cfg.JwtSecret, cfg.JwtExpiry, cfg.JwtRefreshExpiry)

	// Run database migrations
	if err := database.Migrate(db); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	// Seed initial data
	if err := database.Seed(db); err != nil {
		slog.Error("failed to seed database", "error", err)
		os.Exit(1)
	}

	// Ensure every site project has a corresponding outlet
	siteProjectSvc := service.NewSiteProjectService(db)
	if err := siteProjectSvc.EnsureOutlets(); err != nil {
		slog.Warn("failed to ensure site project outlets", "error", err)
	}

	// Create WebSocket hub
	wsHub := websocket.NewHub()
	go wsHub.Run()

	// Setup router with all routes and middleware
	router := router.Setup(db, cfg, wsHub)

	// Start background scheduler for recurring jobs
	service.StartScheduler(db)

	// Create HTTP server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	serverErrors := make(chan error, 1)
	go func() {
		slog.Info("server starting", "address", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErrors <- err
		}
	}()

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGTERM, syscall.SIGINT)

	select {
	case err := <-serverErrors:
		slog.Error("server error", "error", err)
		os.Exit(1)
	case sig := <-sigChan:
		slog.Info("received signal, shutting down", "signal", sig)

		// Create shutdown context with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			slog.Error("error during shutdown", "error", err)
			os.Exit(1)
		}

		// Close database connection
		sqlDB, err := db.DB()
		if err != nil {
			slog.Error("error getting database instance", "error", err)
		} else {
			if err := sqlDB.Close(); err != nil {
				slog.Error("error closing database", "error", err)
			}
		}

		slog.Info("server shut down gracefully")
	}
}

func initLogger(env string) {
	var level slog.Level
	if env == "development" {
		level = slog.LevelDebug
	} else {
		level = slog.LevelInfo
	}

	handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	})
	slog.SetDefault(slog.New(handler))
}
