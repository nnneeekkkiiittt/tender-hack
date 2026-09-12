package models

// UserRole представляет ENUM 'user_role'
type UserRole string

const (
	RoleAdmin     UserRole = "admin"
	RoleSupportL1 UserRole = "supportL1"
	RoleSupportL2 UserRole = "supportL2"
	RoleSupportL3 UserRole = "supportL3"
	RoleUser      UserRole = "user"
)

// Status представляет ENUM 'status'
type Status string

const (
	StatusNew       Status = "NEW"
	StatusInWork    Status = "IN WORK"
	StatusCancelled Status = "CANCELLED"
	StatusDone      Status = "DONE"
)

// Reason представляет ENUM 'reason'
type Reason string

const (
	ReasonSlowWork         Reason = "SLOW WORK"
	ReasonIncorrectAnswer  Reason = "INCORRECT ANSWER"
	ReasonIrrelevantAnswer Reason = "IRRELEVANT ANSWER"
	ReasonRudeBehaviour    Reason = "RUDE BEHAVIOUR"
)

// OperatorMetricsResult — метрики работы операторов / ИИ
type OperatorMetricsResult struct {
	OperatorID             int64   `json:"operator_id"`
	DislikePercentage      float64 `json:"dislike_percentage"`
	AvgResponseTimeSeconds float64 `json:"avg_response_time_seconds"`
	ResolvedSelfPercentage float64 `json:"resolved_self_percentage"`
	TopDislikeReason       string  `json:"top_dislike_reason,omitempty"`
}

// TopicMetricsResult — метрики по темам и подтемам
type TopicMetricsResult struct {
	Topic                   string  `json:"topic"`
	Subtopic                string  `json:"subtopic"`
	SubtopicSharePercentage float64 `json:"subtopic_share_percentage"`
	AvgResolutionTimeHours  float64 `json:"avg_resolution_time_hours"`
	AIResolvedPercentage    float64 `json:"ai_resolved_percentage"`
}

// EscalationResult — метрика аномального роста обращений (эскалации)
type EscalationResult struct {
	Topic         string  `json:"topic"`
	Subtopic      string  `json:"subtopic"`
	CurrentWeek   int64   `json:"current_week"`
	Avg4Weeks     float64 `json:"avg_4_weeks"`
	GrowthPercent float64 `json:"growth_percent"`
	AlertLevel    string  `json:"alert_level"` // "WARN" или "CRIT"
}
