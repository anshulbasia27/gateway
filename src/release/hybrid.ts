import fs from 'fs';
import path from 'path';
import child_process from 'child_process';

/**
 * Compute artifact file name for a MCP hybrid pre-release.
 *
 * @param version - semantic version string (required)
 * @param tag - optional tag segment to append (e.g. 'early')
 * @returns artifact file name like `mcp-hybrid-1.2.3-early.tar.gz`
 */
export function artifactName(version: string, tag?: string): string {
  if (!version) {
    throw new Error('version is required');
  }
  const base = `mcp-hybrid-${version}`;
  return tag ? `${base}-${tag}.tar.gz` : `${base}.tar.gz`;
}

/**
 * Detect whether hybrid mode is enabled via environment variable.
 *
 * @param env - environment to inspect (defaults to process.env)
 * @returns true when MCP_HYBRID === 'true'
 */
export function isHybridEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_HYBRID === 'true';
}

/**
 * Package a build directory into a tar.gz artifact using system tar.
 * The function is intentionally small and relies on the system tar binary which is available
 * on the CI runner and most hybrid customers' build hosts.
 *
 * @param buildDir - source build directory to package (relative or absolute)
 * @param outDir - output directory where artifact will be written
 * @param version - semantic version string used in artifact name
 * @param tag - optional tag (e.g. 'early') appended to artifact name
 * @returns absolute path to created artifact
 */
export async function packageHybridBuild(
  buildDir: string,
  outDir: string,
  version: string,
  tag?: string
): Promise<string> {
  if (!version) {
    throw new Error('version is required');
  }

  const absBuild = path.resolve(buildDir);
  if (!fs.existsSync(absBuild) || !fs.statSync(absBuild).isDirectory()) {
    throw new Error(`build directory not found: ${absBuild}`);
  }

  const absOut = path.resolve(outDir);
  await fs.promises.mkdir(absOut, { recursive: true });

  const name = artifactName(version, tag);
  const dest = path.join(absOut, name);

  try {
    // Use system tar to produce a compressed archive. We intentionally use execFileSync
    // to keep the implementation minimal and avoid adding new dependencies.
    child_process.execFileSync('tar', ['-czf', dest, '-C', absBuild, '.'], { stdio: 'ignore' });
  } catch (err) {
    throw new Error(`failed to create artifact: ${String(err)}`);
  }

  if (!fs.existsSync(dest) || !fs.statSync(dest).isFile()) {
    throw new Error('artifact not created');
  }

  return dest;
}
