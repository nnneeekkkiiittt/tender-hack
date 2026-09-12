package models

import (
	"time"
)

// User соответствует таблице 'users'
type User struct {
	ID   int64    `json:"id" db:"id"`
	Name string   `json:"name" db:"name"`
	Role UserRole `json:"role" db:"role"`
	Hash string   `json:"-" db:"hash"` // json:"-" скрывает хэш из ответов API
}

// Claim соответствует таблице 'claims'
type Claim struct {
	ID         int64   `json:"id" db:"id"`
	AuthorID   int64   `json:"author_id" db:"author_id"`
	Title      string  `json:"title" db:"title"`
	Topic      *string `json:"topic,omitempty" db:"topic"`       // Указатель, так как поле NULLable
	Subtopic   *string `json:"subtopic,omitempty" db:"subtopic"` // Указатель, так как поле NULLable
	Status     Status  `json:"status" db:"status"`
	OperatorID []int64 `json:"operator_id,omitempty" db:"operator_id"` // Массив BIGINT[] в Postgres
}

// Message соответствует таблице 'messages'
type Message struct {
	ID      int64     `json:"id" db:"id"`
	ClaimID int64     `json:"claim_id" db:"claim_id"`
	Text    string    `json:"text" db:"text"`
	SentAt  time.Time `json:"sent_at" db:"sent_at"`
}

// Reaction соответствует таблице 'reactions' с учетом всех миграций
type Reaction struct {
	ID       int64    `json:"id" db:"id"`
	ClaimID  int64    `json:"claim_id" db:"claim_id"`
	Like     bool     `json:"like" db:"like"`
	Reason   []Reason `json:"reason,omitempty" db:"reason"` // Изменено на массив reason[] миграцией #2
	Operator *int64   `json:"operator" db:"operator_id"` // AI reactions have no human operator.
}
