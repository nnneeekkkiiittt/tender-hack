package datamanager

import (
	"analytics/internal/models"
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DataManager struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) *DataManager { return &DataManager{db: db} }

func (m *DataManager) GetRawUsersData(ctx context.Context, f models.UsersFilter) ([]models.User, error) {
	query := `SELECT id, name, role, hash, auth_version, created_at FROM users WHERE TRUE`
	args := []any{}
	arg := 1
	if len(f.UserIDs) > 0 {
		query += fmt.Sprintf(" AND id = ANY($%d)", arg)
		args = append(args, f.UserIDs)
		arg++
	}
	if len(f.Roles) > 0 {
		query += fmt.Sprintf(" AND role::text = ANY($%d)", arg)
		args = append(args, userRolesToStrings(f.Roles))
		arg++
	}
	query += fmt.Sprintf(" ORDER BY id ASC LIMIT $%d OFFSET $%d", arg, arg+1)
	args = append(args, f.Limit, f.Offset)

	rows, err := m.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query users error: %w", err)
	}
	defer rows.Close()
	var result []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Role, &u.Hash, &u.AuthVersion, &u.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan user error: %w", err)
		}
		result = append(result, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users error: %w", err)
	}
	return result, nil
}

func (m *DataManager) GetRawClaimsData(ctx context.Context, f models.ClaimsFilter) ([]models.Claim, error) {
	query := `SELECT id, author_id, title, topic, subtopic, status, operator_id,
		created_at, updated_at, assigned_at, resolved_at, cancelled_at, handling_level, request_id
		FROM claims WHERE TRUE`
	args := []any{}
	arg := 1
	if len(f.ClaimIDs) > 0 {
		query += fmt.Sprintf(" AND id = ANY($%d)", arg)
		args = append(args, f.ClaimIDs)
		arg++
	}
	if len(f.AuthorIDs) > 0 {
		query += fmt.Sprintf(" AND author_id = ANY($%d)", arg)
		args = append(args, f.AuthorIDs)
		arg++
	}
	if len(f.OperatorIDs) > 0 {
		query += fmt.Sprintf(" AND operator_id = ANY($%d)", arg)
		args = append(args, f.OperatorIDs)
		arg++
	}
	if len(f.Statuses) > 0 {
		query += fmt.Sprintf(" AND status::text = ANY($%d)", arg)
		args = append(args, claimStatusesToStrings(f.Statuses))
		arg++
	}
	if len(f.Topics) > 0 {
		query += fmt.Sprintf(" AND topic = ANY($%d)", arg)
		args = append(args, f.Topics)
		arg++
	}
	if len(f.Subtopics) > 0 {
		query += fmt.Sprintf(" AND subtopic = ANY($%d)", arg)
		args = append(args, f.Subtopics)
		arg++
	}
	query += fmt.Sprintf(" ORDER BY id DESC LIMIT $%d OFFSET $%d", arg, arg+1)
	args = append(args, f.Limit, f.Offset)

	rows, err := m.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query claims error: %w", err)
	}
	defer rows.Close()
	var result []models.Claim
	for rows.Next() {
		var c models.Claim
		if err := rows.Scan(&c.ID, &c.AuthorID, &c.Title, &c.Topic, &c.Subtopic, &c.Status, &c.OperatorID, &c.CreatedAt, &c.UpdatedAt, &c.AssignedAt, &c.ResolvedAt, &c.CancelledAt, &c.HandlingLevel, &c.RequestID); err != nil {
			return nil, fmt.Errorf("scan claim error: %w", err)
		}
		result = append(result, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate claims error: %w", err)
	}
	return result, nil
}

