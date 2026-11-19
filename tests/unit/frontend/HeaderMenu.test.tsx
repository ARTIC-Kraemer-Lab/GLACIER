import React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import HeaderMenu from '../../../src/renderer/pages/Monitor/HeaderMenu';

const api = vi.hoisted(() => ({
  cancelWorkflowInstance: vi.fn(),
  killWorkflowInstance: vi.fn(),
  runWorkflow: vi.fn(),
  openResultsFolder: vi.fn()
}));

vi.mock('../../../src/renderer/services/api.js', () => ({ API: api }));

const runningInstance = {
  id: 'instance-1',
  name: 'sleep-1',
  workflow_version: { name: 'sleep' },
  status: 'running'
};

function renderMenu(instance = runningInstance) {
  const logMessage = vi.fn();
  const onRestart = vi.fn();
  const onRefresh = vi.fn();
  render(
    <HeaderMenu
      instance={instance}
      logMessage={logMessage}
      onRestart={onRestart}
      onRefresh={onRefresh}
    />
  );
  return { logMessage, onRestart, onRefresh };
}

async function openMenu() {
  const button = await screen.findByRole('button', { name: 'monitor.execution.actions' });
  await act(async () => {
    fireEvent.click(button);
  });
}

async function clickMenuItem(name: string) {
  await openMenu();
  const item = await screen.findByRole('menuitem', { name });
  await act(async () => {
    fireEvent.click(item);
  });
  // The confirmation dialog opens after the menu's exit transition.
  await screen.findByRole('dialog');
}

async function confirmDialog() {
  const okay = await screen.findByRole('button', { name: 'monitor.execution.confirm' });
  await act(async () => {
    fireEvent.click(okay);
  });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

beforeAll(() => {
  // MUI's Popover relies on ResizeObserver, which jsdom does not provide.
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  vi.clearAllMocks();
  api.cancelWorkflowInstance.mockResolvedValue({ ok: true, data: { stopped: true } });
  api.killWorkflowInstance.mockResolvedValue({ ok: true, data: { stopped: true } });
  api.runWorkflow.mockResolvedValue({ ok: true, data: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HeaderMenu — cancel / force cancel', () => {
  it('asks for confirmation before cancelling', async () => {
    renderMenu();

    await clickMenuItem('monitor.execution.cancel');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('monitor.execution.cancel-confirm')).toBeInTheDocument();
    expect(api.cancelWorkflowInstance).not.toHaveBeenCalled();
  });

  it('does nothing when the confirmation is dismissed', async () => {
    renderMenu();

    await clickMenuItem('monitor.execution.cancel');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    });

    expect(api.cancelWorkflowInstance).not.toHaveBeenCalled();
  });

  it('offers force cancel when a graceful cancel does not stop the run', async () => {
    api.cancelWorkflowInstance.mockResolvedValue({ ok: true, data: { stopped: false } });
    const { logMessage, onRefresh } = renderMenu();

    await clickMenuItem('monitor.execution.cancel');
    await confirmDialog();

    await waitFor(() => expect(api.cancelWorkflowInstance).toHaveBeenCalledTimes(1));
    await openMenu();
    expect(
      await screen.findByRole('menuitem', { name: 'monitor.execution.force-cancel' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'monitor.execution.cancel' })
    ).not.toBeInTheDocument();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(logMessage).toHaveBeenCalledWith('monitor.execution.cancel-unconfirmed');
  });

  it('keeps cancel and refreshes when the run stops', async () => {
    const { onRefresh } = renderMenu();

    await clickMenuItem('monitor.execution.cancel');
    await confirmDialog();

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    await openMenu();
    expect(
      screen.queryByRole('menuitem', { name: 'monitor.execution.force-cancel' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'monitor.execution.cancel' })).toBeInTheDocument();
  });

  it('force cancels and refreshes', async () => {
    api.cancelWorkflowInstance.mockResolvedValue({ ok: true, data: { stopped: false } });
    const { onRefresh } = renderMenu();

    await clickMenuItem('monitor.execution.cancel');
    await confirmDialog();
    await waitFor(() => expect(api.cancelWorkflowInstance).toHaveBeenCalled());

    await clickMenuItem('monitor.execution.force-cancel');
    expect(await screen.findByText('monitor.execution.force-cancel-confirm')).toBeInTheDocument();
    await confirmDialog();

    await waitFor(() => expect(api.killWorkflowInstance).toHaveBeenCalledTimes(1));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('does not restart while the run is still alive after a cancel attempt', async () => {
    api.cancelWorkflowInstance.mockResolvedValue({ ok: true, data: { stopped: false } });
    const { onRestart } = renderMenu();

    await clickMenuItem('monitor.execution.restart');
    await confirmDialog();

    await waitFor(() => expect(api.cancelWorkflowInstance).toHaveBeenCalledTimes(1));
    expect(onRestart).not.toHaveBeenCalled();
    await openMenu();
    expect(
      await screen.findByRole('menuitem', { name: 'monitor.execution.force-cancel' })
    ).toBeInTheDocument();
  });

  it('restarts without cancelling when the run is not running', async () => {
    const { onRestart } = renderMenu({ ...runningInstance, status: 'completed' });

    await clickMenuItem('monitor.execution.restart');
    await confirmDialog();

    await waitFor(() => expect(onRestart).toHaveBeenCalledWith('instance-1'));
    expect(api.cancelWorkflowInstance).not.toHaveBeenCalled();
  });
});
