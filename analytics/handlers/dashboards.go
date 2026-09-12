package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"analytics/internal/models"
)

// GET /api/v1/dashboards?owner_id=...
func (h *Handler) ListDashboards(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	dashboards, err := h.dm.ListDashboards(r.Context(), r.URL.Query().Get("owner_id"))
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if dashboards == nil {
		dashboards = []models.DashboardTemplate{}
	}
	respondJSON(w, http.StatusOK, dashboards)
}

// POST /api/v1/dashboards?owner_id=...
func (h *Handler) CreateDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var input models.CreateDashboardInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if input.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}
	dashboard, err := h.dm.CreateDashboard(r.Context(), r.URL.Query().Get("owner_id"), input)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusCreated, dashboard)
}

// GET /api/v1/dashboards/{id}
func (h *Handler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	dashboard, err := h.dm.GetDashboard(r.Context(), r.PathValue("id"))
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if dashboard == nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	respondJSON(w, http.StatusOK, dashboard)
}

// PUT /api/v1/dashboards/{id}
func (h *Handler) UpdateDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var input models.CreateDashboardInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	dashboard, err := h.dm.UpdateDashboard(r.Context(), r.PathValue("id"), input)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if dashboard == nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	respondJSON(w, http.StatusOK, dashboard)
}

// DELETE /api/v1/dashboards/{id}
func (h *Handler) DeleteDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := h.dm.DeleteDashboard(r.Context(), r.PathValue("id")); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/dashboards/{id}/widgets/{widgetId}/embed-url
//
// Returns a short-lived signed Metabase embed URL for one widget. This is
// the ONLY Metabase-related value the frontend ever receives from this
// endpoint — no API key or embedding secret is included.
func (h *Handler) GetWidgetEmbedURL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.mb == nil || !h.mb.Enabled() {
		http.Error(w, "Metabase is not configured", http.StatusServiceUnavailable)
		return
	}

	dashboardID := r.PathValue("id")
	widgetID := r.PathValue("widgetId")

	dashboard, err := h.dm.GetDashboard(r.Context(), dashboardID)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if dashboard == nil {
		http.Error(w, "Dashboard not found", http.StatusNotFound)
		return
	}

	var widget *models.DashboardWidget
	for i := range dashboard.Widgets {
		if dashboard.Widgets[i].ID == widgetID {
			widget = &dashboard.Widgets[i]
			break
		}
	}
	if widget == nil {
		http.Error(w, "Widget not found", http.StatusNotFound)
		return
	}

	cardID, err := h.mb.EnsureCard(r.Context(), widget.MetabaseCardID, widget.Title, widget.Metric, widget.Dimension, widget.Visualization)
	if err != nil {
		http.Error(w, "Failed to prepare Metabase question: "+err.Error(), http.StatusBadGateway)
		return
	}

	if widget.MetabaseCardID == nil {
		// Best-effort cache of the newly-created card id so re-opening this
		// widget doesn't create a duplicate Metabase question every time.
		// Failure here is non-fatal — the embed URL below is still valid.
		_ = h.dm.SetWidgetMetabaseCardID(r.Context(), dashboardID, widgetID, int64(cardID))
	}

	embedURL, err := h.mb.SignedEmbedURL(cardID, 10*time.Minute)
	if err != nil {
		http.Error(w, "Failed to sign embed URL: "+err.Error(), http.StatusBadGateway)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"url": embedURL})
}

// POST /api/v1/metabase/bootstrap — one-off admin action that provisions the
// first required real dashboard ("Обращения и эффективность AI"). See
// metabase.Service.ProvisionDefaultDashboard. Not run automatically on
// startup so restarts never create duplicate dashboards.
func (h *Handler) BootstrapMetabaseDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.mb == nil || !h.mb.Enabled() {
		http.Error(w, "Metabase is not configured", http.StatusServiceUnavailable)
		return
	}
	dashboardID, err := h.mb.ProvisionDefaultDashboard(r.Context())
	if err != nil {
		http.Error(w, "Failed to provision dashboard: "+err.Error(), http.StatusBadGateway)
		return
	}
	respondJSON(w, http.StatusOK, map[string]int{"metabase_dashboard_id": dashboardID})
}
