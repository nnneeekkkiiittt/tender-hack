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
