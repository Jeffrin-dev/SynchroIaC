package terraform

import (
	"os"
	"testing"
)

func TestParseStateFile_Hardened(t *testing.T) {
	t.Run("empty file", func(t *testing.T) {
		f, _ := os.CreateTemp("", "empty.tfstate")
		defer os.Remove(f.Name())

		_, err := ParseStateFile(f.Name())
		if err == nil {
			t.Fatal("expected error for empty file, got nil")
		}
	})

	t.Run("invalid json", func(t *testing.T) {
		f, _ := os.CreateTemp("", "invalid.tfstate")
		defer os.Remove(f.Name())
		os.WriteFile(f.Name(), []byte("{invalid}"), 0644)

		_, err := ParseStateFile(f.Name())
		if err == nil {
			t.Fatal("expected error for invalid json, got nil")
		}
	})

	t.Run("missing format_version", func(t *testing.T) {
		f, _ := os.CreateTemp("", "missing_version.tfstate")
		defer os.Remove(f.Name())
		os.WriteFile(f.Name(), []byte("{\"resources\": []}"), 0644)

		_, err := ParseStateFile(f.Name())
		if err == nil {
			t.Fatal("expected error for missing format_version, got nil")
		}
	})

	t.Run("valid state", func(t *testing.T) {
		f, _ := os.CreateTemp("", "valid.tfstate")
		defer os.Remove(f.Name())
		os.WriteFile(f.Name(), []byte("{\"format_version\": \"1.0\", \"resources\": []}"), 0644)

		_, err := ParseStateFile(f.Name())
		if err != nil {
			t.Fatalf("expected no error for valid state, got %v", err)
		}
	})
}
