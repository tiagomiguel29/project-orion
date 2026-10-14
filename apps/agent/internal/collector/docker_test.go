package collector

import "testing"

func TestDeriveHealth(t *testing.T) {
	tests := []struct {
		state  string
		status string
		want   string
	}{
		{"running", "Up 2 minutes (healthy)", "healthy"},
		{"running", "Up 2 minutes (unhealthy)", "unhealthy"},
		{"running", "Up 2 minutes (health: starting)", "starting"},
		{"running", "Up 2 minutes", "running"},
		{"exited", "Exited (1) 2 minutes ago", "exited"},
	}
	for _, tt := range tests {
		if got := deriveHealth(tt.state, tt.status); got != tt.want {
			t.Errorf("deriveHealth(%q, %q) = %q, want %q", tt.state, tt.status, got, tt.want)
		}
	}
}
