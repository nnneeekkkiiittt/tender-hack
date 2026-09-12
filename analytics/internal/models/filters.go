package models

import "time"

// UsersFilter — параметры фильтрации пользователей
type UsersFilter struct {
	UserIDs []int64
	Roles   []UserRole
	Limit   int
	Offset  int
}

// ClaimsFilter — параметры фильтрации обращений (claims)
type ClaimsFilter struct {
	ClaimIDs    []int64
	AuthorIDs   []int64
	OperatorIDs []int64
	Statuses    []Status
	Topics      []string
	Limit       int
	Offset      int
}

// MessagesFilter — параметры фильтрации сообщений с поддержкой дат
type MessagesFilter struct {
	ClaimIDs []int64
	FromTime *time.Time
	ToTime   *time.Time
	Limit    int
	Offset   int
}

// ReactionsFilter — параметры фильтрации реакций
type ReactionsFilter struct {
	ClaimIDs    []int64
	OperatorIDs []int64
	Like        *bool
	Reasons     []Reason
	Limit       int
	Offset      int
}
