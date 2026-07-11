# ToolShare web

React + Vite + TypeScript SPA over the ToolShare serverless API. Hosted on
S3 behind CloudFront (private buckets, OAC) — defined in the root
`template.yaml`, shipped by the same pipeline as the API.

## Run it — mock mode (zero setup, no AWS)

```sh
npm install
npm run dev        # http://localhost:5173
```

With no env config the app runs against an in-memory mock that mirrors the
real API's shapes and error semantics: seeded tools, simulated auth
(any email/password; verification code **123456**), and a checkout saga
whose **first payment attempt always fails** so you can see the
compensation path — the reservation rolls back to `requested` and the UI
offers a retry. State resets on reload.

## Run it — against a real stage

Copy `.env.example` to `.env.local`, fill in the stack outputs
(`ApiUrl`, `UserPoolId`, `UserPoolClientId`), set `VITE_API_MODE=real`.
Signup/login/verification are real Cognito flows (`USER_PASSWORD_AUTH`,
called directly with `fetch` — no AWS SDK in the bundle). The API is
called with the Cognito **ID token**; a 401 triggers one refresh-and-retry.

## Notes

- Tokens live in `localStorage` — the standard SPA tradeoff (XSS-readable).
  A cookie/BFF layer is deliberately out of scope for this $0-idle shape.
- Images are served by the same CloudFront distribution under `/images/*`
  (viewer-request function strips the prefix; bucket stays private).
- `npm test` runs the offline unit tests (price parity with the backend
  rule, Cognito error mapping, token decoding). `npm run build` type-checks.

## Browser E2E (Playwright)

```sh
npx playwright install --with-deps chromium   # once
npm run test:e2e
```

`e2e/golden-path.spec.ts` drives a real Chromium browser through the full
mock-mode journey in one session: sign up → verify → list a tool → rent
someone else's → checkout (the mock guarantees the first attempt fails,
so the compensation banner is always exercised) → retry → return. It runs
against `npm run dev`'s mock mode, so it needs no AWS and is safe to run
during the account freeze; CI runs it on every push (`e2e` job in
`pipeline.yml`). The same journey is the manual runbook for the first
real-stage smoke test after Phase D deploys.

## Screenshots

_Placeholder — added after the first deployed run._
