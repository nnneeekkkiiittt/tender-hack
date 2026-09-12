package handlers

import (
	"net/http"
	"os"
	"strings"
)

// WithCORS wraps a handler with CORS headers for the given allowed origins.
// allowedOrigins is a comma-separated list (e.g. from an env var); "*" is
// supported but should only be used deliberately, never as a silent default
// in production. If allowedOrigins is empty, no CORS headers are added.
func WithCORS(next http.Handler, allowedOrigins string) http.Handler {
	origins := splitAndTrim(allowedOrigins)
	allowAll := len(origins) == 1 && origins[0] == "*"

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (allowAll || contains(origins, origin)) {
			if allowAll {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			} else {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// CORSAllowedOriginsFromEnv reads CORS_ALLOWED_ORIGINS (comma-separated),
// defaulting to the local Vite dev server so `npm run dev` works out of the
// box; production deployments should set this explicitly.
func CORSAllowedOriginsFromEnv() string {
	if val := os.Getenv("CORS_ALLOWED_ORIGINS"); val != "" {
		return val
	}
	return "http://localhost:5173"
}

func splitAndTrim(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}

func contains(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}
