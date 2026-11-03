package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	AppName                string
	AppEnv                 string
	AppPort                string
	DatabaseURL            string
	SupabaseURL            string
	SupabasePublishableKey string
}

func Load() (Config, error) {
	cfg := Config{
		AppName:                getEnv("APP_NAME", "AssetFlow EAM"),
		AppEnv:                 getEnv("APP_ENV", "development"),
		AppPort:                getEnv("APP_PORT", "8083"),
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		SupabaseURL:            strings.TrimRight(os.Getenv("SUPABASE_URL"), "/"),
		SupabasePublishableKey: os.Getenv("SUPABASE_PUBLISHABLE_KEY"),
	}

	port, err := strconv.Atoi(cfg.AppPort)
	if err != nil || port < 1 || port > 65535 {
		return cfg, errors.New("APP_PORT tidak valid")
	}

	if cfg.DatabaseURL == "" {
		return cfg, errors.New("DATABASE_URL belum tersedia")
	}

	if !strings.HasPrefix(cfg.SupabaseURL, "https://") {
		return cfg, errors.New("SUPABASE_URL harus menggunakan HTTPS")
	}

	if cfg.SupabasePublishableKey == "" {
		return cfg, errors.New("SUPABASE_PUBLISHABLE_KEY belum tersedia")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
