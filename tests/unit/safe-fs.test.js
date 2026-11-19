import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { writeFileAtomic, writeFileAtomicSync } from '../../src/main/safe-fs.js';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-fs-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('writeFileAtomicSync', () => {
  it('writes the file and leaves no temp files behind', () => {
    const target = path.join(tmpDir, 'params.json');

    const result = writeFileAtomicSync(target, JSON.stringify({ a: 1 }));

    expect(result.ok).toBe(true);
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual({ a: 1 });
    expect(fs.readdirSync(tmpDir)).toEqual(['params.json']);
  });

  it('reports write failures and leaves no temp files behind', () => {
    const target = path.join(tmpDir, 'missing', 'params.json');

    const result = writeFileAtomicSync(target, '{}');

    expect(result.ok).toBe(false);
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });

  it('removes the temp file when the rename fails', () => {
    const target = path.join(tmpDir, 'params.json');
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('denied');
    });

    const result = writeFileAtomicSync(target, '{}');

    expect(result.ok).toBe(false);
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.readdirSync(tmpDir)).toEqual([]);
  });
});

describe('writeFileAtomic', () => {
  it('writes the file and leaves no temp files behind', async () => {
    const target = path.join(tmpDir, 'params.json');

    await writeFileAtomic(target, JSON.stringify({ a: 1 }));

    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual({ a: 1 });
    expect(fs.readdirSync(tmpDir)).toEqual(['params.json']);
  });

  it('supports concurrent writers to the same file', async () => {
    const target = path.join(tmpDir, 'params.json');

    await Promise.all(
      Array.from({ length: 40 }, (_, i) => writeFileAtomic(target, JSON.stringify({ i })))
    );

    // Whichever write landed last, the file must be complete and the directory
    // free of temp files. A shared temp path makes some renames fail with
    // ENOENT (seen on Windows CI when a launch overlaps an autosave).
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toHaveProperty('i');
    expect(fs.readdirSync(tmpDir)).toEqual(['params.json']);
  });

  it('retries a rename that is briefly refused by the OS', async () => {
    const target = path.join(tmpDir, 'params.json');
    const renameSpy = vi.spyOn(fs.promises, 'rename');
    renameSpy
      .mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'EBUSY' }))
      .mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'EPERM' }));

    await writeFileAtomic(target, JSON.stringify({ a: 1 }));

    expect(renameSpy).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))).toEqual({ a: 1 });
    renameSpy.mockRestore();
  });

  it('cleans up the temp file when renaming fails permanently', async () => {
    const target = path.join(tmpDir, 'params.json');
    const renameSpy = vi
      .spyOn(fs.promises, 'rename')
      .mockRejectedValue(Object.assign(new Error('denied'), { code: 'EPERM' }));

    await expect(writeFileAtomic(target, '{}')).rejects.toThrow('denied');

    expect(fs.existsSync(target)).toBe(false);
    expect(fs.readdirSync(tmpDir)).toEqual([]);
    renameSpy.mockRestore();
  });
});
