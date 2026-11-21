import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import {
  checkForUpdates,
  getAppVersion,
  isNewerVersion,
  resetUpdateCache
} from '../../src/main/updates.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));

const release = {
  tag_name: 'v9.9.9',
  name: '9.9.9',
  html_url: 'https://github.com/ARTIC-Kraemer-Lab/GLACIER/releases/tag/v9.9.9',
  published_at: '2026-01-01T00:00:00Z'
};

function mockFetch(response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(body) {
  return { ok: true, json: async () => body };
}

describe('updates', () => {
  beforeEach(() => {
    resetUpdateCache();
    delete process.env.GLIACER_DISABLE_UPDATE_CHECK;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reports the package version outside Electron', () => {
    expect(getAppVersion()).toBe(pkg.version);
  });

  it('compares versions with semver rules', () => {
    expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true);
    expect(isNewerVersion('v1.0.0', 'v1.1.0')).toBe(true);
    expect(isNewerVersion('1.2.0', '1.1.9')).toBe(false);
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(isNewerVersion('1.0.0-beta.1', '1.0.0')).toBe(true);
    expect(isNewerVersion('1.0.0', 'not-a-version')).toBe(false);
  });

  it('returns release details when a newer version is available', async () => {
    const fetchMock = mockFetch(jsonResponse(release));

    const result = await checkForUpdates({ force: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/ARTIC-Kraemer-Lab/GLACIER/releases/latest');
    expect(options.headers['User-Agent']).toBe(`GLACIER/${pkg.version}`);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(result).toMatchObject({
      currentVersion: pkg.version,
      latestVersion: '9.9.9',
      releaseName: '9.9.9',
      releaseUrl: release.html_url,
      publishedAt: release.published_at
    });
  });

  it('returns null when the installed version is up to date', async () => {
    mockFetch(jsonResponse({ ...release, tag_name: `v${pkg.version}`, name: pkg.version }));

    expect(await checkForUpdates({ force: true })).toBeNull();
  });

  it('returns null when the latest release is older than the installed version', async () => {
    mockFetch(jsonResponse({ ...release, tag_name: 'v0.0.1', name: '0.0.1' }));

    expect(await checkForUpdates({ force: true })).toBeNull();
  });

  it('returns null when GitHub responds with an error', async () => {
    mockFetch({ ok: false, status: 403, json: async () => ({}) });

    expect(await checkForUpdates({ force: true })).toBeNull();
  });

  it('returns null and logs at debug level when the request fails', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    expect(await checkForUpdates({ force: true })).toBeNull();
    expect(debug).toHaveBeenCalled();
  });

  it('stays quiet when the request times out', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));

    expect(await checkForUpdates({ force: true })).toBeNull();
    expect(debug).not.toHaveBeenCalled();
  });

  it('returns null when the release tag is missing or invalid', async () => {
    mockFetch(jsonResponse({ ...release, tag_name: undefined }));
    expect(await checkForUpdates({ force: true })).toBeNull();

    mockFetch(jsonResponse({ ...release, tag_name: 'release-candidate' }));
    expect(await checkForUpdates({ force: true })).toBeNull();
  });

  it('falls back to the releases page for untrusted links', async () => {
    mockFetch(jsonResponse({ ...release, html_url: 'https://example.com/not-github' }));

    const result = await checkForUpdates({ force: true });

    expect(result?.releaseUrl).toBe('https://github.com/ARTIC-Kraemer-Lab/GLACIER/releases');
  });

  it('caches successful checks until forced', async () => {
    const fetchMock = mockFetch(jsonResponse(release));

    await checkForUpdates();
    await checkForUpdates();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await checkForUpdates({ force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('can be disabled with GLACIER_DISABLE_UPDATE_CHECK', async () => {
    const fetchMock = mockFetch(jsonResponse(release));
    vi.stubEnv('GLACIER_DISABLE_UPDATE_CHECK', '1');

    expect(await checkForUpdates({ force: true })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
