package handlers

import (
	"net/http"
	"strconv"
	"time"

	datamanager "analytics/internal/data_manager"
	"analytics/internal/metabase"
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
	mb *metabase.Service
}

// NewHandler wires the raw-data/metrics handlers. mb may be nil if Metabase
// integration is not configured — dashboard handlers degrade gracefully
// (widgets are still saved; embed URLs/card provisioning simply report that
// Metabase isn't configured instead of panicking).
func NewHandler(dm *datamanager.DataManager, mb *metabase.Service) *Handler {
	return &Handler{dm: dm, mb: mb}
}

// GetRawUsersData — GET /api/v1/analytics/users?user_ids=1,2,3&roles=admin,user&limit=100&offset=0
func (h *Handler) GetRawUsersData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := r.URL.Query()
	filter := models.UsersFilter{
		Pagination: models.Pagination{
			Limit:  parseQueryInt(q.Get("limit"), 100),
			Offset: parseQueryInt(q.Get("offset"), 0),
		},
	}

	if ids := q.Get("user_ids"); ids != "" {
		filter.UserIDs = parseQueryInt64Slice(ids)
	}

	if roles := q.Get("roles"); roles != "" {
		for _, role := range splitCSV(roles) {
			filter.Roles = append(filter.Roles, models.UserRole(role))
		}
	}

	users, err := h.dm.GetRawUsersData(r.Context(), filter)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, users)
}

// GetRawClaimsData — GET /api/v1/analytics/claims?claim_ids=1,2&author_ids=10&statuses=NEW,IN%20WORK&topics=tech&subtopics=payments&operator_ids=5&limit=100&offset=0
func (h *Handler) GetRawClaimsData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := r.URL.Query()
	filter := models.ClaimsFilter{
		Pagination: models.Pagination{
			Limit:  parseQueryInt(q.Get("limit"), 100),
			Offset: parseQueryInt(q.Get("offset"), 0),
		},
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
		for _, status := range splitCSV(statuses) {
			filter.Statuses = append(filter.Statuses, models.ClaimStatus(status))
		}
	}
	if topics := q.Get("topics"); topics != "" {
		filter.Topics = splitCSV(topics)
	}
	if subtopics := q.Get("subtopics"); subtopics != "" {
		filter.Subtopics = splitCSV(subtopics)
	}

	claims, err := h.dm.GetRawClaimsData(r.Context(), filter)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, claims)
}

// GetRawMessagesData — GET /api/v1/analytics/messages?claim_ids=1,2&author_ids=10&author_kinds=USER,SUPPORT&from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z
func (h *Handler) GetRawMessagesData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := r.URL.Query()
	filter := models.MessagesFilter{
		Pagination: models.Pagination{
			Limit:  parseQueryInt(q.Get("limit"), 100),
			Offset: parseQueryInt(q.Get("offset"), 0),
		},
	}

	if ids := q.Get("claim_ids"); ids != "" {
		filter.ClaimIDs = parseQueryInt64Slice(ids)
	}
	if authors := q.Get("author_ids"); authors != "" {
		filter.AuthorIDs = parseQueryInt64Slice(authors)
	}
	if kinds := q.Get("author_kinds"); kinds != "" {
		for _, kind := range splitCSV(kinds) {
			filter.AuthorKinds = append(filter.AuthorKinds, models.AuthorKind(kind))
		}
	}
	if from := q.Get("from"); from != "" {
		t, err := time.Parse(time.RFC3339, from)
		if err != nil {
			http.Error(w, "Invalid 'from' timestamp", http.StatusBadRequest)
			return
		}
		filter.FromTime = &t
	}
	if to := q.Get("to"); to != "" {
		t, err := time.Parse(time.RFC3339, to)
		if err != nil {
			http.Error(w, "Invalid 'to' timestamp", http.StatusBadRequest)
			return
		}
		filter.ToTime = &t
	}

	messages, err := h.dm.GetRawMessagesData(r.Context(), filter)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, messages)
}

// GetRawReactionsData —
// GET /api/v1/analytics/reactions?claim_ids=1&operator_ids=2&submitted_by=3&message_ids=10&target_kinds=OPERATOR,AI_MESSAGE&like=true&reasons=SLOW%20WORK,RUDE%20BEHAVIOUR
func (h *Handler) GetRawReactionsData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	q := r.URL.Query()
	filter := models.ReactionsFilter{
		Pagination: models.Pagination{
			Limit:  parseQueryInt(q.Get("limit"), 100),
			Offset: parseQueryInt(q.Get("offset"), 0),
		},
	}

	if ids := q.Get("claim_ids"); ids != "" {
		filter.ClaimIDs = parseQueryInt64Slice(ids)
	}
	if operators := q.Get("operator_ids"); operators != "" {
		filter.OperatorIDs = parseQueryInt64Slice(operators)
	}
	if submittedBy := q.Get("submitted_by"); submittedBy != "" {
		filter.SubmittedBy = parseQueryInt64Slice(submittedBy)
	}
	if messageIDs := q.Get("message_ids"); messageIDs != "" {
		filter.MessageIDs = parseQueryInt64Slice(messageIDs)
	}
	if targetKinds := q.Get("target_kinds"); targetKinds != "" {
		for _, kind := range splitCSV(targetKinds) {
			filter.TargetKinds = append(filter.TargetKinds, models.ReactionTargetKind(kind))
		}
	}
	if like := q.Get("like"); like != "" {
		b, err := strconv.ParseBool(like)
		if err != nil {
			http.Error(w, "Invalid 'like' value", http.StatusBadRequest)
			return
		}
		filter.Like = &b
	}
	if reasons := q.Get("reasons"); reasons != "" {
		for _, reason := range splitCSV(reasons) {
			filter.Reasons = append(filter.Reasons, models.Reason(reason))
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
	if err != nil || operatorID <= 0 {
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

// GetEscalationsHandler — GET /api/v1/metrics/escalations
func (h *Handler) GetEscalationsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	escalations, err := h.dm.GetEscalations(r.Context())
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, escalations)
}
