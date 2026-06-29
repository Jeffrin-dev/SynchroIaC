# Scripts

## e2e-test.js

End-to-end API test. Tests the full ingest → list → resolve flow.

Prerequisites:
- Running Next.js app (local or deployed)
- Supabase migrations applied
- A project UUID from the database

Usage:
  E2E_BASE_URL=http://localhost:3000 \
  E2E_API_KEY=sia_devkey00000000000000000000000000 \
  E2E_PROJECT_ID=<project-uuid> \
  node scripts/e2e-test.js

ARCHITECTURE REQUIREMENT — HEADLESS-FIRST (NON-NEGOTIABLE):
- All business logic, validation, auth, and billing checks must live in the API layer only.
- Frontend components are thin clients: they render UI, collect input, and call the API. Nothing else.
- No business logic inside React components, hooks, pages, or any client-side code.
- No direct database calls from the frontend. All DB access via API routes (server-side only).
- Every feature must be implementable by a completely different frontend without changing the backend.
- Auth and billing enforcement must happen server-side, never trusted from the client.
- The API contract is the product. The UI is a swappable client.
