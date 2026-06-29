## What is SynchroIaC?

SynchroIaC detects, explains, and helps reconcile drift between
your Terraform configuration and live AWS infrastructure.

Most tools tell you drift exists. SynchroIaC tells you:
- What drifted and which attribute changed
- Why it matters (security risk classification)
- How to fix it (AI-generated explanation + automated fix PR)

## How it works

1. Add the action to your workflow
2. It runs your Terraform state against live AWS APIs
3. Drift is reported to your SynchroIaC dashboard
4. Get alerts, explanations, and fix PRs automatically

## Supported AWS resources

- EC2 Instances (instance type, AMI, termination protection, tags)
- S3 Buckets (encryption, public access, versioning, logging)
- IAM Users (MFA, access keys, console access, admin policies)

More resources added each release.

## Required AWS permissions

Read-only. Uses the minimal IAM policy in docs/iam-policy.json.
Your credentials never leave your GitHub Actions environment.
SynchroIaC only receives the diff output, not raw credentials.

## Get started

1. Sign up at https://synchroiac.vercel.app
2. Create a project and copy your API key
3. Add the workflow — see README.md for the full setup
