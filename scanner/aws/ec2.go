package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/aws/aws-sdk-go-v2/service/ec2/types"
	scannertypes "github.com/synchroiac/scanner/types"
)

// ScanEC2 discovers all non-terminated EC2 instances in the configured AWS account and region.
func ScanEC2(ctx context.Context, cfg awssdk.Config) ([]scannertypes.ResourceState, error) {
	client := ec2.NewFromConfig(cfg)
	paginator := ec2.NewDescribeInstancesPaginator(client, &ec2.DescribeInstancesInput{})

	resources := make([]scannertypes.ResourceState, 0)
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return nil, fmt.Errorf("ec2.ScanEC2: DescribeInstances failed: %w", err)
		}

		for _, reservation := range page.Reservations {
			for _, instance := range reservation.Instances {
				if instance.State != nil && instance.State.Name == types.InstanceStateNameTerminated {
					continue
				}

				instanceID := awssdk.ToString(instance.InstanceId)
				attrs := map[string]string{
					"instance_type":          string(instance.InstanceType),
					"state":                  instanceStateName(instance.State),
					"ami_id":                 awssdk.ToString(instance.ImageId),
					"subnet_id":              awssdk.ToString(instance.SubnetId),
					"vpc_id":                 awssdk.ToString(instance.VpcId),
					"key_name":               awssdk.ToString(instance.KeyName),
					"monitoring_state":       monitoringState(instance.Monitoring),
					"ebs_optimized":          strconv.FormatBool(awssdk.ToBool(instance.EbsOptimized)),
					"termination_protection": terminationProtection(ctx, client, instanceID),
					"tags":                   serializeTags(instance.Tags),
				}

				resources = append(resources, scannertypes.ResourceState{
					ResourceType: "aws_instance",
					ResourceID:   instanceID,
					Attributes:   attrs,
				})
			}
		}
	}

	return resources, nil
}

func instanceStateName(state *types.InstanceState) string {
	if state == nil {
		return ""
	}
	return string(state.Name)
}

func monitoringState(monitoring *types.Monitoring) string {
	if monitoring == nil {
		return ""
	}
	if monitoring.State == types.MonitoringStateEnabled {
		return "enabled"
	}
	return "disabled"
}

func terminationProtection(ctx context.Context, client *ec2.Client, instanceID string) string {
	if instanceID == "" {
		return "unknown"
	}

	out, err := client.DescribeInstanceAttribute(ctx, &ec2.DescribeInstanceAttributeInput{
		Attribute:  types.InstanceAttributeNameDisableApiTermination,
		InstanceId: awssdk.String(instanceID),
	})
	if err != nil {
		log.Printf("warning: ec2.ScanEC2: DescribeInstanceAttribute disableApiTermination failed for %s: %v", instanceID, err)
		return "unknown"
	}
	if out.DisableApiTermination == nil {
		return "unknown"
	}
	return strconv.FormatBool(awssdk.ToBool(out.DisableApiTermination.Value))
}

func serializeTags(tags []types.Tag) string {
	tagMap := make(map[string]string, len(tags))
	for _, tag := range tags {
		tagMap[awssdk.ToString(tag.Key)] = awssdk.ToString(tag.Value)
	}

	encoded, err := json.Marshal(tagMap)
	if err != nil {
		log.Printf("warning: ec2.ScanEC2: failed to serialize tags: %v", err)
		return "{}"
	}
	return string(encoded)
}
