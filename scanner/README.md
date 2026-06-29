# SynchroIaC Scanner

Go binary that scans AWS infrastructure and Terraform state for drift.
Runs inside customer GitHub Actions. Credentials never leave
the customer environment.

## Build

  cd scanner
  go build -o synchroiac-scanner .

## Run locally

  SYNCHROIAC_API_KEY=sia_xxx \
  SYNCHROIAC_PROJECT_ID=uuid \
  TERRAFORM_PATH=./terraform \
  AWS_REGION=us-east-1 \
  ./synchroiac-scanner

## Test

  go test ./diff/... ./terraform/... -v

## Environment variables

  SYNCHROIAC_API_URL      API base URL (default: https://synchroiac.vercel.app)
  SYNCHROIAC_API_KEY      Required. Get from dashboard → settings.
  SYNCHROIAC_PROJECT_ID   Required. Get from dashboard → projects.
  TERRAFORM_PATH          Path to terraform directory (default: ./terraform)
  AWS_REGION              AWS region to scan (default: us-east-1)
  SCANNER_VERSION         Version label for scan records (default: 0.1.0)

AWS credentials are read from the standard AWS credential chain:
  AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY env vars, or
  ~/.aws/credentials, or EC2 instance role.
