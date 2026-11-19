// Renders a Mermaid fenced code block from a workflow README as an SVG diagram.
import { useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

let diagramCounter = 0;

function nextDiagramId() {
  diagramCounter += 1;
  return `mermaid-diagram-${diagramCounter}`;
}

function chartText(chart) {
  return Array.isArray(chart) ? chart.join('') : String(chart ?? '');
}

export default function MermaidDiagram({ chart }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // A fresh id for every render avoids collisions when React StrictMode runs
    // the effect twice or when the theme changes while a render is in flight.
    const id = nextDiagramId();
    setSvg('');
    setFailed(false);

    (async () => {
      try {
        // Mermaid is large, so keep it out of the initial renderer bundle.
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          suppressErrorRendering: true,
          theme: isDark ? 'dark' : 'default',
          maxTextSize: 50000,
          maxEdges: 500
        });
        const result = await mermaid.render(id, chartText(chart));
        if (!cancelled) setSvg(result.svg);
      } catch (error) {
        // Mermaid can leave its temporary render target behind on failure.
        document.getElementById(id)?.remove();
        if (!cancelled) {
          console.error('Failed to render Mermaid diagram', error);
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, isDark]);

  if (failed) {
    return (
      <div className="mermaid mermaid-error">
        <pre>{chartText(chart)}</pre>
        <span className="mermaid-error-message">{t('parameters.info.mermaid-error')}</span>
      </div>
    );
  }

  if (!svg) {
    // Show the source while Mermaid loads instead of an empty gap.
    return (
      <pre className="mermaid mermaid-loading">
        <code>{chartText(chart)}</code>
      </pre>
    );
  }

  return (
    <div
      className="mermaid"
      role="img"
      aria-label={t('parameters.info.mermaid-diagram')}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
