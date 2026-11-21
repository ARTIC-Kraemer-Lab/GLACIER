import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UpdateBanner from '../../../src/renderer/components/UpdateBanner';

const api = vi.hoisted(() => ({ checkForUpdate: vi.fn() }));

vi.mock('../../../src/renderer/services/api.js', () => ({ API: api }));

const update = {
  currentVersion: '1.0.0',
  latestVersion: '1.1.0',
  releaseName: '1.1.0',
  releaseUrl: 'https://github.com/ARTIC-Kraemer-Lab/GLACIER/releases/tag/v1.1.0'
};

describe('UpdateBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the banner with a release link when a newer version exists', async () => {
    api.checkForUpdate.mockResolvedValue({ ok: true, data: update });

    render(<UpdateBanner />);

    expect(await screen.findByText('updates.available')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'updates.download-update' });
    expect(link).toHaveAttribute('href', update.releaseUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders nothing when the installed version is up to date', async () => {
    api.checkForUpdate.mockResolvedValue({ ok: true, data: null });

    render(<UpdateBanner />);

    await waitFor(() => expect(api.checkForUpdate).toHaveBeenCalled());
    expect(document.querySelector('#update-available-banner')).toBeNull();
  });

  it('renders nothing when the check fails', async () => {
    api.checkForUpdate.mockRejectedValue(new Error('offline'));

    render(<UpdateBanner />);

    await waitFor(() => expect(api.checkForUpdate).toHaveBeenCalled());
    expect(document.querySelector('#update-available-banner')).toBeNull();
  });

  it('hides the banner for the rest of the session when dismissed', async () => {
    api.checkForUpdate.mockResolvedValue({ ok: true, data: update });

    render(<UpdateBanner />);
    await screen.findByText('updates.available');

    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));

    await waitFor(() => expect(document.querySelector('#update-available-banner')).toBeNull());
  });

  it('shows the banner again on the next launch', async () => {
    api.checkForUpdate.mockResolvedValue({ ok: true, data: update });

    const first = render(<UpdateBanner />);
    await screen.findByText('updates.available');
    first.unmount();

    render(<UpdateBanner />);

    expect(await screen.findByText('updates.available')).toBeTruthy();
    expect(api.checkForUpdate).toHaveBeenCalledTimes(2);
  });
});
