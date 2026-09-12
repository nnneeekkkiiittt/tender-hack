package metabase

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Service is the high-level API the rest of the analytics backend uses.
// Nothing outside this package ever sees an API key or embedding secret.
type Service struct {
	cfg    Config
	client *Client
}

func NewService(cfg Config) *Service {
	return &Service{cfg: cfg, client: NewClient(cfg)}
}

func (s *Service) Enabled() bool { return s.cfg.Enabled() }

// EnsureCard returns the existing card id if one was already created for
// this widget, otherwise creates a new native-SQL question in Metabase and
// returns its id.
func (s *Service) EnsureCard(ctx context.Context, existingCardID *int64, title, metric, dimension, visualization string) (int, error) {
	if existingCardID != nil && *existingCardID != 0 {
		return int(*existingCardID), nil
	}
	if !s.Enabled() {
		return 0, fmt.Errorf("metabase is not configured (METABASE_URL / METABASE_API_KEY / METABASE_DATABASE_ID)")
	}

	sql, defaultDisplay := BuildQuery(metric, dimension)
	display := defaultDisplay
	if visualization == "line" || visualization == "table" || visualization == "bar" {
		display = visualization
	}

	req := CardRequest{
		Name:    CardTitle(title, metric, dimension),
		Display: display,
		DatasetQuery: DatasetQuery{
			Type:     "native",
			Database: s.cfg.DatabaseID,
			Native:   NativeQuery{Query: sql},
		},
		VisualizationSettings: map[string]any{},
	}
	return s.client.CreateCard(ctx, req)
}

// EnsureDashboard returns the existing Metabase dashboard id if one was
// already created for this DashboardTemplate, otherwise creates a new one.
func (s *Service) EnsureDashboard(ctx context.Context, existingDashboardID *int64, name string) (int, error) {
	if existingDashboardID != nil && *existingDashboardID != 0 {
		return int(*existingDashboardID), nil
	}
	if !s.Enabled() {
		return 0, fmt.Errorf("metabase is not configured (METABASE_URL / METABASE_API_KEY / METABASE_DATABASE_ID)")
	}
	return s.client.CreateDashboard(ctx, name)
}

// AddCardToDashboard is a thin passthrough — kept on Service so callers
// never need to import the lower-level Client directly.
func (s *Service) AddCardToDashboard(ctx context.Context, dashboardID, cardID, row int) error {
	return s.client.AddCardToDashboard(ctx, dashboardID, cardID, row)
}

// SignedEmbedURL returns a short-lived, signed embed URL for a single
// question/card using Metabase's standard JWT "static embedding" scheme.
// This is the ONLY Metabase artifact the frontend ever receives — the
// embedding secret itself never leaves this backend.
//
// NOTE: static embedding must additionally be enabled for the resource in
// the Metabase admin UI (Sharing -> enable embedding) before a signed URL
// like this will actually render anything — that toggle has no public API
// as of this writing and is a one-time manual setup step.
func (s *Service) SignedEmbedURL(cardID int, ttl time.Duration) (string, error) {
	if s.cfg.EmbeddingSecret == "" {
		return "", fmt.Errorf("METABASE_EMBEDDING_SECRET is not configured")
	}
	claims := map[string]any{
		"resource": map[string]any{"question": cardID},
		"params":   map[string]any{},
		"exp":      time.Now().Add(ttl).Unix(),
	}
	token, err := signJWT(s.cfg.EmbeddingSecret, claims)
	if err != nil {
		return "", fmt.Errorf("sign embed token: %w", err)
	}
	return strings.TrimRight(s.cfg.SiteURL, "/") + "/embed/question/" + token + "#bordered=false&titled=false", nil
}

// ProvisionDefaultDashboard creates the first required real dashboard
// ("Обращения и эффективность AI") with the minimum four charts requested:
// claims by subtopic, AI resolution by subtopic, ticket volume over time,
// and escalations. Intended to be triggered once via
// POST /api/v1/metabase/bootstrap (see handlers/metabase.go) — it is not
// run automatically on startup so it never silently spams Metabase with
// duplicate dashboards on every restart.
func (s *Service) ProvisionDefaultDashboard(ctx context.Context) (int, error) {
	if !s.Enabled() {
		return 0, fmt.Errorf("metabase is not configured")
	}

	dashboardID, err := s.client.CreateDashboard(ctx, "Обращения и эффективность AI")
	if err != nil {
		return 0, fmt.Errorf("create dashboard: %w", err)
	}

	type chart struct {
		title, metric, dimension, display string
	}
	charts := []chart{
		{"Обращения по подтемам", "claims_count", "subtopic", "bar"},
		{"AI resolution по подтемам", "ai_resolved_percentage", "subtopic", "bar"},
		{"Динамика обращений по неделям", "claims_count", "week", "line"},
		{"Эскалации (рост, %)", "escalation_growth", "subtopic", "bar"},
	}

	for i, c := range charts {
		sql, _ := BuildQuery(c.metric, c.dimension)
		cardID, err := s.client.CreateCard(ctx, CardRequest{
			Name:    c.title,
			Display: c.display,
			DatasetQuery: DatasetQuery{
				Type:     "native",
				Database: s.cfg.DatabaseID,
				Native:   NativeQuery{Query: sql},
			},
			VisualizationSettings: map[string]any{},
		})
		if err != nil {
			return dashboardID, fmt.Errorf("create card %q: %w", c.title, err)
		}
		if err := s.client.AddCardToDashboard(ctx, dashboardID, cardID, i*4); err != nil {
			return dashboardID, fmt.Errorf("add card %q to dashboard: %w", c.title, err)
		}
	}

	return dashboardID, nil
}

// signJWT implements the minimal HS256 JWT signing Metabase's static
// embedding expects, using only the standard library (no external JWT
// dependency, since this sandbox has no network access to fetch one — and
// the format is small and stable enough not to need one in production
// either).
func signJWT(secret string, claims map[string]any) (string, error) {
	header := map[string]string{"alg": "HS256", "typ": "JWT"}
	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	headerEncoded := base64.RawURLEncoding.EncodeToString(headerJSON)
	claimsEncoded := base64.RawURLEncoding.EncodeToString(claimsJSON)
	signingInput := headerEncoded + "." + claimsEncoded

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signingInput))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return signingInput + "." + signature, nil
}
