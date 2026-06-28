package diff

import (
	"encoding/json"
	"strings"

	"github.com/synchroiac/scanner/types"
)

// DetectDrift compares desired infrastructure state against actual infrastructure
// state and returns one DriftItem for every managed difference.
func DetectDrift(
	desired []types.ResourceState,
	actual []types.ResourceState,
) []types.DriftItem {
	actualByKey := make(map[string]types.ResourceState, len(actual))
	for _, resource := range actual {
		actualByKey[resourceKey(resource.ResourceType, resource.ResourceID)] = resource
	}

	desiredByKey := make(map[string]types.ResourceState, len(desired))
	for _, resource := range desired {
		desiredByKey[resourceKey(resource.ResourceType, resource.ResourceID)] = resource
	}

	drifts := make([]types.DriftItem, 0)

	for _, resource := range desired {
		if _, exists := actualByKey[resourceKey(resource.ResourceType, resource.ResourceID)]; !exists {
			drifts = append(drifts, types.DriftItem{
				ResourceType: resource.ResourceType,
				ResourceID:   resource.ResourceID,
				Attribute:    "existence",
				DesiredValue: "exists",
				ActualValue:  "missing",
				DriftType:    "missing",
				RiskLevel:    classifyMissingRisk(resource.ResourceType),
			})
		}
	}

	for _, resource := range actual {
		if _, exists := desiredByKey[resourceKey(resource.ResourceType, resource.ResourceID)]; !exists {
			drifts = append(drifts, types.DriftItem{
				ResourceType: resource.ResourceType,
				ResourceID:   resource.ResourceID,
				Attribute:    "existence",
				DesiredValue: "missing",
				ActualValue:  "exists",
				DriftType:    "extra",
				RiskLevel:    "low",
			})
		}
	}

	for _, desiredResource := range desired {
		actualResource, exists := actualByKey[resourceKey(desiredResource.ResourceType, desiredResource.ResourceID)]
		if !exists {
			continue
		}

		for attribute, desiredValue := range desiredResource.Attributes {
			actualValue := ""
			if actualResource.Attributes != nil {
				actualValue = actualResource.Attributes[attribute]
			}

			if desiredValue != actualValue {
				drifts = append(drifts, types.DriftItem{
					ResourceType: desiredResource.ResourceType,
					ResourceID:   desiredResource.ResourceID,
					Attribute:    attribute,
					DesiredValue: desiredValue,
					ActualValue:  actualValue,
					DriftType:    classifyDriftType(desiredResource.ResourceType, attribute),
					RiskLevel:    classifyRisk(desiredResource.ResourceType, attribute, desiredValue, actualValue),
				})
			}
		}
	}

	return drifts
}

func classifyRisk(resourceType, attribute, desired, actual string) string {
	if attribute == "encryption" && actual == "none" {
		return "critical"
	}
	if attribute == "public_access_block" && actual == "false" {
		return "critical"
	}
	if attribute == "mfa_enabled" && actual == "false" {
		return "critical"
	}
	if attribute == "admin_policy_attached" && actual == "true" {
		return "critical"
	}
	if attribute == "termination_protection" && actual == "false" {
		return "critical"
	}

	if resourceType == "aws_instance" && isAny(attribute, "instance_type", "subnet_id", "vpc_id", "ami_id") {
		return "high"
	}
	if resourceType == "aws_s3_bucket" && attribute == "versioning" && actual == "Disabled" {
		return "high"
	}

	if attribute == "console_access" || isAny(attribute, "monitoring_state", "logging", "versioning", "ebs_optimized", "access_key_count", "access_key_last_used") {
		return "medium"
	}

	return "low"
}

func classifyDriftType(resourceType, attribute string) string {
	if isAny(attribute, "encryption", "public_access_block", "mfa_enabled", "admin_policy_attached", "termination_protection", "console_access") {
		return "security"
	}
	return "configuration"
}

func classifyMissingRisk(resourceType string) string {
	switch resourceType {
	case "aws_instance", "aws_s3_bucket":
		return "high"
	case "aws_iam_user":
		return "medium"
	default:
		return "medium"
	}
}

// ScanSummary counts drift items by risk level.
func ScanSummary(drifts []types.DriftItem) (total, critical, high, medium, low int) {
	total = len(drifts)
	for _, drift := range drifts {
		switch drift.RiskLevel {
		case "critical":
			critical++
		case "high":
			high++
		case "medium":
			medium++
		case "low":
			low++
		}
	}
	return total, critical, high, medium, low
}

func resourceKey(resourceType, resourceID string) string {
	encoded, _ := json.Marshal([]string{resourceType, resourceID})
	return string(encoded)
}

func isAny(value string, options ...string) bool {
	return strings.Contains("|"+strings.Join(options, "|")+"|", "|"+value+"|")
}
