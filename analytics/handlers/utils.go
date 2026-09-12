package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

func respondJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(value); err != nil {
		return
	}
}

func parseQueryInt(val string, defaultVal int) int {
	if val == "" {
		return defaultVal
	}
	if res, err := strconv.Atoi(val); err == nil && res >= 0 {
		return res
	}
	return defaultVal
}

func parseQueryInt64(val string, defaultVal int64) int64 {
	if val == "" {
		return defaultVal
	}
	if res, err := strconv.ParseInt(val, 10, 64); err == nil && res > 0 {
		return res
	}
	return defaultVal
}

func parseQueryInt64Slice(val string) []int64 {
	parts := splitCSV(val)
	result := make([]int64, 0, len(parts))
	for _, part := range parts {
		id, err := strconv.ParseInt(part, 10, 64)
		if err == nil {
			result = append(result, id)
		}
	}
	return result
}

func splitCSV(value string) []string {
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
