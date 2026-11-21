import { createRequire } from 'module';
import semver from 'semver';

const require = createRequire(import.meta.url);

/** Canonical upstream repository used for release notifications. */
const RELEASES_PAGE = 'https://github.com/ARTIC-Kraemer-Lab/GLACIER/releases';
const LATEST_RELEASE_API = 'https://api.github.com/repos/ARTIC-Kraemer-Lab/GLACIER/releases/latest';

/** A successful check (with or without an update) is cached for six hours. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** Failed checks back off for ten minutes so offline installs do not retry constantly. */
const FAILURE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseUrl: string;
  publishedAt?: string;
}

export interface CheckForUpdatesOptions {
  /** Ignore the cached result and contact GitHub again. */
  force?: boolean;
}

interface CacheEntry {
  checkedAt: number;
  ttl: number;
  result: AppUpdateInfo | null;
}

let cache: CacheEntry | null = null;

/**
 * Resolve the running application version. Electron reports the packaged
 * version; the Express server falls back to package.json.
 */
export function getAppVersion(): string {
  if (process.versions?.electron) {
    try {
      const { app } = require('electron');
      if (app?.getVersion) return app.getVersion();
    } catch {
      // Fall through to package.json
    }
  }
  try {
    return String(require('../../package.json').version ?? '0.0.0');
  } catch {
    return '0.0.0';
  }
}

/** True when `latest` is a strictly newer semver release than `current`. */
export function isNewerVersion(current: string, latest: string): boolean {
  const currentVersion = semver.parse(current);
  const latestVersion = semver.parse(latest);
  if (!currentVersion || !latestVersion) return false;
  return semver.gt(latestVersion, currentVersion);
}

function updateCheckDisabled(): boolean {
  const flag = process.env?.GLACIER_DISABLE_UPDATE_CHECK;
  return flag === '1' || flag?.toLowerCase() === 'true';
}

function isValidReleaseUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(`${RELEASES_PAGE}/`);
}

async function fetchLatestRelease(currentVersion: string): Promise<AppUpdateInfo | null> {
  const response = await fetch(LATEST_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `GLACIER/${currentVersion}`,
      'X-GitHub-Api-Version': '2022-11-28'
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) return null;

  const release: any = await response.json();
  const tag = typeof release?.tag_name === 'string' ? release.tag_name.trim() : '';
  const latestVersion = semver.valid(tag);
  if (!latestVersion || !isNewerVersion(currentVersion, latestVersion)) return null;

  const name = typeof release?.name === 'string' ? release.name.trim() : '';
  return {
    currentVersion,
    latestVersion,
    releaseName: name || `v${latestVersion}`,
    releaseUrl: isValidReleaseUrl(release?.html_url) ? release.html_url : RELEASES_PAGE,
    publishedAt: typeof release?.published_at === 'string' ? release.published_at : undefined
  };
}

/**
 * Return details of a newer GLACIER release, or null when the install is up to
 * date, the check is disabled, or the request fails. Failures are logged at
 * debug level only: an update check must never disturb startup.
 */
export async function checkForUpdates(
  options: CheckForUpdatesOptions = {}
): Promise<AppUpdateInfo | null> {
  if (updateCheckDisabled()) return null;

  const now = Date.now();
  if (!options.force && cache && now - cache.checkedAt < cache.ttl) {
    return cache.result;
  }

  const currentVersion = getAppVersion();
  try {
    const result = await fetchLatestRelease(currentVersion);
    cache = { checkedAt: now, ttl: CACHE_TTL_MS, result };
    return result;
  } catch (error: any) {
    cache = { checkedAt: now, ttl: FAILURE_TTL_MS, result: null };
    if (error?.name !== 'TimeoutError' && error?.name !== 'AbortError') {
      console.debug('Could not check for GLACIER updates:', error?.message ?? error);
    }
    return null;
  }
}

/** Test helper: clear the in-memory check cache. */
export function resetUpdateCache(): void {
  cache = null;
}
