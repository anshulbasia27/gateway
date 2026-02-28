#!/usr/bin/env node
/*
  CLI to register a custom provider. Usage examples are in docs/custom-providers.md.
  This script is intended to be executed with tsx (already used by the repo), e.g.:
    npx tsx src/cli/register-custom-provider.ts --name sample --baseUrl https://example.com --auth bearer --token SECRET
*/
import { registerCustomProvider } from '../providers/customProvider';

function printUsageAndExit(code = 0) {
  console.log('Usage: tsx src/cli/register-custom-provider.ts --name NAME --baseUrl URL --auth <none|bearer|basic|apiKey> [--token TOKEN] [--username USER] [--password PASS] [--apiKeyName HEADER_NAME] [--apiKeyValue KEY] [--description DESC]');
  process.exit(code);
}

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.replace(/^--/, '');
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
    out[key] = val;
  }
  return out;
}

async function main() {
  const raw = parseArgs(process.argv.slice(2));
  const name = raw.name;
  const baseUrl = raw.baseUrl;
  const auth = (raw.auth || 'none') as 'none' | 'bearer' | 'basic' | 'apiKey';
  const description = raw.description;

  if (!name || !baseUrl) {
    printUsageAndExit(2);
  }

  let authCfg: any = { type: 'none' };
  if (auth === 'bearer') {
    if (!raw.token) {
      console.error('Bearer auth requires --token');
      process.exit(2);
    }
    authCfg = { type: 'bearer', token: raw.token };
  } else if (auth === 'basic') {
    if (!raw.username || !raw.password) {
      console.error('Basic auth requires --username and --password');
      process.exit(2);
    }
    authCfg = { type: 'basic', username: raw.username, password: raw.password };
  } else if (auth === 'apiKey') {
    if (!raw.apiKeyName || !raw.apiKeyValue) {
      console.error('apiKey auth requires --apiKeyName and --apiKeyValue');
      process.exit(2);
    }
    authCfg = { type: 'apiKey', name: raw.apiKeyName, value: raw.apiKeyValue };
  }

  try {
    await registerCustomProvider({ name, baseUrl, auth: authCfg, description });
    console.log(`Registered provider: ${name}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to register provider:', (err as Error).message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
