import fs from 'fs';

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

/** Write a file atomically: write to a unique temp file, then rename. */
export function writeFileAtomicSync(
  file: string,
  data: string,
  options?: fs.WriteFileOptions
): SafeResult<void> {
  const tmp = tempFilePath(file);
  const writeResult = writeFileSync(tmp, data, options);
  if (!writeResult.ok) {
    rmSync(tmp, { force: true });
    return writeResult;
  }
  const renameResult = renameSync(tmp, file);
  if (!renameResult.ok) {
    rmSync(tmp, { force: true });
    return renameResult;
  }
  return { ok: true, data: undefined };
}

const RENAME_RETRIES = 3;
const RENAME_RETRY_DELAY_MS = 25;

/**
 * Async variant of writeFileAtomicSync. Windows can briefly refuse the rename
 * while another process has the destination open, so retry EPERM/EBUSY.
 */
export async function writeFileAtomic(
  file: string,
  data: string,
  encoding: BufferEncoding = 'utf8'
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
