package types

// ResourceState represents the observed state of a single infrastructure resource.
type ResourceState struct {
	ResourceType string
	ResourceID   string
	Attributes   map[string]string
}

// DriftItem represents a single detected difference between desired and actual infrastructure state.
type DriftItem struct {
	ResourceType string
	ResourceID   string
	Attribute    string
	DesiredValue string
	ActualValue  string
	DriftType    string
	RiskLevel    string
}

// ScanConfig contains runtime configuration for a scanner execution.
type ScanConfig struct {
	APIURL         string
	APIKey         string
	ProjectID      string
	TerraformPath  string
	AWSRegion      string
	ScannerVersion string
}
