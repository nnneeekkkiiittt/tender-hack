package metabase

import "fmt"

// BuildQuery turns a (metric, dimension) pair from our limited dashboard
// builder into a native SQL query against the SAME Postgres schema the
// analytics Go backend already reads (see internal/data_manager/dm.go for
// the canonical queries this mirrors). Only combinations that are
// semantically meaningful are fully supported; others fall back to the
// closest sensible query rather than failing the whole dashboard save.
//
// This is intentionally the ONLY place SQL is generated for Metabase cards —
// keeping it separate from data_manager (which serves our own API) per the
// task's explicit instruction not to mix Metabase code with DataManager.
func BuildQuery(metric, dimension string) (sql string, display string) {
	switch metric {
	case "claims_count":
		return claimsCountQuery(dimension), "bar"
	case "ai_resolved_percentage":
		return aiResolvedQuery(dimension), "bar"
	case "escalation_growth":
		// The growth formula is inherently subtopic-based (it mirrors
		// GetEscalations in dm.go) — dimension is not applicable here.
		return escalationGrowthQuery(), "bar"
	default:
		return "SELECT 'unknown metric' AS label, 0 AS value WHERE FALSE", "table"
	}
}

func claimsCountQuery(dimension string) string {
	switch dimension {
	case "operator":
		return `SELECT u.name AS label, COUNT(*) AS value
			FROM claims c
			JOIN users u ON u.id = c.operator_id
			WHERE c.operator_id IS NOT NULL
			GROUP BY u.name
			ORDER BY value DESC`
	case "week":
		return `SELECT date_trunc('week', created_at)::date AS label, COUNT(*) AS value
			FROM claims
			GROUP BY label
			ORDER BY label`
	default: // subtopic
		return `SELECT subtopic AS label, COUNT(*) AS value
			FROM claims
			WHERE subtopic IS NOT NULL
			GROUP BY subtopic
			ORDER BY value DESC`
	}
}

func aiResolvedQuery(dimension string) string {
	// AI-owned claims (handling_level = 0) have no operator, so the
	// "operator" dimension isn't meaningful for this metric; fall back to
	// the subtopic breakdown, matching GetTopicMetrics' own AI query.
	if dimension == "week" {
		return `SELECT date_trunc('week', created_at)::date AS label,
			COALESCE(COUNT(*) FILTER (WHERE handling_level = 0 AND status = 'DONE')::float / NULLIF(COUNT(*), 0) * 100, 0) AS value
			FROM claims
			GROUP BY label
			ORDER BY label`
	}
	return `SELECT subtopic AS label,
		COALESCE(COUNT(*) FILTER (WHERE handling_level = 0 AND status = 'DONE')::float / NULLIF(COUNT(*), 0) * 100, 0) AS value
		FROM claims
		WHERE subtopic IS NOT NULL
		GROUP BY subtopic
		ORDER BY value DESC`
}

func escalationGrowthQuery() string {
	return `WITH weekly_stats AS (
		SELECT subtopic,
			COUNT(DISTINCT id) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS current_week,
			COUNT(DISTINCT id) FILTER (WHERE created_at >= NOW() - INTERVAL '35 days' AND created_at < NOW() - INTERVAL '7 days')::float / 4.0 AS avg_4_weeks
		FROM claims
		WHERE subtopic IS NOT NULL
		GROUP BY subtopic
	)
	SELECT subtopic AS label, ((current_week - avg_4_weeks) / avg_4_weeks) * 100 AS value
	FROM weekly_stats
	WHERE avg_4_weeks > 0
	ORDER BY value DESC`
}

// CardTitle builds a readable default title for a generated card.
func CardTitle(title, metric, dimension string) string {
	if title != "" {
		return title
	}
	return fmt.Sprintf("%s by %s", metric, dimension)
}
