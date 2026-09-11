package handlers

import "net/http"

func HealthCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Only GET allowed", http.StatusMethodNotAllowed)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func GetUsersData(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}