func (m *DataManager) GetRawMessagesData(ctx context.Context, f models.MessagesFilter) ([]models.Message, error) {
	query := `SELECT id, claim_id, author, author_kind, text, metadata, sent_at FROM messages WHERE TRUE`
	args := []any{}
	arg := 1
	if len(f.ClaimIDs) > 0 {
		query += fmt.Sprintf(" AND claim_id = ANY($%d)", arg)
		args = append(args, f.ClaimIDs)
		arg++
	}
	if len(f.AuthorIDs) > 0 {
		query += fmt.Sprintf(" AND author = ANY($%d)", arg)
		args = append(args, f.AuthorIDs)
		arg++
	}
	if len(f.AuthorKinds) > 0 {
		query += fmt.Sprintf(" AND author_kind = ANY($%d)", arg)
		args = append(args, authorKindsToStrings(f.AuthorKinds))
		arg++
	}
	if f.FromTime != nil {
		query += fmt.Sprintf(" AND sent_at >= $%d", arg)
		args = append(args, *f.FromTime)
		arg++
	}
	if f.ToTime != nil {
		query += fmt.Sprintf(" AND sent_at <= $%d", arg)
		args = append(args, *f.ToTime)
		arg++
	}
	query += fmt.Sprintf(" ORDER BY sent_at DESC, id DESC LIMIT $%d OFFSET $%d", arg, arg+1)
	args = append(args, f.Limit, f.Offset)
	rows, err := m.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query messages error: %w", err)
	}
	defer rows.Close()
	var result []models.Message
	for rows.Next() {
		var msg models.Message
		if err := rows.Scan(&msg.ID, &msg.ClaimID, &msg.AuthorID, &msg.AuthorKind, &msg.Text, &msg.Metadata, &msg.SentAt); err != nil {
			return nil, fmt.Errorf("scan message error: %w", err)
		}
		result = append(result, msg)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate messages error: %w", err)
	}
	return result, nil
}

func (m *DataManager) GetRawReactionsData(ctx context.Context, f models.ReactionsFilter) ([]models.Reaction, error) {
	query := `SELECT id, claim_id, operator_id, submitted_by, "like", reasons::text[], created_at, updated_at, target_kind, message_id FROM reactions WHERE TRUE`
	args := []any{}
	arg := 1
	if len(f.ClaimIDs) > 0 {
		query += fmt.Sprintf(" AND claim_id = ANY($%d)", arg)
		args = append(args, f.ClaimIDs)
		arg++
	}
	if len(f.OperatorIDs) > 0 {
		query += fmt.Sprintf(" AND operator_id = ANY($%d)", arg)
		args = append(args, f.OperatorIDs)
		arg++
	}
	if len(f.SubmittedBy) > 0 {
		query += fmt.Sprintf(" AND submitted_by = ANY($%d)", arg)
		args = append(args, f.SubmittedBy)
		arg++
	}
	if len(f.MessageIDs) > 0 {
		query += fmt.Sprintf(" AND message_id = ANY($%d)", arg)
		args = append(args, f.MessageIDs)
		arg++
	}
	if len(f.TargetKinds) > 0 {
		query += fmt.Sprintf(" AND target_kind = ANY($%d)", arg)
		args = append(args, targetKindsToStrings(f.TargetKinds))
		arg++
	}
	if f.Like != nil {
		query += fmt.Sprintf(" AND \"like\" = $%d", arg)
		args = append(args, *f.Like)
		arg++
	}
	if len(f.Reasons) > 0 {
		query += fmt.Sprintf(" AND reasons::text[] && $%d", arg)
		args = append(args, reasonsToStrings(f.Reasons))
		arg++
	}
	query += fmt.Sprintf(" ORDER BY id DESC LIMIT $%d OFFSET $%d", arg, arg+1)
	args = append(args, f.Limit, f.Offset)
	rows, err := m.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query reactions error: %w", err)
	}
	defer rows.Close()
	var result []models.Reaction
	for rows.Next() {
		var r models.Reaction
		var rawReasons []string
		if err := rows.Scan(&r.ID, &r.ClaimID, &r.OperatorID, &r.SubmittedBy, &r.Like, &rawReasons, &r.CreatedAt, &r.UpdatedAt, &r.TargetKind, &r.MessageID); err != nil {
			return nil, fmt.Errorf("scan reaction error: %w", err)
		}
		r.Reasons = stringReasonsToModels(rawReasons)
		result = append(result, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate reactions error: %w", err)
	}
	return result, nil
}

