// Package metabase talks to a self-hosted Metabase instance server-side
// only. No secret handled here (API key, embedding secret) ever reaches the
// frontend — the frontend only ever receives a short-lived signed embed URL
// (see Service.SignedEmbedURL).
package metabase

// Config holds everything needed to talk to Metabase. All values come from
// environment variables (see cmd/main.go) and are never logged verbatim.
type Config struct {
	// Base URL of the Metabase instance, e.g. http://localhost:3000.
	SiteURL string
	// Static API key (Metabase Settings -> Admin -> API Keys). Used for
	// server-to-server calls that create/read questions and dashboards.
	APIKey string
	// Secret used to sign embedding JWTs (Admin -> Embedding -> enable
	// static embedding, then copy the secret it generates). Required only
	// for GenerateSignedEmbedURL.
	EmbeddingSecret string
	// The Metabase "database" id of the Postgres connection that points at
	// the SAME database analytics/cmd/main.go connects to. Metabase assigns
	// this id when the database is added in its admin UI — there is no way
	// to discover it purely from our backend, so it must be configured.
	DatabaseID int
}

// Enabled reports whether enough configuration is present to talk to
// Metabase at all. Callers should treat a disabled config as "Metabase is
// not integrated yet" rather than erroring loudly.
func (c Config) Enabled() bool {
	return c.SiteURL != "" && c.APIKey != "" && c.DatabaseID != 0
}

// CardRequest is the payload for POST /api/card (creating a native SQL
// question). Only the fields we actually set are declared.
type CardRequest struct {
	Name                string           `json:"name"`
	DatasetQuery        DatasetQuery     `json:"dataset_query"`
	Display             string           `json:"display"`
	VisualizationSettings map[string]any `json:"visualization_settings"`
	CollectionID        *int             `json:"collection_id,omitempty"`
}

type DatasetQuery struct {
	Type     string       `json:"type"`
	Native   NativeQuery  `json:"native"`
	Database int          `json:"database"`
}

type NativeQuery struct {
	Query string `json:"query"`
}

// CardResponse is the subset of Metabase's card response we need.
type CardResponse struct {
	ID int `json:"id"`
}

// DashboardRequest is the payload for POST /api/dashboard.
type DashboardRequest struct {
	Name string `json:"name"`
}

// DashboardResponse is the subset of Metabase's dashboard response we need.
type DashboardResponse struct {
	ID int `json:"id"`
}

// AddCardRequest adds an existing card to a dashboard
// (POST /api/dashboard/:id/cards in older Metabase, or PUT
// /api/dashboard/:id with a full cards array in newer versions — see
// client.go for which one is actually used and why).
type AddCardRequest struct {
	CardID  int `json:"cardId"`
	Row     int `json:"row"`
	Col     int `json:"col"`
	SizeX   int `json:"size_x"`
	SizeY   int `json:"size_y"`
}
