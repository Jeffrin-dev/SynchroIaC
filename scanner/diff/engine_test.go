package diff

import (
	"testing"

	"github.com/synchroiac/scanner/types"
)

func TestDetectDrift(t *testing.T) {
	tests := []struct {
		name          string
		desired       []types.ResourceState
		actual        []types.ResourceState
		wantCount     int
		wantDriftType string
		wantRiskLevel string
		wantAttribute string
		wantActual    string
		wantDesired   string
	}{
		{name: "empty desired and actual returns empty drift list", wantCount: 0},
		{
			name:          "resource in desired but not actual is missing",
			desired:       []types.ResourceState{{ResourceType: "aws_instance", ResourceID: "i-123"}},
			wantCount:     1,
			wantDriftType: "missing",
			wantRiskLevel: "high",
			wantAttribute: "existence",
			wantDesired:   "exists",
			wantActual:    "missing",
		},
		{
			name:          "resource in actual but not desired is extra",
			actual:        []types.ResourceState{{ResourceType: "aws_s3_bucket", ResourceID: "logs"}},
			wantCount:     1,
			wantDriftType: "extra",
			wantRiskLevel: "low",
			wantAttribute: "existence",
			wantDesired:   "missing",
			wantActual:    "exists",
		},
		{
			name:          "same resource with differing managed attribute is configuration drift",
			desired:       []types.ResourceState{{ResourceType: "aws_s3_bucket", ResourceID: "logs", Attributes: map[string]string{"name": "desired-name"}}},
			actual:        []types.ResourceState{{ResourceType: "aws_s3_bucket", ResourceID: "logs", Attributes: map[string]string{"name": "actual-name"}}},
			wantCount:     1,
			wantDriftType: "configuration",
			wantRiskLevel: "low",
			wantAttribute: "name",
			wantDesired:   "desired-name",
			wantActual:    "actual-name",
		},
		{
			name:          "encryption none is critical security drift",
			desired:       []types.ResourceState{{ResourceType: "aws_s3_bucket", ResourceID: "logs", Attributes: map[string]string{"encryption": "AES256"}}},
			actual:        []types.ResourceState{{ResourceType: "aws_s3_bucket", ResourceID: "logs", Attributes: map[string]string{"encryption": "none"}}},
			wantCount:     1,
			wantDriftType: "security",
			wantRiskLevel: "critical",
			wantAttribute: "encryption",
		},
		{
			name:          "instance type change is high risk",
			desired:       []types.ResourceState{{ResourceType: "aws_instance", ResourceID: "i-123", Attributes: map[string]string{"instance_type": "t3.large"}}},
			actual:        []types.ResourceState{{ResourceType: "aws_instance", ResourceID: "i-123", Attributes: map[string]string{"instance_type": "t3.micro"}}},
			wantCount:     1,
			wantDriftType: "configuration",
			wantRiskLevel: "high",
			wantAttribute: "instance_type",
		},
		{
			name:          "tags change is low risk",
			desired:       []types.ResourceState{{ResourceType: "aws_instance", ResourceID: "i-123", Attributes: map[string]string{"tags": "env=prod"}}},
			actual:        []types.ResourceState{{ResourceType: "aws_instance", ResourceID: "i-123", Attributes: map[string]string{"tags": "env=dev"}}},
			wantCount:     1,
			wantDriftType: "configuration",
			wantRiskLevel: "low",
			wantAttribute: "tags",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			drifts := DetectDrift(tt.desired, tt.actual)
			if len(drifts) != tt.wantCount {
				t.Fatalf("DetectDrift() returned %d drifts, want %d: %#v", len(drifts), tt.wantCount, drifts)
			}
			if tt.wantCount == 0 {
				return
			}

			drift := drifts[0]
			if drift.DriftType != tt.wantDriftType {
				t.Errorf("DriftType = %q, want %q", drift.DriftType, tt.wantDriftType)
			}
			if drift.RiskLevel != tt.wantRiskLevel {
				t.Errorf("RiskLevel = %q, want %q", drift.RiskLevel, tt.wantRiskLevel)
			}
			if drift.Attribute != tt.wantAttribute {
				t.Errorf("Attribute = %q, want %q", drift.Attribute, tt.wantAttribute)
			}
			if tt.wantDesired != "" && drift.DesiredValue != tt.wantDesired {
				t.Errorf("DesiredValue = %q, want %q", drift.DesiredValue, tt.wantDesired)
			}
			if tt.wantActual != "" && drift.ActualValue != tt.wantActual {
				t.Errorf("ActualValue = %q, want %q", drift.ActualValue, tt.wantActual)
			}
		})
	}
}

func TestScanSummary(t *testing.T) {
	drifts := []types.DriftItem{
		{RiskLevel: "critical"},
		{RiskLevel: "high"},
		{RiskLevel: "high"},
		{RiskLevel: "medium"},
		{RiskLevel: "low"},
		{RiskLevel: "low"},
	}

	total, critical, high, medium, low := ScanSummary(drifts)
	if total != 6 || critical != 1 || high != 2 || medium != 1 || low != 2 {
		t.Fatalf("ScanSummary() = (%d, %d, %d, %d, %d), want (6, 1, 2, 1, 2)", total, critical, high, medium, low)
	}
}
