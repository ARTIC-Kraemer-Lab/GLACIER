import { visit } from 'unist-util-visit';

const ADMONITION_TYPES = ['note', 'warning', 'tip', 'important', 'info'];

export function remarkAdmonitions() {
  return (tree) => {
    // GitHub style: > [!NOTE]
    visit(tree, 'blockquote', (node, index, parent) => {
      if (!parent || !node.children?.length) return;

      const first = node.children[0];
      if (first.type !== 'paragraph' || !first.children?.length) return;

      const textNode = first.children[0];
      if (textNode.type !== 'text') return;

      const match = textNode.value.match(/^\[!(NOTE|WARNING|TIP|IMPORTANT|INFO)\]\s*\n?/i);
      if (!match) return;

      const kind = match[1].toLowerCase();

      // strip the marker
      textNode.value = textNode.value.replace(match[0], '');

      // remove empty paragraph if needed
      if (!textNode.value.trim() && first.children.length === 1) {
        node.children.shift();
      }

      parent.children[index] = createAdmonition(kind, node.children);
    });

    // Remark style: :::note
    visit(tree, 'containerDirective', (node) => {
      if (!ADMONITION_TYPES.includes(node.name)) return;

      Object.assign((node.data ??= {}), {
        hName: 'div',
        hProperties: {
          className: ['admonition', `admonition-${node.name}`]
        }
      });
    });
  };
}

function createAdmonition(kind, children) {
  return {
    type: 'containerDirective',
    name: kind,
    children,
    data: {
      hName: 'div',
      hProperties: {
        className: ['admonition', `admonition-${kind}`]
      }
    }
  };
}
