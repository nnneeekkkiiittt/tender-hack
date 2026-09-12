package datamanager

import (
	"analytics/internal/models"
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DataManager struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *DataManager {
	return &DataManager{db: db}
}

// GetRawUsersData — выборка пользователей по фильтрам
func (m *DataManager) GetRawUsersData(ctx context.Context, f models.UsersFilter) ([]models.User, error) {
	query := `SELECT id, name, role, hash FROM users WHERE 1=1`
	args := []any{}
	argID := 1

	if len(f.UserIDs) > 0 {
		query += fmt.Sprintf(" AND id = ANY($%d)", argID)
		args = append(args, f.UserIDs)
		argID++
	}

	if len(f.Roles) > 0 {
		query += fmt.Sprintf(" AND role::text = ANY($%d)", argID)
		args = append(args, f.Roles)
		argID++
	}

	query += fmt.Sprintf(" ORDER BY id ASC LIMIT $%d OFFSET $%d", argID, argID+1)
	args = append(args, f.Limit, f.Offset)

	rows, err := m.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query users error: %w", err)
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Role, &u.Hash); err != nil {
			return nil, fmt.Errorf("scan user error: %w", err)
		}
		users = append(users, u)
	}

	return users, nil
}

// GetRawClaimsData — выборка обращений (claims) с обработкой BIGINT[] operator_id
func (m *DataManager) GetRawClaimsData(ctx context.Context, f models.ClaimsFilter) ([]models.Claim, error) {
	// Preserve the analytics array-shaped response over the operational scalar assignment.
	query := `SELECT id, author_id, title, topic, subtopic, status,
        CASE WHEN operator_id IS NULL THEN '{}'::bigint[] ELSE ARRAY[operator_id] END
        FROM claims WHERE 1=1`
	args := []any{}
	argID := 1

	if len(f.ClaimIDs) > 0 {
		query += fmt.Sprintf(" AND id = ANY($%d)", argID)
		args = append(args, f.ClaimIDs)
		argID++
	}

	if len(f.AuthorIDs) > 0 {
		query += fmt.Sprintf(" AND author_id = ANY($%d)", argID)
		args = append(args, f.AuthorIDs)
		argID++
	}

	if len(f.Statuses) > 0 {
		query += fmt.Sprintf(" AND status::text = ANY($%d)", argID)
		args = append(args, f.Statuses)
		argID++
	}

	if len(f.Topics) > 0 {
		query += fmt.Sprintf(" AND topic = ANY($%d)", argID)
		args = append(args, f.Topics)
		argID++
	}

	// Пересечение массивов: проверяет, входит ли хотя бы один оператор из фильтра в массив operator_id
	if len(f.OperatorIDs) > 0 {
		query += fmt.Sprintf(" AND operator_id = ANY($%d)", argID)
		args = append(args, f.OperatorIDs)
		argID++
	}

	query += fmt.Sprintf(" ORDER BY id DESC LIMIT $%d OFFSET $%d", argID, argID+1)
	args = append(args, f.Limit, f.Offset)

	rows, err := m.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query claims error: %w", err)
	}
	defer rows.Close()

	var claims []models.Claim
	for rows.Next() {
		var c models.Claim
		// pgx сам распарсит PostgreSQL BIGINT[] в []int64 в поле OperatorID
		if err := rows.Scan(&c.ID, &c.AuthorID, &c.Title, &c.Topic, &c.Subtopic, &c.Status, &c.OperatorID); err != nil {
			return nil, fmt.Errorf("scan claim error: %w", err)
		}
		claims = append(claims, c)
	}

	return claims, nil
}

