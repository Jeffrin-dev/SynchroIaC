# SynchroIaC

Infrastructure Drift Reconciliation Platform.
Detects, explains, and auto-reconciles Terraform and AWS configuration drift.

## Customer setup (3 steps)

### 1. Add to your workflow

Create .github/workflows/synchroiac.yml in your repo:

  name: Drift Check
  on:
    schedule:
      - cron: "0 9 * * 1-5"
    workflow_dispatch:
  jobs:
    drift:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: synchroiac/synchroiac@v1
          with:
            api-key: ${{ secrets.SYNCHROIAC_API_KEY }}
            project-id: ${{ secrets.SYNCHROIAC_PROJECT_ID }}
            terraform-path: ./terraform
            aws-region: us-east-1
          env:
            AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
            AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

### 2. Add secrets to your repo

  SYNCHROIAC_API_KEY    → from SynchroIaC dashboard → settings
  SYNCHROIAC_PROJECT_ID → from SynchroIaC dashboard → projects
  AWS_ACCESS_KEY_ID     → read-only IAM user credentials
  AWS_SECRET_ACCESS_KEY → read-only IAM user credentials

### 3. Required AWS IAM permissions

Attach this policy to the IAM user:
  ec2:DescribeInstances
  ec2:DescribeInstanceAttribute
  s3:ListAllMyBuckets
  s3:GetBucketLocation
  s3:GetBucketVersioning
  s3:GetBucketEncryption
  s3:GetBucketPublicAccessBlock
  s3:GetBucketLogging
  s3:GetBucketTagging
  iam:ListUsers
  iam:ListMFADevices
  iam:ListAccessKeys
  iam:GetAccessKeyLastUsed
  iam:GetLoginProfile
  iam:ListUserTags
  iam:ListAttachedUserPolicies

## Stack

Next.js · Supabase · Go · Vercel · Paddle · Resend · OpenRouter

ARCHITECTURE REQUIREMENT — HEADLESS-FIRST (NON-NEGOTIABLE):
- All business logic, validation, auth, and billing checks must live in the API layer only.
- Frontend components are thin clients: they render UI, collect input, and call the API. Nothing else.
- No business logic inside React components, hooks, pages, or any client-side code.
- No direct database calls from the frontend. All DB access via API routes (server-side only).
- Every feature must be implementable by a completely different frontend without changing the backend.
- Auth and billing enforcement must happen server-side, never trusted from the client.
- The API contract is the product. The UI is a swappable client.
