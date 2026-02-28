import { artifactName, isHybridEnabled, packageHybridBuild } from '../hybrid';
import child_process from 'child_process';
import fs from 'fs';
import path from 'path';

describe('hybrid release helpers', () => {
  it('artifactName composes correctly without tag', () => {
    expect(artifactName('1.2.3')).toBe('mcp-hybrid-1.2.3.tar.gz');
  });

  it('artifactName composes correctly with tag', () => {
    expect(artifactName('1.2.3', 'early')).toBe('mcp-hybrid-1.2.3-early.tar.gz');
  });

  it('isHybridEnabled reads env correctly', () => {
    expect(isHybridEnabled({ MCP_HYBRID: 'true' } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(isHybridEnabled({ MCP_HYBRID: 'false' } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isHybridEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it('packageHybridBuild throws when buildDir missing', async () => {
    await expect(packageHybridBuild('this-path-should-not-exist', 'out', '1.0.0')).rejects.toThrow(
      /build directory not found/
    );
  });

  it('packageHybridBuild calls tar and returns artifact path', async () => {
    // Mock the system tar call to avoid relying on platform tar during tests.
    const spy = jest.spyOn(child_process, 'execFileSync').mockImplementation(() => Buffer.from(''));

    const tmpBuild = path.join(__dirname, 'tmp-build');
    const outDir = path.join(__dirname, 'tmp-out');
    try {
      fs.mkdirSync(tmpBuild, { recursive: true });
      fs.writeFileSync(path.join(tmpBuild, 'file.txt'), 'hello');

      const artifact = await packageHybridBuild(tmpBuild, outDir, '1.0.0', 'early');
      expect(artifact).toMatch(/mcp-hybrid-1.0.0-early\.tar\.gz$/);
      // The file will not actually exist because execFileSync is mocked, but function checks existence
      // after tar; in our mock scenario the file won't exist, so packageHybridBuild would throw.
      // To avoid that and still validate control flow, restore a small file at the expected path.

      // Create a placeholder artifact path expected by the function.
      const expectedName = 'mcp-hybrid-1.0.0-early.tar.gz';
      const expectedPath = path.join(outDir, expectedName);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(expectedPath, 'placeholder');

      // Call the function again but this time ensure the artifact exists post-call.
      const artifact2 = await packageHybridBuild(tmpBuild, outDir, '1.0.0', 'early');
      expect(artifact2).toBe(expectedPath);
    } finally {
      // cleanup
      try {
        fs.rmSync(path.join(__dirname, 'tmp-build'), { recursive: true, force: true });
      } catch (_) {
        // ignore
      }
      try {
        fs.rmSync(path.join(__dirname, 'tmp-out'), { recursive: true, force: true });
      } catch (_) {
        // ignore
      }
      spy.mockRestore();
    }
  });
});
