package metabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client is a thin, server-side-only HTTP client for the Metabase Admin
// API. It is deliberately minimal — only the handful of endpoints the
// dashboard-builder feature needs.
type Client struct {
	cfg        Config
	httpClient *http.Client
}

func NewClient(cfg Config) *Client {
	return &Client{cfg: cfg, httpClient: &http.Client{Timeout: 10 * time.Second}}
}

func (c *Client) do(ctx context.Context, method, path string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal metabase request: %w", err)
		}
		reader = bytes.NewReader(payload)
	}

	url := strings.TrimRight(c.cfg.SiteURL, "/") + path
	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return fmt.Errorf("build metabase request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	// Static API keys (Settings -> Admin -> API Keys) — supported since
	// Metabase 0.49. This avoids session/cookie-based auth entirely.
	req.Header.Set("X-Api-Key", c.cfg.APIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("metabase request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("metabase returned %d: %s", resp.StatusCode, string(respBody))
	}

	if out == nil {
		return nil
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode metabase response: %w", err)
	}
	return nil
}

// CreateCard creates a native-SQL question ("card") in Metabase and returns
// its id.
func (c *Client) CreateCard(ctx context.Context, req CardRequest) (int, error) {
	var resp CardResponse
	if err := c.do(ctx, http.MethodPost, "/api/card", req, &resp); err != nil {
		return 0, err
	}
	return resp.ID, nil
}

// CreateDashboard creates an empty dashboard and returns its id.
func (c *Client) CreateDashboard(ctx context.Context, name string) (int, error) {
	var resp DashboardResponse
	if err := c.do(ctx, http.MethodPost, "/api/dashboard", DashboardRequest{Name: name}, &resp); err != nil {
		return 0, err
	}
	return resp.ID, nil
}

// AddCardToDashboard attaches an existing card to an existing dashboard.
// Metabase's dashboard-cards API has changed across versions; this uses the
// documented POST /api/dashboard/:id/cards endpoint (stable across
// currently-supported Metabase releases at the time of writing).
func (c *Client) AddCardToDashboard(ctx context.Context, dashboardID, cardID, row int) error {
	path := fmt.Sprintf("/api/dashboard/%d/cards", dashboardID)
	req := AddCardRequest{CardID: cardID, Row: row, Col: 0, SizeX: 6, SizeY: 4}
	return c.do(ctx, http.MethodPost, path, req, nil)
}
