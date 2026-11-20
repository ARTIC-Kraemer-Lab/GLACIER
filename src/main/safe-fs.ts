import fs from 'fs';
import path from 'path';

export interface SafeSuccess<T> {
  ok: true;
  data: T;
}

export interface SafeFailure {
  ok: false;
  error: { message: string; code?: string };
}

export type SafeResult<T> = SafeSuccess<T> | SafeFailure;

function wrap<T>(fn: () => T): SafeResult<T> {
  try {
    return { ok: true, data: fn() };
  } catch (err: any) {
    return { ok: false, error: { message: err?.message ?? 'Unknown error', code: err?.code } };
  }
}

export function readdirSync(path: string): SafeResult<string[]> {
  return wrap(() => fs.readdirSync(path));
}

export function readdirWithFileTypesSync(path: string): SafeResult<fs.Dirent[]> {
  return wrap(() => fs.readdirSync(path, { withFileTypes: true }));
}

export function readFileSync(path: string, encoding?: BufferEncoding): SafeResult<string> {
  return wrap(() => fs.readFileSync(path, encoding ?? 'utf-8'));
}

export function writeFileSync(
  path: string,
  data: string,
  options?: fs.WriteFileOptions
): SafeResult<void> {
  return wrap(() => {
    fs.writeFileSync(path, data, options);
  });
}

/**
 * Unique sibling temp path for an atomic write. Writers must not share a temp
 * file: two concurrent write+rename sequences would race and one rename would
 * fail with ENOENT (observed on Windows when a launch overlaps an autosave).
 */
let tempFileCounter = 0;
function tempFilePath(file: string): string {
  tempFileCounter += 1;
  return `${file}.${process.pid}.${Date.now()}.${tempFileCounter}.tmp`;
}

const RENAME_RETRIES = 5;
const RENAME_RETRY_DELAY_MS = 50;

/**
 * Per-destination write queues. Concurrent renames onto the same destination
 * are not safe on Windows (EPERM), so writes to a given file are serialised.
 */
const writeQueues = new Map<string, Promise<void>>();

function queueKey(file: string): string {
  const resolved = path.resolve(file);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

async function writeAtomicOnce(
  file: string,
  data: string,
  encoding: BufferEncoding
): Promise<void> {
  const tmp = tempFilePath(file);
  try {
    await fs.promises.writeFile(tmp, data, encoding);
    let lastError: unknown;
    for (let attempt = 0; attempt < RENAME_RETRIES; attempt += 1) {
      try {
        await fs.promises.rename(tmp, file);
        return;
      } catch (err: any) {
        lastError = err;
        // Windows can briefly refuse the rename while another process has the
        // destination open; retry those codes only.
        if (err?.code !== 'EPERM' && err?.code !== 'EBUSY') throw err;
        await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_DELAY_MS));
      }
    }
    throw lastError;
  } catch (err) {
    await fs.promises.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

/**
 * Write a file atomically: write to a unique temp file, then rename. Writes to
 * the same destination are serialised so they cannot rename over each other.
 */
export function writeFileAtomic(
  file: string,
  data: string,
  encoding: BufferEncoding = 'utf8'
): Promise<void> {
  const key = queueKey(file);
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(() => writeAtomicOnce(file, data, encoding));
  const settled = run.catch(() => undefined);
  writeQueues.set(key, settled);
  void settled.then(() => {
    if (writeQueues.get(key) === settled) writeQueues.delete(key);
  });
  return run;
}

export function statSync(path: string): SafeResult<fs.Stats> {
  return wrap(() => fs.statSync(path));
}

export function lstatSync(path: string): SafeResult<fs.Stats> {
  return wrap(() => fs.lstatSync(path));
}

export function mkdirSync(path: string, options?: fs.MakeDirectoryOptions): SafeResult<void> {
  return wrap(() => {
    fs.mkdirSync(path, options);
  });
}

export function rmSync(path: string, options?: fs.RmOptions): SafeResult<void> {
  return wrap(() => {
    fs.rmSync(path, options);
  });
}

export function renameSync(oldPath: string, newPath: string): SafeResult<void> {
  return wrap(() => {
    fs.renameSync(oldPath, newPath);
  });
}

export function cpSync(src: string, dest: string, options?: fs.CopySyncOptions): SafeResult<void> {
  return wrap(() => {
    fs.cpSync(src, dest, options);
  });
}

export function readdirSafe(path: string): string[] {
  try {
    return fs.readdirSync(path);
  } catch {
    return [];
  }
}

export function existsSync(path: string): boolean {
  return fs.existsSync(path);
}