func (m *DataManager) GetOperatorMetrics(
	ctx context.Context,
	operatorID int64,
) (*models.OperatorMetricsResult, error) {
	res := &models.OperatorMetricsResult{
		OperatorID: operatorID,
	}

	// AI (operator_id = 0, see migrations/009-add-ai-row.sql) has no
	// reactions with target_kind = 'OPERATOR' — the reactions_target CHECK
	// constraint in 006-unified-reactions.sql requires AI reactions to be
	// target_kind = 'AI_MESSAGE' with operator_id ALWAYS NULL (there is only
	// one AI, so there's nothing to filter by id). Queries 1 and 4 below
	// therefore need a different WHERE clause for AI; queries 2 and 3 are
	// based on claims.operator_id, which IS correctly 0 for AI-owned claims,
	// so they work unmodified for both cases.
	isAI := operatorID == 0

	// 1. Доля дизлайков.
	var dislikeQuery string
	dislikeArgs := []any{}
	if isAI {
		dislikeQuery = `
            SELECT COALESCE(
                COUNT(*) FILTER (WHERE "like" = false)::float
                / NULLIF(COUNT(*), 0) * 100,
                0
            )
            FROM reactions
            WHERE target_kind = 'AI_MESSAGE'
        `
	} else {
		dislikeQuery = `
            SELECT COALESCE(
                COUNT(*) FILTER (WHERE "like" = false)::float
                / NULLIF(COUNT(*), 0) * 100,
                0
            )
            FROM reactions
            WHERE target_kind = 'OPERATOR'
              AND operator_id = $1
        `
		dislikeArgs = append(dislikeArgs, operatorID)
	}
	if err := m.db.QueryRow(ctx, dislikeQuery, dislikeArgs...).Scan(&res.DislikePercentage); err != nil {
		return nil, fmt.Errorf("error dislike query: %w", err)
	}

	// 2. Средний интервал между сообщениями по заявкам, закреплённым за этим
	// operator_id — для ИИ это тоже корректно работает при operator_id = 0.
	const avgRespQuery = `
        WITH intervals AS (
            SELECT EXTRACT(
                EPOCH FROM (
                    sent_at - LAG(sent_at)
                    OVER (
                        PARTITION BY claim_id
                        ORDER BY sent_at, id
                    )
                )
            ) AS diff
            FROM messages
            WHERE claim_id IN (
                SELECT id
                FROM claims
                WHERE operator_id = $1
            )
        )
        SELECT COALESCE(AVG(diff), 0)
        FROM intervals
        WHERE diff IS NOT NULL
    `
	if err := m.db.QueryRow(
		ctx,
		avgRespQuery,
		operatorID,
	).Scan(&res.AvgResponseTimeSeconds); err != nil {
		return nil, fmt.Errorf("error avg response time query: %w", err)
	}

	// 3. Процент самостоятельно решённых обращений — claims ещё закреплены
	// за этим operator_id (для ИИ тоже корректно при operator_id = 0).
	const selfResolvedQuery = `
        SELECT COALESCE(
            COUNT(*) FILTER (
                WHERE status = 'DONE'
                  AND operator_id = $1
            )::float
            /
            NULLIF(COUNT(*), 0) * 100,
            0
        )
        FROM claims
        WHERE operator_id = $1
    `
	if err := m.db.QueryRow(
		ctx,
		selfResolvedQuery,
		operatorID,
	).Scan(&res.ResolvedSelfPercentage); err != nil {
		return nil, fmt.Errorf("error self resolved query: %w", err)
	}

	// 4. Самая частая причина дизлайка — тот же нюанс с target_kind, что и в п.1.
	var topReasonQuery string
	topReasonArgs := []any{}
	if isAI {
		topReasonQuery = `
            SELECT x.reason
            FROM reactions r
            CROSS JOIN LATERAL unnest(r.reasons) AS x(reason)
            WHERE r.target_kind = 'AI_MESSAGE'
              AND r."like" = false
            GROUP BY x.reason
            ORDER BY COUNT(*) DESC
            LIMIT 1
        `
	} else {
		topReasonQuery = `
            SELECT x.reason
            FROM reactions r
            CROSS JOIN LATERAL unnest(r.reasons) AS x(reason)
            WHERE r.target_kind = 'OPERATOR'
              AND r.operator_id = $1
              AND r."like" = false
            GROUP BY x.reason
            ORDER BY COUNT(*) DESC
            LIMIT 1
        `
		topReasonArgs = append(topReasonArgs, operatorID)
	}

	var topReason string
	if err := m.db.QueryRow(ctx, topReasonQuery, topReasonArgs...).Scan(&topReason); err == nil {
		res.TopDislikeReason = topReason
	} else if err != pgx.ErrNoRows {
		return nil, fmt.Errorf("error top dislike reason query: %w", err)
	}

	return res, nil
}

