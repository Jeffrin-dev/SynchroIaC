const BASE_URL = process.env.E2E_BASE_URL;
const API_KEY = process.env.E2E_API_KEY;
const PROJECT_ID = process.env.E2E_PROJECT_ID;

if (!BASE_URL || !API_KEY || !PROJECT_ID) {
  console.error("Missing required environment variables: E2E_BASE_URL, E2E_API_KEY, E2E_PROJECT_ID");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message ?? "Assertion failed");
}

async function api(method, path, body) {
  return fetch(BASE_URL + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log("PASS:", name);
    passed++;
  } catch (e) {
    console.error("FAIL:", name, e.message);
    failed++;
  }
}

async function runTests() {
  let scanId;
  let driftId;

  await test("GET /api/ping returns ok", async () => {
    const r = await fetch(BASE_URL + "/api/ping");
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const j = await r.json();
    assert(j.ok === true, "Expected j.ok to be true");
  });

  await test("GET /api/v1/projects returns array", async () => {
    const r = await api("GET", "/api/v1/projects");
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const j = await r.json();
    assert(Array.isArray(j.projects), "Expected j.projects to be an array");
  });

  await test("GET /api/v1/projects rejects missing api key", async () => {
    const r = await fetch(BASE_URL + "/api/v1/projects");
    assert(r.status === 401, `Expected 401, got ${r.status}`);
  });

  await test("POST /api/v1/ingest accepts valid payload", async () => {
    const r = await api("POST", "/api/v1/ingest", {
      project_id: PROJECT_ID,
      scanner_version: "0.1.0-e2e",
      aws_region: "us-east-1",
      drifts: [
        {
          resource_type: "aws_instance",
          resource_id: "i-e2etest1234567890",
          attribute: "instance_type",
          desired_value: "t3.micro",
          actual_value: "t3.large",
          drift_type: "configuration",
          risk_level: "high",
        },
        {
          resource_type: "aws_s3_bucket",
          resource_id: "my-test-bucket",
          attribute: "encryption",
          desired_value: "AES256",
          actual_value: "none",
          drift_type: "security",
          risk_level: "critical",
        },
      ],
      summary: {
        total: 2,
        critical: 1,
        high: 1,
        medium: 0,
        low: 0,
      },
    });
    assert(r.status === 201, `Expected 201, got ${r.status}`);
    const j = await r.json();
    assert(typeof j.scan_id === "string", "Expected j.scan_id to be a string");
    assert(j.drifts_recorded === 2, `Expected 2 drifts recorded, got ${j.drifts_recorded}`);
    scanId = j.scan_id;
  });

  await test("GET /api/v1/drifts returns drifts from scan", async () => {
    const r = await api("GET", "/api/v1/drifts?project_id=" + PROJECT_ID + "&resolved=false");
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const j = await r.json();
    assert(Array.isArray(j.drifts), "Expected j.drifts to be an array");
    assert(j.total >= 2, `Expected total >= 2, got ${j.total}`);
    const critical = j.drifts.find((d) => d.risk_level === "critical");
    assert(critical !== undefined, "Expected to find a critical drift");
    driftId = critical.id;
  });

  await test("GET /api/v1/drifts/:id returns single drift", async () => {
    const r = await api("GET", "/api/v1/drifts/" + driftId);
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const j = await r.json();
    assert(j.resource_type === "aws_s3_bucket", `Expected aws_s3_bucket, got ${j.resource_type}`);
    assert(j.risk_level === "critical", `Expected critical, got ${j.risk_level}`);
  });

  await test("PATCH /api/v1/drifts/:id resolve works", async () => {
    const r = await api("PATCH", "/api/v1/drifts/" + driftId, { resolved: true });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const j = await r.json();
    assert(j.resolved_at !== null, "Expected resolved_at to be not null");
  });

  await test("PATCH /api/v1/drifts/:id reopen works", async () => {
    const r = await api("PATCH", "/api/v1/drifts/" + driftId, { resolved: false });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const j = await r.json();
    assert(j.resolved_at === null, "Expected resolved_at to be null");
  });

  await test("GET /api/v1/org returns org info", async () => {
    const r = await api("GET", "/api/v1/org");
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const j = await r.json();
    assert(typeof j.org.name === "string", "Expected j.org.name to be a string");
    assert(j.api_key_preview.includes("..."), "Expected j.api_key_preview to include '...' ");
    assert(!j.api_key_preview.includes("sia_devkey"), "Expected j.api_key_preview NOT to include 'sia_devkey'");
  });

  await test("POST /api/v1/ingest rejects wrong project", async () => {
    const r = await api("POST", "/api/v1/ingest", {
      project_id: "00000000-0000-0000-0000-000000000000",
      scanner_version: "0.1.0",
      aws_region: "us-east-1",
      drifts: [],
      summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
    });
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  await test("POST /api/v1/ingest rejects missing fields", async () => {
    const r = await api("POST", "/api/v1/ingest", {
      project_id: PROJECT_ID,
    });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  console.log("\n─── E2E Results ───");
  console.log("PASSED:", passed);
  console.log("FAILED:", failed);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
