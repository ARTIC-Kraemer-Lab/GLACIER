import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressTracker from '../../../src/renderer/pages/Monitor/ProgressTracker';

const mockGetInstanceProgress = vi.hoisted(() => vi.fn());

vi.mock('../../../src/renderer/services/api.js', () => ({
  API: {
    getInstanceProgress: mockGetInstanceProgress
  }
}));

const instance = { id: 'cancelled-instance' };

describe('ProgressTracker — cancelled status', () => {
  beforeEach(() => {
    mockGetInstanceProgress.mockReset();
  });

  it('shows Cancelled when the log recorded a cancellation', async () => {
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: {
        workflow: [{ time: '12:00:00', status: 'cancelled', cause: 'SIGINT' }],
        group: [],
        instance_status: 'cancelled'
      }
    });

    render(<ProgressTracker instance={instance} />);

    const chip = await screen.findByText('monitor.progress.cancelled');
    expect(chip).toBeInTheDocument();
  });

  it('trusts the stored status when a force kill left no log entry', async () => {
    mockGetInstanceProgress.mockResolvedValue({
      ok: true,
      data: {
        workflow: [{ time: '12:00:00', status: 'running' }],
        group: [],
        instance_status: 'cancelled'
      }
    });

    render(<ProgressTracker instance={instance} />);

    expect(await screen.findByText('monitor.progress.cancelled')).toBeInTheDocument();
    expect(screen.queryByText('monitor.progress.hint-oom')).not.toBeInTheDocument();
    expect(screen.queryByText('monitor.progress.workflow-failure')).not.toBeInTheDocument();
  });
});
