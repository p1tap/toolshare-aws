// Post-deploy gate: hits the live stage endpoint, exits non-zero on failure.
// Usage: API_URL=https://xxx.execute-api.ap-southeast-1.amazonaws.com/staging node scripts/smoke-test.mjs

const base = process.env.API_URL;
if (!base) {
  console.error("API_URL env var is required");
  process.exit(1);
}

async function check(path, expectStatus) {
  const url = `${base}${path}`;
  const res = await fetch(url);
  if (res.status !== expectStatus) {
    console.error(`FAIL ${path}: expected ${expectStatus}, got ${res.status}`);
    process.exit(1);
  }
  console.log(`OK   ${path} -> ${res.status}`);
}

await check("/health", 200);
await check("/tools", 200);

console.log("Smoke test passed.");
