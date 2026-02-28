import { promises as fs } from 'fs';
import * as path from 'path';
import { gzip } from 'zlib';
import { promisify } from 'util';
import { createHash, randomBytes } from 'crypto';

const gzipAsync = promisify(gzip);

export interface PreReleaseOptions {
  /** Semver-style version string (e.g. "1.2.3") */
  version: string;
  /** Directory where artifact will be written */
  outputDir: string;
  /** Short human-readable release notes */
  releaseNotes?: string;
  /** List of recipient emails / customer ids for the early-access distribution */
  recipients?: string[];
}

export interface PreReleaseArtifactMetadata {
  tag: string;
  version: string;
  createdAt: string;
  releaseNotes?: string;
  recipients?: string[];
  checksum: string;
}

/**
 * Validate a basic semver-like version string. Accepts '1.2.3' or '1.2.3-alpha'
 * @param version version string to validate
 */
function validateVersion(version: string): void {
  if (typeof version !== 'string' || version.trim().length === 0) {
    throw new Error('Invalid version: must be a non-empty string');
  }
  // Basic semver-ish check
  const semverRegex = /^\d+\.\d+\.\d+(?:[-.][0-9A-Za-z-]+)?$/;
  if (!semverRegex.test(version)) {
    throw new Error('Invalid version: must match pattern MAJOR.MINOR.PATCH');
  }
}

/**
 * Generate a pre-release tag for the hybrid MCP pre-release build.
 * Example: mcp-hybrid-pre-release/v1.2.3-20260120T153012-7a3b2c1d
 * @param version semver-style version
 */
export function generatePreReleaseTag(version: string): string {
  validateVersion(version);
  const now = new Date();
  const y = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  const timestamp = `${y}${mm}${d}T${hh}${min}${ss}`;

  // Create a short deterministic-ish id using random bytes hashed with time to avoid collisions
  const rnd = randomBytes(8);
  const hash = createHash('sha1').update(rnd).digest('hex').slice(0, 8);

  return `mcp-hybrid-pre-release/v${version}-${timestamp}-${hash}`;
}

/**
 * Create a pre-release artifact file for hybrid early-access distribution.
 * The artifact is a gzipped JSON file with metadata; downstream distribution tooling
 * can wrap or sign the artifact as needed.
 *
 * Returns the full path to the artifact file on success.
 */
export async function createPreReleaseArtifact(options: PreReleaseOptions): Promise<string> {
  if (!options) {
    throw new Error('Options are required to create a pre-release artifact');
  }

  const { version, outputDir, releaseNotes, recipients } = options;
  validateVersion(version);

  if (typeof outputDir !== 'string' || outputDir.trim().length === 0) {
    throw new Error('Invalid outputDir: must be a non-empty path string');
  }

  const tag = generatePreReleaseTag(version);
  const createdAt = new Date().toISOString();

  const metadataPartial = {
    tag,
    version,
    createdAt,
    releaseNotes: releaseNotes || undefined,
    recipients: recipients && recipients.length ? recipients : undefined,
  } as Omit<PreReleaseArtifactMetadata, 'checksum'>;

  // Create canonical JSON for checksum
  const canonical = JSON.stringify(metadataPartial);
  const checksum = createHash('sha256').update(canonical).digest('hex');

  const metadata: PreReleaseArtifactMetadata = {
    ...metadataPartial,
    checksum,
  };

  const payload = {
    metadata,
    // In a real build this could include binary blobs, signatures, etc. For this
    // minimal pre-release generator we include only metadata so downstream tools
    // can attach additional artifacts before publishing.
    payloadFiles: [],
  };

  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (err) {
    throw new Error(`Failed to create output directory '${outputDir}': ${(err as Error).message}`);
  }

  const filename = `${tag}.mcppr`;
  const filePath = path.join(outputDir, filename);

  try {
    const json = JSON.stringify(payload);
    const compressed = await gzipAsync(Buffer.from(json, 'utf8'));
    await fs.writeFile(filePath, compressed);
    return filePath;
  } catch (err) {
    throw new Error(`Failed to write artifact '${filePath}': ${(err as Error).message}`);
  }
}
