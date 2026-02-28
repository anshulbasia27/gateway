# MCP Hybrid Early-Access (Pre-release) — Instructions & Checklist

This document provides instructions for creating, publishing, and verifying a hybrid-targeted MCP pre-release artifact for early-access customers (Epic Games and other hybrid deployments).

Purpose
- Provide a reproducible pre-release artifact for hybrid/on-prem + cloud mixed environments so hybrid customers can validate MCP behavior before general beta rollout.

What this change delivers
- A small utility in the repository to generate a pre-release tag and a compressed artifact (metadata payload) representing the hybrid pre-release. This artifact can be uploaded to the agreed early-access channel for distribution.
- Documentation with step-by-step install/distribution guidance and a short hybrid-specific test checklist.

Generating the artifact (developer steps)
1. Build or run the generator (TypeScript library is located at src/lib/mcpHybridPreRelease.ts). Example usage in a Node/TS context:

```ts
import { createPreReleaseArtifact } from './src/lib/mcpHybridPreRelease';

await createPreReleaseArtifact({
  version: '0.1.0',
  outputDir: '/tmp/mcp-hybrid-preleases',
  releaseNotes: 'Hybrid early-access build for Epic Games',
  recipients: ['epicgames@example.com'],
});
```

2. The generator will produce a file named like:

   mcp-hybrid-pre-release/v0.1.0-20260120T153012-7a3b2c1d.mcppr

   The file is a gzipped JSON containing metadata and placeholder payloadFiles. Downstream distribution tooling can wrap, sign, or attach binaries to this artifact as needed.

Publishing the artifact to the early-access channel
- Agreed early-access channel: (example) S3 bucket `s3://portkey-early-access/mcp/hybrid/` or private artifact repo. Use the team's secure upload mechanism.
- Suggested path: `s3://portkey-early-access/mcp/hybrid/<tag>/<artifact>`
- Attach release notes document and test checklist.

Credential & access handoff (for Epic Games and other hybrid customers)
- Provide the following to the designated customer contacts via the agreed secure channel (Do not send secrets over plain email):
  - Download location (S3 URL or pre-signed URL) and expiry
  - Installation user and group (if applicable) and notes about required ports
  - Short list of required credentials (API keys, CA certs) and instructions for where to place them on-prem
  - Contact for immediate support (Slack/Email) and instructions for reporting smoke-test results

Credential placeholders (replace before sending):
- Early-access download URL: https://example-bucket.s3.amazonaws.com/mcp/hybrid/<tag>/<artifact>
- Installation account: `mcp-install` (on-prem user), or instructions for container deployment
- API key placeholder: `PORTKEY_MCP_EARLY_ACCESS_KEY=<REDACTED>`

Short hybrid-specific test checklist (for Epic Games / hybrid customers)
1. Installation
   - [ ] Artifact downloaded and verified checksum matches metadata.checksum.
   - [ ] Installation completes without error on a hybrid node (on-prem component + cloud connector).
2. Connectivity
   - [ ] On-prem MCP can establish outbound TLS connections to the control plane endpoints (if required) using the provided network rules.
   - [ ] Hybrid routing rules are respected (traffic intended for on-prem targets stays local; cloud fallback works when on-prem is paused).
3. Functional tests
   - [ ] Simple request routed to a local model target returns expected response within SLA.
   - [ ] Failure scenario: simulate an on-prem model failure and verify fallback to cloud target succeeds.
4. Telemetry & logs
   - [ ] Logs show clear startup/shutdown lifecycle messages and show hybrid routing decisions.
   - [ ] Exported metrics appear in the designated metrics endpoint (if configured).
5. Security
   - [ ] Credentials and secrets are not present in logs.
   - [ ] Mutual TLS/certs are validated (if configured) and connection fails when certs are invalid.
6. Cleanup
   - [ ] Uninstall or stop the pre-release build without leaving sensitive files on disk.

Smoke test confirmation (build owner checklist)
- [ ] Upload artifact to early-access channel and verify accessibility.
- [ ] Share credentials and instructions with Epic Games contacts through the agreed secure channel.
- [ ] Collect initial smoke-test confirmation from Epic Games (success/failure, logs, and any blocking issues).

Notes & next steps
- This repository change produces a metadata artifact and documentation. For production-ready release artifacts (signed binaries, installers, or container images), use your standard release pipeline to wrap/sign/build platform-specific installers from this metadata.
- After early-access validation and any fixes, the team should promote the artifact into the normal beta release pipeline and publish official installers or container images as appropriate.

Contact
- Build owner: @platform-build-owner (replace with actual owner) — confirm receipt and initial smoke test results.
