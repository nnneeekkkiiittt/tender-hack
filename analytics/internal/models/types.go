package models

// PostgreSQL enum aliases.
type UserRole string

const (
	RoleAdmin     UserRole = "admin"
	RoleSupportL1 UserRole = "supportL1"
	RoleSupportL2 UserRole = "supportL2"
	RoleSupportL3 UserRole = "supportL3"
	RoleUser      UserRole = "user"
)

type ClaimStatus string

const (
	StatusNew       ClaimStatus = "NEW"
	StatusInWork    ClaimStatus = "IN WORK"
	StatusCancelled ClaimStatus = "CANCELLED"
	StatusDone      ClaimStatus = "DONE"
)

type Reason string

const (
	ReasonSlowWork         Reason = "SLOW WORK"
	ReasonIncorrectAnswer  Reason = "INCORRECT ANSWER"
	ReasonIrrelevantAnswer Reason = "IRRELEVANT ANSWER"
	ReasonRudeBehaviour    Reason = "RUDE BEHAVIOUR"
)

type ReactionTargetKind string

const (
	TargetOperator  ReactionTargetKind = "OPERATOR"
	TargetAIMessage ReactionTargetKind = "AI_MESSAGE"
)

type AuthorKind string

const (
	AuthorUser    AuthorKind = "USER"
	AuthorSupport AuthorKind = "SUPPORT"
	AuthorAdmin   AuthorKind = "ADMIN"
	AuthorAI      AuthorKind = "AI"
	AuthorSystem  AuthorKind = "SYSTEM"
)
