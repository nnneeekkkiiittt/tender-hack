package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

// --- Вспомогательные функции (Helpers) ---

func parseQueryInt(val string, defaultVal int) int {
	if val == "" {
		return defaultVal
	}
	if res, err := strconv.Atoi(val); err == nil && res >= 0 {
		return res
	}
	return defaultVal
}

func parseQueryInt64Slice(val string) []int64 {
	var result []int64
	items := strings.SplitSeq(val, ",")
	for item := range items {
		if num, err := strconv.ParseInt(strings.TrimSpace(item), 10, 64); err == nil {
			result = append(result, num)
		}
	}
	return result
}

func respondJSON(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if payload != nil {
		_ = json.NewEncoder(w).Encode(payload)
	}
}
