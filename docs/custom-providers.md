# Custom Providers (MCP)

This document describes how to register and consume "custom providers" so the Gateway can route to arbitrary MCP-compatible upstreams.

Overview
- A custom provider is a small configuration object containing a baseUrl and auth information.
- Once registered, the provider can be used programmatically via the provider registry or invoked using the provided CLI.

Registering via CLI

The repository includes a small CLI helper you can run with tsx (this repo already uses tsx in dev scripts).

Example (bearer auth):

  npx tsx src/cli/register-custom-provider.ts --name sample --baseUrl https://mcp.example.com --auth bearer --token YOUR_TOKEN

Example (basic auth):

  npx tsx src/cli/register-custom-provider.ts --name sample-basic --baseUrl https://mcp.example.com --auth basic --username user --password pass

Example (apiKey header):

  npx tsx src/cli/register-custom-provider.ts --name sample-api --baseUrl https://mcp.example.com --auth apiKey --apiKeyName x-api-key --apiKeyValue KEY123

Notes
- The CLI stores the provider to data/custom-providers.json in the repository root (when not running tests).
- When running tests (NODE_ENV=test), the registry uses an in-memory store to avoid side-effects.

Programmatic usage

Import the helper and call the provider:

  import { callUpstream, getCustomProvider } from '@your-repo/src/providers/customProvider';

  // call an endpoint on the provider
  const res = await callUpstream('sample', 'POST', '/v1/do', { body: { foo: 'bar' } });
  const body = await res.json();

API
- registerCustomProvider(cfg): registers a provider (name must be unique)
- getCustomProvider(name): retrieves the provider config
- callUpstream(name, method, path, opts): convenience wrapper that sets auth headers and calls the upstream

Testing
- Unit tests are added under src/providers/__tests__/customProvider.test.ts and run with the repository's jest setup.

Security
- Be careful storing secrets in the repository. The CLI writes to data/custom-providers.json by default. Use your own secret management in production.

