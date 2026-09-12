package main

import (
	"analytics/handlers"
	datamanager "analytics/internal/data_manager"
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		getEnv("DB_USER", "postgres"),
		getEnv("DB_PASSWORD", " 9d5b09bfe734ca09d6fffdc2dc940c258e112588881bfacd"),
		getEnv("DB_HOST", "111.88.153.146"),
		getEnv("DB_PORT", "5433"),
		getEnv("DB_NAME", "tender-hack"),
	)
	mux := http.NewServeMux()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	dbpool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer dbpool.Close()

	if err := dbpool.Ping(ctx); err != nil {
		log.Fatalf("Database ping failed: %v", err)
	}
	log.Println("Successfully connected to PostgreSQL")

	dm := datamanager.New(dbpool)
	handler := handlers.NewHandler(dm)

	server := &http.Server{
		Addr:         ":8080",
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	//ednpoints
	mux.HandleFunc("/api/v1/analytics/health-check", handlers.HealthCheck)
	mux.HandleFunc("/api/v1/analytics/users", handler.GetRawUsersData)
	mux.HandleFunc("/api/v1/analytics/claims", handler.GetRawClaimsData)
	mux.HandleFunc("/api/v1/analytics/messages", handler.GetRawMessagesData)
	mux.HandleFunc("/api/v1/analytics/reactions", handler.GetRawReactionsData)
	mux.HandleFunc("/api/v1/metrics/operator", handler.GetOperatorMetricsHandler)
	mux.HandleFunc("/api/v1/metrics/topic", handler.GetTopicMetricsHandler)
	mux.HandleFunc("/api/v1/metrics/escalations", handler.GetEscalationsHandler)

	cancelCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Запуск HTTP-сервера в отдельной горутине
	go func() {
		log.Println("Analytics service started on :8080")
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// Ожидаем получения сигнала на завершение (Ctrl+C или docker stop)
	<-cancelCtx.Done()
	log.Println("Shutting down gracefully...")

	// Даем 5 секунд на завершение обработок текущих активных HTTP-запросов
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server forced to shutdown: %v", err)
	}

	log.Println("Server exiting successfully")
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
