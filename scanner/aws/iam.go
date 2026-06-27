package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/iam"
)

// ScanIAM discovers IAM users in the configured AWS account.
func ScanIAM(ctx context.Context, cfg awssdk.Config) ([]ResourceState, error) {
	client := iam.NewFromConfig(cfg)
	resources := make([]ResourceState, 0)

	var marker *string
	for {
		out, err := client.ListUsers(ctx, &iam.ListUsersInput{Marker: marker})
		if err != nil {
			return nil, fmt.Errorf("aws.ScanIAM: ListUsers failed: %w", err)
		}

		for _, user := range out.Users {
			userName := awssdk.ToString(user.UserName)
			resources = append(resources, ResourceState{
				ResourceType: "aws_iam_user",
				ResourceID:   userName,
				Attributes: map[string]string{
					"path":                  awssdk.ToString(user.Path),
					"mfa_enabled":           iamUserMFAEnabled(ctx, client, userName),
					"access_key_count":      iamUserAccessKeyCount(ctx, client, userName),
					"access_key_last_used":  iamUserAccessKeyLastUsed(ctx, client, userName),
					"console_access":        iamUserConsoleAccess(ctx, client, userName),
					"tags":                  iamUserTags(ctx, client, userName),
					"admin_policy_attached": iamUserAdminPolicyAttached(ctx, client, userName),
				},
			})
		}

		if !out.IsTruncated || out.Marker == nil || awssdk.ToString(out.Marker) == "" {
			break
		}
		marker = out.Marker
	}

	return resources, nil
}

func iamUserMFAEnabled(ctx context.Context, client *iam.Client, userName string) string {
	var marker *string
	for {
		out, err := client.ListMFADevices(ctx, &iam.ListMFADevicesInput{UserName: awssdk.String(userName), Marker: marker})
		if err != nil {
			return iamAttributeError("ListMFADevices", userName, err)
		}
		if len(out.MFADevices) > 0 {
			return "true"
		}
		if !out.IsTruncated || out.Marker == nil || awssdk.ToString(out.Marker) == "" {
			break
		}
		marker = out.Marker
	}
	return "false"
}

func iamUserAccessKeyCount(ctx context.Context, client *iam.Client, userName string) string {
	count, err := iamUserAccessKeys(ctx, client, userName, false)
	if err != nil {
		return iamAttributeError("ListAccessKeys", userName, err)
	}
	return fmt.Sprintf("%d", count)
}

func iamUserAccessKeyLastUsed(ctx context.Context, client *iam.Client, userName string) string {
	_, err := iamUserAccessKeys(ctx, client, userName, true)
	if err != nil {
		return iamAttributeError("ListAccessKeys", userName, err)
	}
	return iamFirstActiveAccessKeyLastUsed(ctx, client, userName)
}

func iamUserAccessKeys(ctx context.Context, client *iam.Client, userName string, firstActiveOnly bool) (int, error) {
	count := 0
	var marker *string
	for {
		out, err := client.ListAccessKeys(ctx, &iam.ListAccessKeysInput{UserName: awssdk.String(userName), Marker: marker})
		if err != nil {
			return 0, err
		}
		for _, key := range out.AccessKeyMetadata {
			count++
			if firstActiveOnly && string(key.Status) == "Active" {
				return count, nil
			}
		}
		if !out.IsTruncated || out.Marker == nil || awssdk.ToString(out.Marker) == "" {
			break
		}
		marker = out.Marker
	}
	return count, nil
}

func iamFirstActiveAccessKeyLastUsed(ctx context.Context, client *iam.Client, userName string) string {
	var marker *string
	for {
		out, err := client.ListAccessKeys(ctx, &iam.ListAccessKeysInput{UserName: awssdk.String(userName), Marker: marker})
		if err != nil {
			return iamAttributeError("ListAccessKeys", userName, err)
		}
		for _, key := range out.AccessKeyMetadata {
			if string(key.Status) != "Active" {
				continue
			}
			used, err := client.GetAccessKeyLastUsed(ctx, &iam.GetAccessKeyLastUsedInput{AccessKeyId: key.AccessKeyId})
			if err != nil {
				return iamAttributeError("GetAccessKeyLastUsed", userName, err)
			}
			if used.AccessKeyLastUsed == nil || used.AccessKeyLastUsed.LastUsedDate == nil {
				return "never"
			}
			return used.AccessKeyLastUsed.LastUsedDate.Format("2006-01-02T15:04:05Z07:00")
		}
		if !out.IsTruncated || out.Marker == nil || awssdk.ToString(out.Marker) == "" {
			break
		}
		marker = out.Marker
	}
	return "never"
}

func iamUserConsoleAccess(ctx context.Context, client *iam.Client, userName string) string {
	_, err := client.GetLoginProfile(ctx, &iam.GetLoginProfileInput{UserName: awssdk.String(userName)})
	if err != nil {
		if errorContains(err, "NoSuchEntity") {
			return "disabled"
		}
		return iamAttributeError("GetLoginProfile", userName, err)
	}
	return "enabled"
}

func iamUserTags(ctx context.Context, client *iam.Client, userName string) string {
	tags := make(map[string]string)
	var marker *string
	for {
		out, err := client.ListUserTags(ctx, &iam.ListUserTagsInput{UserName: awssdk.String(userName), Marker: marker})
		if err != nil {
			return iamAttributeError("ListUserTags", userName, err)
		}
		for _, tag := range out.Tags {
			tags[awssdk.ToString(tag.Key)] = awssdk.ToString(tag.Value)
		}
		if !out.IsTruncated || out.Marker == nil || awssdk.ToString(out.Marker) == "" {
			break
		}
		marker = out.Marker
	}
	encoded, err := json.Marshal(tags)
	if err != nil {
		log.Printf("warning: aws.ScanIAM: failed to serialize tags for user %s: %v", userName, err)
		return "unknown"
	}
	return string(encoded)
}

func iamUserAdminPolicyAttached(ctx context.Context, client *iam.Client, userName string) string {
	var marker *string
	for {
		out, err := client.ListAttachedUserPolicies(ctx, &iam.ListAttachedUserPoliciesInput{UserName: awssdk.String(userName), Marker: marker})
		if err != nil {
			return iamAttributeError("ListAttachedUserPolicies", userName, err)
		}
		for _, policy := range out.AttachedPolicies {
			if awssdk.ToString(policy.PolicyName) == "AdministratorAccess" {
				return "true"
			}
		}
		if !out.IsTruncated || out.Marker == nil || awssdk.ToString(out.Marker) == "" {
			break
		}
		marker = out.Marker
	}
	return "false"
}

func iamAttributeError(operation string, userName string, err error) string {
	log.Printf("warning: aws.ScanIAM: %s failed for user %s: %v", operation, userName, err)
	return "unknown"
}
