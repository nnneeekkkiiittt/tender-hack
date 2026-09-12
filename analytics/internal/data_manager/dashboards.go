package datamanager

import (
	"analytics/internal/models"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// generateID produces a short, unique, human-scannable id (e.g. "dash_a1b2c3d4e5f6g7h8").
// Deliberately not a DB-generated UUID so this table needs no Postgres
// extension (pgcrypto/uuid-ossp) beyond what's already required.
func generateID(prefix string) string {
	buf := make([]byte, 8)
	_, _ = rand.Read(buf)
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(buf))
}

type dashboardRowScanner interface {
	Scan(dest ...any) error
}

func scanDashboard(row dashboardRowScanner) (models.DashboardTemplate, error) {
	var d models.DashboardTemplate
	var widgetsJSON []byte
	if err := row.Scan(
		&d.ID, &d.Name, &d.Description, &d.OwnerID, &widgetsJSON,
		&d.MetabaseDashboardID, &d.CreatedAt, &d.UpdatedAt,
	); err != nil {
		return d, err
	}
	if len(widgetsJSON) > 0 {
		if err := json.Unmarshal(widgetsJSON, &d.Widgets); err != nil {
			return d, fmt.Errorf("unmarshal widgets: %w", err)
		}
	}
	return d, nil
}

func widgetsToJSON(inputs []models.CreateDashboardWidgetInput) ([]byte, []models.DashboardWidget, error) {
	widgets := make([]models.DashboardWidget, len(inputs))
	for i, w := range inputs {
		widgets[i] = models.DashboardWidget{
			ID:            generateID("widget"),
			Title:         w.Title,
			Metric:        w.Metric,
			Dimension:     w.Dimension,
			Visualization: w.Visualization,
		}
	}
	payload, err := json.Marshal(widgets)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal widgets: %w", err)
	}
	return payload, widgets, nil
}

const dashboardColumns = `id, name, description, owner_id, widgets, metabase_dashboard_id, created_at, updated_at`

// ListDashboards returns all dashboards owned by ownerID. When ownerID is
// empty, all dashboards are returned (used for the single-admin-account
// demo setup; a multi-tenant deployment should always pass a real owner id).
func (m *DataManager) ListDashboards(ctx context.Context, ownerID string) ([]models.DashboardTemplate, error) {
	query := `SELECT ` + dashboardColumns + ` FROM dashboard_templates`
	args := []any{}
	if ownerID != "" {
		query += ` WHERE owner_id = $1`
		args = append(args, ownerID)
	}
	query += ` ORDER BY updated_at DESC`

	rows, err := m.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query dashboards: %w", err)
	}
	defer rows.Close()

	var result []models.DashboardTemplate
	for rows.Next() {
		d, err := scanDashboard(rows)
		if err != nil {
			return nil, fmt.Errorf("scan dashboard: %w", err)
		}
		result = append(result, d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dashboards: %w", err)
	}
	return result, nil
}

// GetDashboard returns nil, nil (not an error) when no dashboard matches id.
func (m *DataManager) GetDashboard(ctx context.Context, id string) (*models.DashboardTemplate, error) {
	query := `SELECT ` + dashboardColumns + ` FROM dashboard_templates WHERE id = $1`
	d, err := scanDashboard(m.db.QueryRow(ctx, query, id))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get dashboard: %w", err)
	}
	return &d, nil
}

func (m *DataManager) CreateDashboard(ctx context.Context, ownerID string, input models.CreateDashboardInput) (*models.DashboardTemplate, error) {
	widgetsJSON, _, err := widgetsToJSON(input.Widgets)
	if err != nil {
		return nil, err
	}

	id := generateID("dash")
	query := `INSERT INTO dashboard_templates (id, name, description, owner_id, widgets)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING ` + dashboardColumns

	d, err := scanDashboard(m.db.QueryRow(ctx, query, id, input.Name, input.Description, ownerID, widgetsJSON))
	if err != nil {
		return nil, fmt.Errorf("create dashboard: %w", err)
	}
	return &d, nil
}

// UpdateDashboard returns nil, nil (not an error) when no dashboard matches id.
func (m *DataManager) UpdateDashboard(ctx context.Context, id string, input models.CreateDashboardInput) (*models.DashboardTemplate, error) {
	widgetsJSON, _, err := widgetsToJSON(input.Widgets)
	if err != nil {
		return nil, err
	}

	query := `UPDATE dashboard_templates
		SET name = $2, description = $3, widgets = $4, updated_at = now()
		WHERE id = $1
		RETURNING ` + dashboardColumns

	d, err := scanDashboard(m.db.QueryRow(ctx, query, id, input.Name, input.Description, widgetsJSON))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("update dashboard: %w", err)
	}
	return &d, nil
}

func (m *DataManager) DeleteDashboard(ctx context.Context, id string) error {
	if _, err := m.db.Exec(ctx, `DELETE FROM dashboard_templates WHERE id = $1`, id); err != nil {
		return fmt.Errorf("delete dashboard: %w", err)
	}
	return nil
}

// SetWidgetMetabaseCardID caches a Metabase card id onto one existing widget
// without touching any other widget's id or fields — unlike UpdateDashboard,
// which intentionally regenerates all widget ids on a full builder save.
func (m *DataManager) SetWidgetMetabaseCardID(ctx context.Context, dashboardID, widgetID string, cardID int64) error {
	dashboard, err := m.GetDashboard(ctx, dashboardID)
	if err != nil {
		return err
	}
	if dashboard == nil {
		return fmt.Errorf("dashboard %s not found", dashboardID)
	}

	found := false
	for i := range dashboard.Widgets {
		if dashboard.Widgets[i].ID == widgetID {
			dashboard.Widgets[i].MetabaseCardID = &cardID
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("widget %s not found on dashboard %s", widgetID, dashboardID)
	}

	widgetsJSON, err := json.Marshal(dashboard.Widgets)
	if err != nil {
		return fmt.Errorf("marshal widgets: %w", err)
	}

	_, err = m.db.Exec(ctx, `UPDATE dashboard_templates SET widgets = $2, updated_at = now() WHERE id = $1`, dashboardID, widgetsJSON)
	if err != nil {
		return fmt.Errorf("save widget card id: %w", err)
	}
	return nil
}
