# Known Limitations (v0.1.0)

This document outlines intentional design decisions and known limitations of the SynchroIaC platform for the v0.1.0 release.

## 1. Concurrency Handling
- **Last-Write-Wins on Drift Updates:** When multiple users simultaneously PATCH the same drift (e.g., one resolving, one reopening), the last request processed by the database will determine the final state. This is acceptable for v0.1.0 as drift resolution is typically a manual, single-user action.
- **In-Memory Rate Limiting:** The API uses an in-memory rate limiter. This means rate limits are reset if the serverless function cold-starts or if the service is deployed across multiple instances. A Redis-backed rate limiter is planned for future versions.
- **In-Flight AI Explanations:** While the API prevents simultaneous AI explanation requests for the *same* drift ID within a single instance, concurrent requests for the same drift across different instances may still result in multiple AI calls.

## 2. Ingest API
- **Scan Atomicity:** The ingest API creates a scan record first, then inserts drifts. If the drift insertion fails, the scan is marked as `failed`. However, partial drift insertions could potentially occur if the database transaction were to fail mid-way (though Supabase/PostgreSQL usually handles this via multi-row inserts).
- **Drift Limit:** Ingestion is limited to 1,000 drifts per scan to ensure reliability and prevent timeouts in serverless environments.

## 3. GitHub Integration
- **GitHub-Only PRs:** Fix PR generation is currently limited to GitHub repositories. GitLab and Bitbucket support are on the roadmap.
- **Repository URL Format:** Only `https://github.com/` URLs are supported. SSH URLs or custom hostnames are not currently supported.

## 4. Scanner
- **Terraform Version Support:** The scanner is tested against Terraform 1.0+ state files. Older formats may not be fully compatible.
- **Composite Resource IDs:** For resources without a clear `id`, `arn`, or `name`, the scanner generates a composite ID using the resource type and name (e.g., `aws_instance.web`). This may cause duplicate reporting if multiple instances exist with the same name in different modules, though the scanner attempts to disambiguate with suffixes.
