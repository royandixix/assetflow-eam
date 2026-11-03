package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/royandixix/assetflow-eam/backend/internal/auth"
	"github.com/royandixix/assetflow-eam/backend/internal/config"
	"github.com/royandixix/assetflow-eam/backend/internal/database"
	"github.com/royandixix/assetflow-eam/backend/internal/router"
)

func main() {
	if err := godotenv.Load(".env"); err != nil {
		log.Fatal("Gagal membaca file backend/.env")
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Koneksi Supabase gagal: ", err)
	}
	defer db.Close()

	authClient := auth.NewClient(
		cfg.SupabaseURL,
		cfg.SupabasePublishableKey,
	)

	engine := router.New(db, authClient)

	server := &http.Server{
		Addr:              "127.0.0.1:" + cfg.AppPort,
		Handler:           engine,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		<-ctx.Done()

		shutdownCtx, cancel := context.WithTimeout(
			context.Background(),
			10*time.Second,
		)
		defer cancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("Gagal menutup server: %v", err)
		}
	}()

	log.Printf(
		"%s berjalan di http://127.0.0.1:%s",
		cfg.AppName,
		cfg.AppPort,
	)

	err = server.ListenAndServe()
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
