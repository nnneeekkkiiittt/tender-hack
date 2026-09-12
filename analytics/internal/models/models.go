package models

import (
	"time"
)

type User struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Role        UserRole  `json:"role"`
	Hash        string    `json:"-"`
	AuthVersion int64     `json:"auth_version"`
	CreatedAt   time.Time `json:"created_at"`
}

type Claim struct {
	ID            int64       `json:"id"`
	AuthorID      int64       `json:"author_id"`
	Title         string      `json:"title"`
	Topic         string      `json:"topic"`
	Subtopic      *string     `json:"subtopic,omitempty"`
	Status        ClaimStatus `json:"status"`
	OperatorID    *int64      `json:"operator_id,omitempty"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
	AssignedAt    *time.Time  `json:"assigned_at,omitempty"`
	ResolvedAt    *time.Time  `json:"resolved_at,omitempty"`
	CancelledAt   *time.Time  `json:"cancelled_at,omitempty"`
	HandlingLevel int16       `json:"handling_level"`
	RequestID     *string     `json:"request_id,omitempty"`
}

type Message struct {
	ID         int64      `json:"id"`
	ClaimID    int64      `json:"claim_id"`
	AuthorID   *int64     `json:"author,omitempty"`
	AuthorKind AuthorKind `json:"author_kind"`
	Text       string     `json:"text"`
	Metadata   []byte     `json:"metadata"`
	SentAt     time.Time  `json:"sent_at"`
}

type Reaction struct {
	ID          int64              `json:"id"`
	ClaimID     int64              `json:"claim_id"`
	OperatorID  *int64             `json:"operator_id,omitempty"`
	SubmittedBy int64              `json:"submitted_by"`
	Like        bool               `json:"like"`
	Reasons     []Reason           `json:"reasons,omitempty"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
	TargetKind  ReactionTargetKind `json:"target_kind"`
	MessageID   *int64             `json:"message_id,omitempty"`
}

type ClaimEvent struct {
	ID          int64     `json:"id"`
	ClaimID     int64     `json:"claim_id"`
	ActorID     *int64    `json:"actor_id,omitempty"`
	OccurredAt  time.Time `json:"occurred_at"`
	BeforeState []byte    `json:"before_state,omitempty"`
	AfterState  []byte    `json:"after_state"`
}

type AuthSession struct {
	ID          int64      `json:"id"`
	UserID      int64      `json:"user_id"`
	TokenHash   string     `json:"-"`
	AuthVersion int64      `json:"auth_version"`
	CreatedAt   time.Time  `json:"created_at"`
	ExpiresAt   time.Time  `json:"expires_at"`
	RevokedAt   *time.Time `json:"revoked_at,omitempty"`
}

type DemoAccount struct {
	Role   UserRole `json:"role"`
	UserID int64    `json:"user_id"`
}

// Filters.
type Pagination struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}
