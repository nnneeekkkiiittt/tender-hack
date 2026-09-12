package main

import (
	"analytics/handlers"
	datamanager "analytics/internal/data_manager"
	"analytics/internal/metabase"
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
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

	mbConfig := metabase.Config{
		SiteURL:         getEnv("METABASE_URL", ""),
		APIKey:          getEnv("METABASE_API_KEY", ""),
		EmbeddingSecret: getEnv("METABASE_EMBEDDING_SECRET", ""),
		DatabaseID:      getEnvInt("METABASE_DATABASE_ID", 0),
	}
	mbService := metabase.NewService(mbConfig)
	if mbService.Enabled() {
		log.Println("Metabase integration enabled:", mbConfig.SiteURL)
	} else {
		log.Println("Metabase integration disabled (METABASE_URL/METABASE_API_KEY/METABASE_DATABASE_ID not fully set) — dashboards can still be created, but widgets won't render until it's configured")
	}

	handler := handlers.NewHandler(dm, mbService)

	//endpoints — raw data + existing metrics
	mux.HandleFunc("/api/v1/analytics/health-check", handlers.HealthCheck)
	mux.HandleFunc("/api/v1/analytics/users", handler.GetRawUsersData)
	mux.HandleFunc("/api/v1/analytics/claims", handler.GetRawClaimsData)
	mux.HandleFunc("/api/v1/analytics/messages", handler.GetRawMessagesData)
	mux.HandleFunc("/api/v1/analytics/reactions", handler.GetRawReactionsData)
	mux.HandleFunc("/api/v1/metrics/operator", handler.GetOperatorMetricsHandler)
	mux.HandleFunc("/api/v1/metrics/topic", handler.GetTopicMetricsHandler)
	mux.HandleFunc("/api/v1/metrics/escalations", handler.GetEscalationsHandler)

	// endpoints — custom dashboards (DashboardTemplate persistence + Metabase embedding)
	mux.HandleFunc("/api/v1/dashboards", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.ListDashboards(w, r)
		case http.MethodPost:
			handler.CreateDashboard(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/v1/dashboards/{id}", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetDashboard(w, r)
		case http.MethodPut:
			handler.UpdateDashboard(w, r)
		case http.MethodDelete:
			handler.DeleteDashboard(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/v1/dashboards/{id}/widgets/{widgetId}/embed-url", handler.GetWidgetEmbedURL)
	mux.HandleFunc("/api/v1/metabase/bootstrap", handler.BootstrapMetabaseDashboard)

	corsHandler := handlers.WithCORS(mux, handlers.CORSAllowedOriginsFromEnv())

	server := &http.Server{
		Addr:         ":8080",
		Handler:      corsHandler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

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

func getEnvInt(key string, defaultVal int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	parsed, err := strconv.Atoi(val)
	if err != nil {
		return defaultVal
	}
	return parsed
}
