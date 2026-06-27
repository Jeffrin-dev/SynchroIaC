package terraform

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/synchroiac/scanner/types"
)

type tfState struct {
	FormatVersion string       `json:"format_version"`
	TFVersion     string       `json:"terraform_version"`
	Resources     []tfResource `json:"resources"`
}

type tfResource struct {
	Mode      string       `json:"mode"`
	Type      string       `json:"type"`
	Name      string       `json:"name"`
	Provider  string       `json:"provider"`
	Instances []tfInstance `json:"instances"`
}

type tfInstance struct {
	Attributes map[string]any `json:"attributes"`
}

// ParseStateFile reads a terraform.tfstate JSON file and returns managed resources.
func ParseStateFile(path string) ([]types.ResourceState, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("terraform state file not found at path: %s", path)
		}

		return nil, err
	}

	var state tfState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}

	idCounts := map[string]int{}
	for _, resource := range state.Resources {
		if resource.Mode != "managed" {
			continue
		}

		for _, instance := range resource.Instances {
			idCounts[resourceID(resource, instance)]++
		}
	}

	seenIDs := map[string]int{}
	resources := make([]types.ResourceState, 0)
	for _, resource := range state.Resources {
		if resource.Mode != "managed" {
			continue
		}

		for _, instance := range resource.Instances {
			id := resourceID(resource, instance)
			if idCounts[id] > 1 {
				seenIDs[id]++
				id = fmt.Sprintf("%s_%d", id, seenIDs[id])
			}

			resources = append(resources, types.ResourceState{
				ResourceType: resource.Type,
				ResourceID:   id,
				Attributes:   flattenAttributes(instance.Attributes),
			})
		}
	}

	return resources, nil
}

// FindStateFile returns the first Terraform state file found in a supported path.
func FindStateFile(terraformPath string) (string, error) {
	paths := []string{
		terraformPath + "/terraform.tfstate",
		terraformPath + "/.terraform/terraform.tfstate",
	}

	if strings.HasSuffix(terraformPath, ".tfstate") {
		paths = append(paths, terraformPath)
	}

	for _, path := range paths {
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	return "", fmt.Errorf("no terraform.tfstate found in %s", terraformPath)
}

func resourceID(resource tfResource, instance tfInstance) string {
	for _, key := range []string{"id", "arn", "name"} {
		if value, ok := instance.Attributes[key].(string); ok && value != "" {
			return value
		}
	}

	return fmt.Sprintf("%s.%s", resource.Type, resource.Name)
}

func flattenAttributes(attributes map[string]any) map[string]string {
	flattened := make(map[string]string, len(attributes))
	for key, value := range attributes {
		switch v := value.(type) {
		case nil:
			continue
		case string:
			flattened[key] = v
		case bool:
			if v {
				flattened[key] = "true"
			} else {
				flattened[key] = "false"
			}
		case float64:
			flattened[key] = fmt.Sprintf("%v", v)
		case map[string]any, []any:
			if jsonValue, err := json.Marshal(v); err == nil {
				flattened[key] = string(jsonValue)
			}
		default:
			flattened[key] = fmt.Sprintf("%v", v)
		}
	}

	return flattened
}
