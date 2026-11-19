// Markdown rendering
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { defaultSchema } from 'hast-util-sanitize';
import { remarkAdmonitions } from './remarkAdmonitions';
import MermaidDiagram from './MermaidDiagram';
import './markdown.css';
import { useTheme } from '@mui/material/styles';
import { API } from '../../services/api.js';

function childText(node) {
  return React.Children.toArray(node)
    .map((child) => (typeof child === 'string' ? child : ''))
    .join('');
}

function isMermaidFence(node) {
  return (
    React.isValidElement(node) &&
    typeof node.props?.className === 'string' &&
    node.props.className.split(/\s+/).includes('language-mermaid')
  );
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'div', 'img'],
  attributes: {
    ...defaultSchema.attributes,
    div: ['className', 'align'],
    img: ['src', 'alt', 'width', 'height']
  }
};

export default function MarkdownRenderer({ content, basePath }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  function resolveHref(href) {
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('file://')
    ) {
      return href;
    }
    const absolute = href.startsWith('/') ? `${basePath}${href}` : `${basePath}/${href}`;
    return `file://${absolute}`;
  }

  return (
    <div className={isDark ? 'markdown-dark' : 'markdown-light'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkDirective, remarkAdmonitions]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={{
          // Render ```mermaid fences as diagrams. Overriding `pre` (rather than
          // `code`) avoids nesting the diagram inside a <pre> element.
          pre({ children }) {
            const child = React.Children.toArray(children)[0];
            if (isMermaidFence(child)) {
              return <MermaidDiagram chart={childText(child.props.children)} />;
            }
            return <pre>{children}</pre>;
          },

          // Image
          img({ src = '', alt, ...props }) {
            const isExternal =
              src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:');

            const resolvedSrc = isExternal
              ? src
              : src.startsWith('/')
                ? `${basePath}${src}`
                : `${basePath}/${src}`;

            return (
              <img {...props} src={resolvedSrc} alt={alt ?? ''} style={{ maxWidth: '100%' }} />
            );
          },

          // Link
          a({ href = '', children, ...props }) {
            const handleClick = (e) => {
              if (href.startsWith('#')) return;
              e.preventDefault();
              API.openWebPage(resolveHref(href));
            };

            return (
              <a {...props} href={href} onClick={handleClick} style={{ cursor: 'pointer' }}>
                {children}
              </a>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
