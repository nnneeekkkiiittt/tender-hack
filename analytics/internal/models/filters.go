package models

import "time"

type UsersFilter struct {
	UserIDs []int64
	Roles   []UserRole
	Pagination
}

type ClaimsFilter struct {
	ClaimIDs    []int64
	AuthorIDs   []int64
	OperatorIDs []int64
	Statuses    []ClaimStatus
	Topics      []string
	Subtopics   []string
	Pagination
}

type MessagesFilter struct {
	ClaimIDs    []int64
	AuthorIDs   []int64
	AuthorKinds []AuthorKind
	FromTime    *time.Time
	ToTime      *time.Time
	Pagination
}

type ReactionsFilter struct {
	ClaimIDs    []int64
	OperatorIDs []int64
	SubmittedBy []int64
	MessageIDs  []int64
	TargetKinds []ReactionTargetKind
	Reasons     []Reason
	Like        *bool
	Pagination
}

// Metric results.
type OperatorMetricsResult struct {
	OperatorID             int64   `json:"operator_id"`
	DislikePercentage      float64 `json:"dislike_percentage"`
	AvgResponseTimeSeconds float64 `json:"avg_response_time_seconds"`
	ResolvedSelfPercentage float64 `json:"resolved_self_percentage"`
	TopDislikeReason       string  `json:"top_dislike_reason,omitempty"`
}

type TopicMetricsResult struct {
	Topic                   string  `json:"topic"`
	Subtopic                string  `json:"subtopic"`
	SubtopicSharePercentage float64 `json:"subtopic_share_percentage"`
	AvgResolutionTimeHours  float64 `json:"avg_resolution_time_hours"`
	AIResolvedPercentage    float64 `json:"ai_resolved_percentage"`
}

type EscalationResult struct {
	Topic         string  `json:"topic"`
	Subtopic      string  `json:"subtopic"`
	CurrentWeek   int64   `json:"current_week"`
	Avg4Weeks     float64 `json:"avg_4_weeks"`
	GrowthPercent float64 `json:"growth_percent"`
	AlertLevel    string  `json:"alert_level"`
}
