package handlers

import (
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

// GetOperatorMetricsHandler — GET /api/v1/metrics/operator?operator_id=1
func (h *Handler) GetOperatorMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	operatorIDStr := r.URL.Query().Get("operator_id")
	operatorID, err := strconv.ParseInt(operatorIDStr, 10, 64)
	if err != nil || operatorID < 0 {
		http.Error(w, "Invalid or missing operator_id", http.StatusBadRequest)
		return
	}

	metrics, err := h.dm.GetOperatorMetrics(r.Context(), operatorID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, metrics)
}

// GetTopicMetricsHandler — GET /api/v1/metrics/topic?topic=Оплата&subtopic=Ошибки
func (h *Handler) GetTopicMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	topic := r.URL.Query().Get("topic")
	subtopic := r.URL.Query().Get("subtopic")
	if topic == "" || subtopic == "" {
		http.Error(w, "Both 'topic' and 'subtopic' are required", http.StatusBadRequest)
		return
	}

	metrics, err := h.dm.GetTopicMetrics(r.Context(), topic, subtopic)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, metrics)
}

// GetEscalationsHandler — GET /api/v1/metrics/escalations?threshold=20
func (h *Handler) GetEscalationsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	threshold := parseQueryInt64(r.URL.Query().Get("threshold"), 20)

	escalations, err := h.dm.GetEscalations(r.Context(), threshold)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, escalations)
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
