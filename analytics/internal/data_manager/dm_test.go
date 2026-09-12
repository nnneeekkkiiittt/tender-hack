package datamanager

import (
	"analytics/internal/models"
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Read-only integration check against an explicitly supplied demo/test database.
func TestCurrentSchema(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL for the read-only integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	m := New(pool)
	if _, err := m.GetRawUsersData(ctx, models.UsersFilter{Roles: []models.UserRole{"admin"}, Limit: 100}); err != nil {
		t.Fatal(err)
	}
	if _, err := m.GetRawClaimsData(ctx, models.ClaimsFilter{Statuses: []models.Status{"NEW"}, Limit: 100}); err != nil {
		t.Fatal(err)
	}
	if _, err := m.GetRawReactionsData(ctx, models.ReactionsFilter{Limit: 100}); err != nil {
		t.Fatal(err)
	}
	if _, err := m.GetRawReactionsData(ctx, models.ReactionsFilter{Reasons: []models.Reason{"INCORRECT ANSWER"}, Limit: 100}); err != nil {
		t.Fatal(err)
	}
}