func (m *DataManager) GetTopicMetrics(ctx context.Context, topic, subtopic string) (*models.TopicMetricsResult, error) {
	res := &models.TopicMetricsResult{Topic: topic, Subtopic: subtopic}
	const shareQuery = `SELECT COALESCE(COUNT(*) FILTER (WHERE topic=$1 AND subtopic=$2)::float / NULLIF((SELECT COUNT(*) FROM claims),0) * 100,0) FROM claims`
	if err := m.db.QueryRow(ctx, shareQuery, topic, subtopic).Scan(&res.SubtopicSharePercentage); err != nil {
		return nil, fmt.Errorf("error subtopic share query: %w", err)
	}
	const avgResolutionQuery = `WITH ticket_times AS (SELECT EXTRACT(EPOCH FROM (MAX(m.sent_at)-MIN(m.sent_at)))/3600.0 AS duration_hours FROM messages m JOIN claims c ON m.claim_id=c.id WHERE c.topic=$1 AND c.subtopic=$2 AND c.status='DONE' GROUP BY m.claim_id) SELECT COALESCE(AVG(duration_hours),0) FROM ticket_times`
	if err := m.db.QueryRow(ctx, avgResolutionQuery, topic, subtopic).Scan(&res.AvgResolutionTimeHours); err != nil {
		return nil, fmt.Errorf("error avg resolution query: %w", err)
	}
	// AI-owned claims are the level-0 queue; they have no human operator assigned.
	const aiQuery = `SELECT COALESCE(COUNT(*) FILTER (WHERE handling_level=0 AND status='DONE')::float / NULLIF(COUNT(*),0) * 100,0) FROM claims WHERE topic=$1 AND subtopic=$2`
	if err := m.db.QueryRow(ctx, aiQuery, topic, subtopic).Scan(&res.AIResolvedPercentage); err != nil {
		return nil, fmt.Errorf("error AI resolved query: %w", err)
	}
	return res, nil
}

func (m *DataManager) GetEscalations(ctx context.Context) ([]models.EscalationResult, error) {
	const query = `WITH weekly_stats AS (
		SELECT c.topic,c.subtopic,
		COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= NOW()-INTERVAL '7 days') AS current_week,
		COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= NOW()-INTERVAL '35 days' AND c.created_at < NOW()-INTERVAL '7 days')::float / 4.0 AS avg_4_weeks
		FROM claims c WHERE c.subtopic IS NOT NULL GROUP BY c.topic,c.subtopic
	) SELECT topic,subtopic,current_week,avg_4_weeks FROM weekly_stats WHERE avg_4_weeks > 0`
	rows, err := m.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("error escalations query: %w", err)
	}
	defer rows.Close()
	var results []models.EscalationResult
	for rows.Next() {
		var r models.EscalationResult
		if err := rows.Scan(&r.Topic, &r.Subtopic, &r.CurrentWeek, &r.Avg4Weeks); err != nil {
			return nil, fmt.Errorf("scan escalation error: %w", err)
		}
		r.GrowthPercent = ((float64(r.CurrentWeek) - r.Avg4Weeks) / r.Avg4Weeks) * 100
		if r.GrowthPercent > 100 {
			r.AlertLevel = "CRIT"
			results = append(results, r)
		} else if r.GrowthPercent > 50 {
			r.AlertLevel = "WARN"
			results = append(results, r)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate escalations error: %w", err)
	}
	return results, nil
}

func userRolesToStrings(v []models.UserRole) []string {
	r := make([]string, len(v))
	for i, x := range v {
		r[i] = string(x)
	}
	return r
}
func claimStatusesToStrings(v []models.ClaimStatus) []string {
	r := make([]string, len(v))
	for i, x := range v {
		r[i] = string(x)
	}
	return r
}
func authorKindsToStrings(v []models.AuthorKind) []string {
	r := make([]string, len(v))
	for i, x := range v {
		r[i] = string(x)
	}
	return r
}
func targetKindsToStrings(v []models.ReactionTargetKind) []string {
	r := make([]string, len(v))
	for i, x := range v {
		r[i] = string(x)
	}
	return r
}
func reasonsToStrings(v []models.Reason) []string {
	r := make([]string, len(v))
	for i, x := range v {
		r[i] = string(x)
	}
	return r
}
func stringReasonsToModels(v []string) []models.Reason {
	if v == nil {
		return nil
	}
	r := make([]models.Reason, len(v))
	for i, x := range v {
		r[i] = models.Reason(strings.TrimSpace(x))
	}
	return r
}
