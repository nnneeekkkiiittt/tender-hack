package models

import "time"

// DashboardWidget is one saved visualization inside a DashboardTemplate.
// Only the query DEFINITION is stored — never query results — so opening a
// dashboard always re-runs the underlying query against current data.
type DashboardWidget struct {
	ID                 string `json:"id"`
	Title              string `json:"title"`
	Metric             string `json:"metric"`
	Dimension          string `json:"dimension"`
	Visualization      string `json:"visualization"`
	MetabaseQuestionID *int64 `json:"metabaseQuestionId,omitempty"`
	MetabaseCardID     *int64 `json:"metabaseCardId,omitempty"`
}

// DashboardTemplate is a user-saved dashboard configuration.
type DashboardTemplate struct {
	ID                  string            `json:"id"`
	Name                string            `json:"name"`
	Description         string            `json:"description"`
	OwnerID             string            `json:"ownerId"`
	CreatedAt           time.Time         `json:"createdAt"`
	UpdatedAt           time.Time         `json:"updatedAt"`
	Widgets             []DashboardWidget `json:"widgets"`
	MetabaseDashboardID *int64            `json:"metabaseDashboardId,omitempty"`
}

// CreateDashboardWidgetInput is what the frontend sends when creating or
// replacing a dashboard's widgets (see CreateDashboardPayload on the
// frontend, which intentionally omits id/metabaseQuestionId/metabaseCardId —
// those are always assigned server-side).
type CreateDashboardWidgetInput struct {
	Title         string `json:"title"`
	Metric        string `json:"metric"`
	Dimension     string `json:"dimension"`
	Visualization string `json:"visualization"`
}

type CreateDashboardInput struct {
	Name        string                       `json:"name"`
	Description string                       `json:"description"`
	Widgets     []CreateDashboardWidgetInput `json:"widgets"`
}
