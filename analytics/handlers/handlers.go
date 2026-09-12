package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	datamanager "analytics/internal/data_manager"
	"analytics/internal/models"
)

// GET /api/v1/health-check
func HealthCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Only GET allowed", http.StatusMethodNotAllowed)
		return
	}

	w.WriteHeader(http.StatusOK)
}

type Handler struct {
	dm *datamanager.DataManager
}

func NewHandler(dm *datamanager.DataManager) *Handler {
	return &Handler{dm: dm}
}

// GetRawUsersData — GET /api/v1/analytics/users?user_ids=1,2,3&roles=admin,user&limit=100&offset=0
func (h *Handler) GetRawUsersData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := r.URL.Query()
	filter := models.UsersFilter{
		Limit:  parseQueryInt(q.Get("limit"), 100),
		Offset: parseQueryInt(q.Get("offset"), 0),
	}

	if ids := q.Get("user_ids"); ids != "" {
		filter.UserIDs = parseQueryInt64Slice(ids)
	}

	if roles := q.Get("roles"); roles != "" {
		for role := range strings.SplitSeq(roles, ",") {
			filter.Roles = append(filter.Roles, models.UserRole(strings.TrimSpace(role)))
		}
	}

	users, err := h.dm.GetRawUsersData(r.Context(), filter)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, users)
}

// GetRawClaimsData — GET /api/v1/analytics/claims?claim_ids=1,2&author_ids=10&statuses=NEW,IN WORK&topics=tech&operator_ids=5&limit=100
func (h *Handler) GetRawClaimsData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := r.URL.Query()
	filter := models.ClaimsFilter{
		Limit:  parseQueryInt(q.Get("limit"), 100),
		Offset: parseQueryInt(q.Get("offset"), 0),
	}

	if ids := q.Get("claim_ids"); ids != "" {
		filter.ClaimIDs = parseQueryInt64Slice(ids)
	}
	if authors := q.Get("author_ids"); authors != "" {
		filter.AuthorIDs = parseQueryInt64Slice(authors)
	}
	if operators := q.Get("operator_ids"); operators != "" {
		filter.OperatorIDs = parseQueryInt64Slice(operators)
	}

	if statuses := q.Get("statuses"); statuses != "" {
		for _, s := range strings.Split(statuses, ",") {
			filter.Statuses = append(filter.Statuses, models.Status(strings.TrimSpace(s)))
		}
	}

	if topics := q.Get("topics"); topics != "" {
		for t := range strings.SplitSeq(topics, ",") {
			filter.Topics = append(filter.Topics, strings.TrimSpace(t))
		}
	}

	claims, err := h.dm.GetRawClaimsData(r.Context(), filter)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, claims)
}

// GetRawMessagesData — GET /api/v1/analytics/messages?claim_ids=1,2&from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z
func (h *Handler) GetRawMessagesData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := r.URL.Query()
	filter := models.MessagesFilter{
		Limit:  parseQueryInt(q.Get("limit"), 100),
		Offset: parseQueryInt(q.Get("offset"), 0),
	}

	if ids := q.Get("claim_ids"); ids != "" {
		filter.ClaimIDs = parseQueryInt64Slice(ids)
	}
	if from := q.Get("from"); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			filter.FromTime = &t
		}
	}
	if to := q.Get("to"); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			filter.ToTime = &t
		}
	}

	messages, err := h.dm.GetRawMessagesData(r.Context(), filter)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, messages)
}

// GetRawReactionsData — GET /api/v1/analytics/reactions?claim_ids=1&operator_ids=2&like=true&reasons=SLOW WORK,RUDE BEHAVIOUR
func (h *Handler) GetRawReactionsData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := r.URL.Query()
	filter := models.ReactionsFilter{
		Limit:  parseQueryInt(q.Get("limit"), 100),
		Offset: parseQueryInt(q.Get("offset"), 0),
	}

	if ids := q.Get("claim_ids"); ids != "" {
		filter.ClaimIDs = parseQueryInt64Slice(ids)
	}
	if operators := q.Get("operator_ids"); operators != "" {
		filter.OperatorIDs = parseQueryInt64Slice(operators)
	}
	if like := q.Get("like"); like != "" {
		if b, err := strconv.ParseBool(like); err == nil {
			filter.Like = &b
		}
	}
	if reasons := q.Get("reasons"); reasons != "" {
		for r := range strings.SplitSeq(reasons, ",") {
			filter.Reasons = append(filter.Reasons, models.Reason(strings.TrimSpace(r)))
		}
	}

	reactions, err := h.dm.GetRawReactionsData(r.Context(), filter)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, reactions)
}

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