// GetRawMessagesData — выборка сообщений с фильтрацией по времени sent_at
func (m *DataManager) GetRawMessagesData(ctx context.Context, f models.MessagesFilter) ([]models.Message, error) {
	query := `SELECT id, claim_id, text, sent_at FROM messages WHERE 1=1`
	args := []any{}
	argID := 1

	if len(f.ClaimIDs) > 0 {
		query += fmt.Sprintf(" AND claim_id = ANY($%d)", argID)
		args = append(args, f.ClaimIDs)
		argID++
	}

	if f.FromTime != nil {
		query += fmt.Sprintf(" AND sent_at >= $%d", argID)
		args = append(args, *f.FromTime)
		argID++
	}

	if f.ToTime != nil {
		query += fmt.Sprintf(" AND sent_at <= $%d", argID)
		args = append(args, *f.ToTime)
		argID++
	}

	query += fmt.Sprintf(" ORDER BY sent_at DESC LIMIT $%d OFFSET $%d", argID, argID+1)
	args = append(args, f.Limit, f.Offset)

	rows, err := m.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query messages error: %w", err)
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var msg models.Message
		if err := rows.Scan(&msg.ID, &msg.ClaimID, &msg.Text, &msg.SentAt); err != nil {
			return nil, fmt.Errorf("scan message error: %w", err)
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

// GetRawReactionsData — выборка реакций с учетом массивов reason[] и операторов
func (m *DataManager) GetRawReactionsData(ctx context.Context, f models.ReactionsFilter) ([]models.Reaction, error) {
	query := `SELECT id, claim_id, "like", reasons::text[], operator_id FROM reactions WHERE 1=1`
	args := []any{}
	argID := 1

	if len(f.ClaimIDs) > 0 {
		query += fmt.Sprintf(" AND claim_id = ANY($%d)", argID)
		args = append(args, f.ClaimIDs)
		argID++
	}

	if len(f.OperatorIDs) > 0 {
		query += fmt.Sprintf(" AND operator_id = ANY($%d)", argID)
		args = append(args, f.OperatorIDs)
		argID++
	}

	if f.Like != nil {
		query += fmt.Sprintf(" AND \"like\" = $%d", argID)
		args = append(args, *f.Like)
		argID++
	}

	// Пересечение массивов: проверяет совпадение любого из элементов reason[]
	if len(f.Reasons) > 0 {
		query += fmt.Sprintf(" AND reasons::text[] && $%d", argID)
		args = append(args, f.Reasons)
		argID++
	}

	query += fmt.Sprintf(" ORDER BY id DESC LIMIT $%d OFFSET $%d", argID, argID+1)
	args = append(args, f.Limit, f.Offset)

	rows, err := m.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query reactions error: %w", err)
	}
	defer rows.Close()

	var reactions []models.Reaction
	for rows.Next() {
		var r models.Reaction
		// pgx сканирует Postgres ENUM[] в []models.Reason
		if err := rows.Scan(&r.ID, &r.ClaimID, &r.Like, &r.Reason, &r.Operator); err != nil {
			return nil, fmt.Errorf("scan reaction error: %w", err)
		}
		reactions = append(reactions, r)
	}

	return reactions, nil
}

// GetOperatorMetrics рассчитывает показатели работы конкретного оператора или ИИ (operator_id)
func (m *DataManager) GetOperatorMetrics(ctx context.Context, operatorID int64) (*models.OperatorMetricsResult, error) {
	res := &models.OperatorMetricsResult{OperatorID: operatorID}

	// 1. % дизлайков относительно всех обращений, где принимал участие оператор
	dislikeQuery := `
		SELECT 
			COALESCE(COUNT(*) FILTER (WHERE "like" = false)::float / NULLIF(COUNT(*), 0) * 100, 0)
		FROM reactions 
		WHERE "operator" = $1`
	if err := m.db.QueryRow(ctx, dislikeQuery, operatorID).Scan(&res.DislikePercentage); err != nil {
		return nil, fmt.Errorf("error dislike query: %w", err)
	}

	// 2. Среднее время ответа на сообщение (интервал между последовательными сообщениями в одном тикете)
	avgRespQuery := `
		WITH intervals AS (
			SELECT 
				EXTRACT(EPOCH FROM (sent_at - LAG(sent_at) OVER (PARTITION BY claim_id ORDER BY sent_at))) as diff
			FROM messages
			WHERE claim_id IN (SELECT id FROM claims WHERE $1 = ANY(operator_id))
		)
		SELECT COALESCE(AVG(diff), 0) FROM intervals WHERE diff IS NOT NULL`
	if err := m.db.QueryRow(ctx, avgRespQuery, operatorID).Scan(&res.AvgResponseTimeSeconds); err != nil {
		return nil, fmt.Errorf("error avg response time query: %w", err)
	}

	// 3. % решенных самостоятельно кейсов (где оператор единственный в массиве operator_id и статус DONE)
	selfResolvedQuery := `
		SELECT 
			COALESCE(
				COUNT(*) FILTER (WHERE status = 'DONE' AND ARRAY_LENGTH(operator_id, 1) = 1)::float / 
				NULLIF(COUNT(*), 0) * 100, 
			0)
		FROM claims 
		WHERE $1 = ANY(operator_id)`
	if err := m.db.QueryRow(ctx, selfResolvedQuery, operatorID).Scan(&res.ResolvedSelfPercentage); err != nil {
		return nil, fmt.Errorf("error self resolved query: %w", err)
	}

	// 4. Топ 1 причина дизлайков (раскрываем массив reason[])
	topReasonQuery := `
		SELECT r.reason_elem::text
		FROM reactions, UNNEST(reason) AS r(reason_elem)
		WHERE "operator" = $1 AND "like" = false
		GROUP BY r.reason_elem
		ORDER BY COUNT(*) DESC
		LIMIT 1`
	var topReason string
	err := m.db.QueryRow(ctx, topReasonQuery, operatorID).Scan(&topReason)
	if err == nil {
		res.TopDislikeReason = topReason
	}

	return res, nil
}

// GetTopicMetrics рассчитывает метрики по конкретной теме/подтеме
func (m *DataManager) GetTopicMetrics(ctx context.Context, topic, subtopic string) (*models.TopicMetricsResult, error) {
	res := &models.TopicMetricsResult{Topic: topic, Subtopic: subtopic}

	// 1. % обращений по конкретной подтеме отн. всех обращений
	shareQuery := `
		SELECT 
			COALESCE(
				COUNT(*) FILTER (WHERE topic = $1 AND subtopic = $2)::float / 
				NULLIF((SELECT COUNT(*) FROM claims), 0) * 100, 
			0)
		FROM claims`
	if err := m.db.QueryRow(ctx, shareQuery, topic, subtopic).Scan(&res.SubtopicSharePercentage); err != nil {
		return nil, fmt.Errorf("error subtopic share query: %w", err)
	}

	// 2. Среднее время решения тикета (интервал между первым и последним сообщением в тикете)
	avgResolutionQuery := `
		WITH ticket_times AS (
			SELECT 
				EXTRACT(EPOCH FROM (MAX(sent_at) - MIN(sent_at))) / 3600.0 as duration_hours
			FROM messages m
			JOIN claims c ON m.claim_id = c.id
			WHERE c.topic = $1 AND c.subtopic = $2 AND c.status = 'DONE'
			GROUP BY m.claim_id
		)
		SELECT COALESCE(AVG(duration_hours), 0) FROM ticket_times`
	if err := m.db.QueryRow(ctx, avgResolutionQuery, topic, subtopic).Scan(&res.AvgResolutionTimeHours); err != nil {
		return nil, fmt.Errorf("error avg resolution query: %w", err)
	}

	// 3. % обращений по подтеме, решенных ИИ (предположим ИИ id = 0 или единственный оператор с ролью 'user'/'bot')
	aiQuery := `
		SELECT 
			COALESCE(
				COUNT(*) FILTER (WHERE 0 = ANY(operator_id))::float / 
				NULLIF(COUNT(*), 0) * 100, 
			0)
		FROM claims
		WHERE topic = $1 AND subtopic = $2`
	if err := m.db.QueryRow(ctx, aiQuery, topic, subtopic).Scan(&res.AIResolvedPercentage); err != nil {
		return nil, fmt.Errorf("error AI resolved query: %w", err)
	}

	return res, nil
}

// GetEscalations рассчитывает аномальный рост обращений по подтемам
func (m *DataManager) GetEscalations(ctx context.Context, minTicketsThreshold int64) ([]models.EscalationResult, error) {
	// Считаем обращения за текущую неделю (тек.) и в среднем за предыдущие 4 недели (ср4)
	query := `
		WITH weekly_stats AS (
			SELECT 
				c.topic, 
				c.subtopic,
				COUNT(*) FILTER (WHERE m.sent_at >= NOW() - INTERVAL '7 days') as current_week,
				COUNT(*) FILTER (WHERE m.sent_at >= NOW() - INTERVAL '35 days' AND m.sent_at < NOW() - INTERVAL '7 days')::float / 4.0 as avg_4_weeks
			FROM claims c
			JOIN messages m ON c.id = m.claim_id
			WHERE c.subtopic IS NOT NULL
			GROUP BY c.topic, c.subtopic
		)
		SELECT topic, subtopic, current_week, avg_4_weeks
		FROM weekly_stats
		WHERE current_week >= $1 AND avg_4_weeks > 0`

	rows, err := m.db.Query(ctx, query, minTicketsThreshold)
	if err != nil {
		return nil, fmt.Errorf("error escalations query: %w", err)
	}
	defer rows.Close()

	var results []models.EscalationResult
	for rows.Next() {
		var r models.EscalationResult
		if err := rows.Scan(&r.Topic, &r.Subtopic, &r.CurrentWeek, &r.Avg4Weeks); err != nil {
			return nil, err
		}

		// Формула: (тек - ср4) / ср4 * 100%
		r.GrowthPercent = ((float64(r.CurrentWeek) - r.Avg4Weeks) / r.Avg4Weeks) * 100.0

		if r.GrowthPercent > 100.0 {
			r.AlertLevel = "CRIT"
			results = append(results, r)
		} else if r.GrowthPercent > 50.0 {
			r.AlertLevel = "WARN"
			results = append(results, r)
		}
	}

	return results, nil
}
