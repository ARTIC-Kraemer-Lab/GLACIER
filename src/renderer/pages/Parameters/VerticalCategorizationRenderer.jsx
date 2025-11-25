// VerticalCategorizationRenderer.jsx
import React, { useState } from 'react';
import { rankWith, uiTypeIs } from '@jsonforms/core';
import { JsonFormsDispatch, withJsonFormsLayoutProps } from '@jsonforms/react';
import { Tabs, Tab, Box } from '@mui/material';

/**
 * Tester: match Categorization with a high rank so it overrides the default Categorization renderer.
 */
export const verticalCategorizationTester = rankWith(10, uiTypeIs('Categorization'));

/**
 * VerticalCategorization renderer
 *
 * Expects uischema to be:
 * {
 *   type: "Categorization",
 *   elements: [
 *     { type: "Category", label: "...", elements: [  ] },
 *     ...
 *   ]
 * }
 *
 * It will render Tabs vertically on the left and the raw elements for each category on the right.
 * No requirement to wrap category elements inside a VerticalLayout — JsonFormsDispatch will render each element.
 */
const VerticalCategorization = ({ uischema, schema, path, visible }) => {
  const categories = (uischema && uischema.elements) || [];
  const [value, setValue] = useState(0);

  if (!visible) return null;

  // helper to get label text (supports variations)
  const getLabel = (cat, fallbackIndex) => {
    if (!cat) return `Tab ${fallbackIndex + 1}`;
    if (typeof cat.label === 'string') return cat.label;
    if (cat.label && typeof cat.label.text === 'string') return cat.label.text;
    if (cat?.title) return cat.title;
    return `Tab ${fallbackIndex + 1}`;
  };

  return (
    <Box sx={{ display: 'flex', width: '100%', alignItems: 'stretch' }}>
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={value}
        onChange={(_, newVal) => setValue(newVal)}
        sx={{ borderRight: 1, borderColor: 'divider', minWidth: 160, flexShrink: 0 }}
      >
        {categories.map((cat, i) => (
          <Tab
            key={i}
            label={getLabel(cat, i)}
            id={`vert-tab-${i}`}
            aria-controls={`vert-tabpanel-${i}`}
          />
        ))}
      </Tabs>

      <Box sx={{ flex: 1, p: 2, minWidth: 0 }}>
        {categories.map((cat, i) => (
          <div
            role="tabpanel"
            hidden={value !== i}
            id={`vert-tabpanel-${i}`}
            aria-labelledby={`vert-tab-${i}`}
            key={i}
            style={{ width: '100%' }}
          >
            {value === i && (
              // If the Category has elements (array), render each element directly.
              // JsonFormsDispatch will pick the correct renderer for Control / Group / Layout / etc.
              <>
                {Array.isArray(cat.elements) && cat.elements.length > 0 ? (
                  cat.elements.map((child, idx) => (
                    <JsonFormsDispatch key={idx} uischema={child} schema={schema} path={path} />
                  ))
                ) : (
                  // fallback: render the category itself (some UISchema shapes keep controls directly)
                  <JsonFormsDispatch uischema={cat} schema={schema} path={path} />
                )}
              </>
            )}
          </div>
        ))}
      </Box>
    </Box>
  );
};

export default withJsonFormsLayoutProps(VerticalCategorization);
