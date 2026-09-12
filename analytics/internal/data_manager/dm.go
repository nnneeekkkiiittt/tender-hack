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
		query += fmt.Sprintf(" AND role = ANY($%d)", argID)
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
	query := `SELECT id, author_id, title, topic, subtopic, status, operator_id FROM claims WHERE 1=1`
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
		query += fmt.Sprintf(" AND status = ANY($%d)", argID)
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
		query += fmt.Sprintf(" AND operator_id && $%d", argID)
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
	query := `SELECT id, claim_id, "like", reason, "operator" FROM reactions WHERE 1=1`
	args := []any{}
	argID := 1

	if len(f.ClaimIDs) > 0 {
		query += fmt.Sprintf(" AND claim_id = ANY($%d)", argID)
		args = append(args, f.ClaimIDs)
		argID++
	}

	if len(f.OperatorIDs) > 0 {
		query += fmt.Sprintf(" AND \"operator\" = ANY($%d)", argID)
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
		query += fmt.Sprintf(" AND reason && $%d", argID)
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
