import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gunzipSync } from 'zlib';

import { generatePreReleaseTag, createPreReleaseArtifact } from '../mcpHybridPreRelease';

describe('mcpHybridPreRelease', () => {
  describe('generatePreReleaseTag', () => {
    it('should return a tag containing the version and expected prefix', () => {
      const version = '1.2.3';
      const tag = generatePreReleaseTag(version);
      expect(tag).toMatch(/^mcp-hybrid-pre-release\/v1\.2\.3-/);
      expect(tag).toContain('mcp-hybrid-pre-release/v1.2.3-');
    });

    it('should throw for invalid version', () => {
      expect(() => generatePreReleaseTag('')).toThrow();
      expect(() => generatePreReleaseTag('not-a-semver')).toThrow();
    });
  });

  describe('createPreReleaseArtifact', () => {
    const tmpDir = path.join(os.tmpdir(), 'mcp-hybrid-test-' + Date.now().toString(16));

    afterAll(async () => {
      // cleanup if exists
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch (_) {
        // noop
      }
    });

    it('should create a gzipped artifact and contain expected metadata', async () => {
      const opts = {
        version: '0.1.0',
        outputDir: tmpDir,
        releaseNotes: 'Early access hybrid build for testing',
        recipients: ['epicgames@example.com'],
      };

      const filePath = await createPreReleaseArtifact(opts);
      expect(typeof filePath).toBe('string');

      const stat = await fs.stat(filePath);
      expect(stat.isFile()).toBe(true);
      expect(stat.size).toBeGreaterThan(10);

      const compressed = await fs.readFile(filePath);
      const decompressed = gunzipSync(compressed);

      const parsed = JSON.parse(decompressed.toString('utf8')) as {
        metadata: { tag: string; version: string; createdAt: string; checksum: string; recipients?: string[] };
        payloadFiles: unknown[];
      };

      expect(parsed).toHaveProperty('metadata');
      expect(parsed.metadata.version).toBe('0.1.0');
      expect(parsed.metadata.tag).toMatch(/^mcp-hybrid-pre-release\/v0\.1\.0-/);
      expect(Array.isArray(parsed.payloadFiles)).toBe(true);
      expect(parsed.metadata.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(parsed.metadata.recipients).toEqual(['epicgames@example.com']);
    });

    it('should throw when version is invalid', async () => {
      await expect(
        // @ts-expect-error passing invalid version on purpose
        createPreReleaseArtifact({ version: '', outputDir: tmpDir })
      ).rejects.toThrow();
    });
  });
});
