# Changelog

Notable changes to ToolShare AWS are documented here. Releases follow
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-07-13

### Added

- Full-stack serverless marketplace with a React/TypeScript frontend and
  authenticated API Gateway/Lambda backend.
- Cognito authentication, DynamoDB persistence, private S3/CloudFront hosting,
  and presigned tool-image uploads.
- Step Functions checkout saga with compensation, plus SNS, SQS FIFO/DLQ, and
  EventBridge event processing.
- AWS CodePipeline V2 delivery through test, staging deploy, smoke test, manual
  approval, production deploy, and production smoke-test gates.
- CodeDeploy canary traffic shifting with CloudWatch-alarm rollback.
- Offline mock mode and a Playwright golden path covering signup, listing,
  rental, checkout compensation/retry, return, browsing, and theme persistence.
- Tag-gated GitHub release validation with a packaged web artifact and SHA-256
  checksum.

[1.0.0]: https://github.com/p1tap/toolshare-aws/releases/tag/v1.0.0
