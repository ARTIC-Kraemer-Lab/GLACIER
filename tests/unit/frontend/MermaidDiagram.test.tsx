import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const mermaidMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn()
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: mermaidMocks.initialize,
    render: mermaidMocks.render
  }
}));

import MermaidDiagram from '../../../src/renderer/pages/Parameters/MermaidDiagram';
import MarkdownRenderer from '../../../src/renderer/pages/Parameters/MarkdownRenderer';

const SVG = '<svg data-testid="mermaid-svg"><text>diagram</text></svg>';

function renderWithTheme(ui: React.ReactElement, mode: 'light' | 'dark' = 'light') {
  return render(<ThemeProvider theme={createTheme({ palette: { mode } })}>{ui}</ThemeProvider>);
}

describe('MermaidDiagram', () => {
  beforeEach(() => {
    mermaidMocks.initialize.mockClear();
    mermaidMocks.render.mockReset();
    mermaidMocks.render.mockResolvedValue({ svg: SVG });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a diagram as SVG', async () => {
    renderWithTheme(<MermaidDiagram chart={'flowchart LR\nA-->B'} />);

    await waitFor(() => expect(screen.getByTestId('mermaid-svg')).toBeInTheDocument());
    expect(mermaidMocks.render).toHaveBeenCalledWith(expect.any(String), 'flowchart LR\nA-->B');
  });

  it('initialises Mermaid with strict security and the light theme', async () => {
    renderWithTheme(<MermaidDiagram chart={'flowchart LR\nA-->B'} />);

    await waitFor(() => expect(mermaidMocks.render).toHaveBeenCalled());
    expect(mermaidMocks.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default'
      })
    );
  });

  it('uses the dark theme in dark mode', async () => {
    renderWithTheme(<MermaidDiagram chart={'flowchart LR\nA-->B'} />, 'dark');

    await waitFor(() => expect(mermaidMocks.render).toHaveBeenCalled());
    expect(mermaidMocks.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'dark' })
    );
  });

  it('falls back to the diagram source when rendering fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mermaidMocks.render.mockRejectedValue(new Error('bad syntax'));

    const { container } = renderWithTheme(<MermaidDiagram chart={'flowchart LR\nA-->B'} />);

    await waitFor(() => expect(screen.getByText('parameters.info.mermaid-error')).toBeTruthy());
    expect(container.querySelector('.mermaid-error pre')?.textContent).toBe('flowchart LR\nA-->B');
  });
});

describe('MarkdownRenderer Mermaid fences', () => {
  beforeEach(() => {
    mermaidMocks.initialize.mockClear();
    mermaidMocks.render.mockReset();
    mermaidMocks.render.mockResolvedValue({ svg: SVG });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders fenced mermaid blocks as diagrams', async () => {
    render(
      <MarkdownRenderer
        content={'```mermaid\nflowchart LR\n A-->B\n```'}
        basePath="/tmp/workflow"
      />
    );

    await waitFor(() => expect(screen.getByTestId('mermaid-svg')).toBeInTheDocument());
    expect(mermaidMocks.render).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('flowchart LR')
    );
  });

  it('leaves other code fences and inline code untouched', async () => {
    const { container } = render(
      <MarkdownRenderer
        content={'```js\nconst x = 1;\n```\n\nUse `mermaid` here.'}
        basePath="/tmp"
      />
    );

    expect(container.querySelector('code.language-js')).toBeTruthy();
    expect(container.querySelectorAll('code')).toHaveLength(2);
    expect(mermaidMocks.render).not.toHaveBeenCalled();
  });
});
