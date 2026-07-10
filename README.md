# ToolShare on AWS

Serverless re-platform of [db-toolshare](https://github.com/p1tap/db-toolshare)
(Next.js/Postgres marketplace) onto AWS, built CI/CD-first: the delivery
pipeline goes in on day one, and every feature after that ships to
production through it — canary deploy, automated smoke gate, automatic
rollback on error.

Work in progress. Architecture, module coverage, and measured numbers
land here as each piece ships.

## Current state

- HTTP API (API Gateway) → Lambda (Node 24, ARM64, AWS SDK v3) →
  DynamoDB on-demand, with per-function least-privilege IAM
- S3 presigned upload for tool images
- Unit tests (Vitest) + a post-deploy smoke gate script
- Deployed to a `staging` stack; `prod` stack and pipeline next

## Local dev

```bash
npm install
npm test
sam build && sam deploy --config-env staging
API_URL=<stack ApiUrl output> npm run smoke
```
