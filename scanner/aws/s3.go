package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	awssdk "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	scannertypes "github.com/synchroiac/scanner/types"
)

type ResourceState = scannertypes.ResourceState

// ScanS3 discovers S3 buckets in the configured AWS account.
func ScanS3(ctx context.Context, cfg awssdk.Config) ([]ResourceState, error) {
	client := s3.NewFromConfig(cfg)
	resources := make([]ResourceState, 0)

	out, err := client.ListBuckets(ctx, &s3.ListBucketsInput{})
	if err != nil {
		return nil, fmt.Errorf("aws.ScanS3: ListBuckets failed: %w", err)
	}

	for _, bucket := range out.Buckets {
		name := awssdk.ToString(bucket.Name)
		attrs, skip := scanS3Bucket(ctx, client, name)
		if skip {
			continue
		}
		resources = append(resources, ResourceState{
			ResourceType: "aws_s3_bucket",
			ResourceID:   name,
			Attributes:   attrs,
		})
	}

	return resources, nil
}

func scanS3Bucket(ctx context.Context, client *s3.Client, bucket string) (map[string]string, bool) {
	attrs := map[string]string{
		"region":              s3BucketRegion(ctx, client, bucket),
		"versioning":          s3BucketVersioning(ctx, client, bucket),
		"encryption":          s3BucketEncryption(ctx, client, bucket),
		"public_access_block": s3BucketPublicAccessBlock(ctx, client, bucket),
		"logging":             s3BucketLogging(ctx, client, bucket),
		"tags":                s3BucketTags(ctx, client, bucket),
	}
	for _, value := range attrs {
		if value == "__skip_bucket__" {
			log.Printf("warning: aws.ScanS3: bucket %s no longer exists; skipping", bucket)
			return nil, true
		}
	}
	return attrs, false
}

func s3BucketRegion(ctx context.Context, client *s3.Client, bucket string) string {
	out, err := client.GetBucketLocation(ctx, &s3.GetBucketLocationInput{Bucket: awssdk.String(bucket)})
	if err != nil {
		return s3AttributeError("GetBucketLocation", bucket, err)
	}
	region := string(out.LocationConstraint)
	if region == "" {
		return "us-east-1"
	}
	return region
}

func s3BucketVersioning(ctx context.Context, client *s3.Client, bucket string) string {
	out, err := client.GetBucketVersioning(ctx, &s3.GetBucketVersioningInput{Bucket: awssdk.String(bucket)})
	if err != nil {
		return s3AttributeError("GetBucketVersioning", bucket, err)
	}
	status := string(out.Status)
	if status == "Enabled" || status == "Suspended" {
		return status
	}
	return "Disabled"
}

func s3BucketEncryption(ctx context.Context, client *s3.Client, bucket string) string {
	out, err := client.GetBucketEncryption(ctx, &s3.GetBucketEncryptionInput{Bucket: awssdk.String(bucket)})
	if err != nil {
		if errorContains(err, "ServerSideEncryptionConfigurationNotFoundError") || errorContains(err, "NotFound") {
			return "none"
		}
		return s3AttributeError("GetBucketEncryption", bucket, err)
	}
	if out.ServerSideEncryptionConfiguration == nil || len(out.ServerSideEncryptionConfiguration.Rules) == 0 || out.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault == nil {
		return "none"
	}
	algorithm := string(out.ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm)
	if algorithm == "AES256" || algorithm == "aws:kms" {
		return algorithm
	}
	return "none"
}

func s3BucketPublicAccessBlock(ctx context.Context, client *s3.Client, bucket string) string {
	out, err := client.GetPublicAccessBlock(ctx, &s3.GetPublicAccessBlockInput{Bucket: awssdk.String(bucket)})
	if err != nil {
		return s3AttributeError("GetPublicAccessBlock", bucket, err)
	}
	cfg := out.PublicAccessBlockConfiguration
	if cfg != nil && awssdk.ToBool(cfg.BlockPublicAcls) && awssdk.ToBool(cfg.IgnorePublicAcls) && awssdk.ToBool(cfg.BlockPublicPolicy) && awssdk.ToBool(cfg.RestrictPublicBuckets) {
		return "true"
	}
	return "false"
}

func s3BucketLogging(ctx context.Context, client *s3.Client, bucket string) string {
	out, err := client.GetBucketLogging(ctx, &s3.GetBucketLoggingInput{Bucket: awssdk.String(bucket)})
	if err != nil {
		return s3AttributeError("GetBucketLogging", bucket, err)
	}
	if out.LoggingEnabled != nil {
		return "enabled"
	}
	return "disabled"
}

func s3BucketTags(ctx context.Context, client *s3.Client, bucket string) string {
	out, err := client.GetBucketTagging(ctx, &s3.GetBucketTaggingInput{Bucket: awssdk.String(bucket)})
	if err != nil {
		if errorContains(err, "NoSuchTagSet") {
			return "{}"
		}
		return s3AttributeError("GetBucketTagging", bucket, err)
	}
	tags := make(map[string]string, len(out.TagSet))
	for _, tag := range out.TagSet {
		tags[awssdk.ToString(tag.Key)] = awssdk.ToString(tag.Value)
	}
	encoded, err := json.Marshal(tags)
	if err != nil {
		log.Printf("warning: aws.ScanS3: failed to serialize tags for bucket %s: %v", bucket, err)
		return "unknown"
	}
	return string(encoded)
}

func s3AttributeError(operation string, bucket string, err error) string {
	if errorContains(err, "NoSuchBucket") {
		return "__skip_bucket__"
	}
	log.Printf("warning: aws.ScanS3: %s failed for bucket %s: %v", operation, bucket, err)
	return "unknown"
}

func errorContains(err error, needle string) bool {
	text := fmt.Sprint(err)
	if needle == "" {
		return true
	}
	if len(needle) > len(text) {
		return false
	}
	for i := 0; i <= len(text)-len(needle); i++ {
		match := true
		for j := 0; j < len(needle); j++ {
			if text[i+j] != needle[j] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}
