import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JsonForms } from '@jsonforms/react';
import { renderers } from '../../../src/renderer/pages/Parameters/renderers';

// tests/setup.js mocks react-i18next so t() returns the translation key.
const EMPTY_LABEL = 'parameters.params.empty-option';

const schema = {
  type: 'object',
  properties: {
    model: {
      type: 'string',
      title: 'Model',
      enum: ['', 'alpha', 'beta']
    },
    one_of_model: {
      type: 'string',
      title: 'OneOf model',
      oneOf: [{ const: '' }, { const: 'alpha' }]
    },
    tools: {
      type: 'array',
      title: 'Tools',
      uniqueItems: true,
      items: { type: 'string', enum: ['', 'samtools'] }
    },
    plain: {
      type: 'string',
      title: 'Plain choice',
      enum: ['alpha', 'beta']
    }
  }
};

const uischema = {
  type: 'VerticalLayout',
  elements: [
    { type: 'Control', scope: '#/properties/model' },
    { type: 'Control', scope: '#/properties/one_of_model' },
    { type: 'Control', scope: '#/properties/tools' },
    { type: 'Control', scope: '#/properties/plain' }
  ]
};

const renderForm = () =>
  render(<JsonForms schema={schema} uischema={uischema} data={{}} renderers={renderers} />);

const openDropdown = (combobox: HTMLElement) => {
  fireEvent.mouseDown(combobox);
};

describe('empty string enum options', () => {
  it('labels the empty option in an enum dropdown without filling the field', async () => {
    renderForm();

    const model = screen.getByRole('combobox', { name: 'Model' });
    expect(model).toHaveValue('');
    // The custom renderer must keep validation state intact
    expect(model).toHaveAttribute('aria-invalid', 'false');

    openDropdown(model);
    const emptyOption = await screen.findByRole('option', { name: EMPTY_LABEL });
    expect(emptyOption).toBeInTheDocument();

    // jsdom has no layout, so the row height is asserted in the e2e test; here
    // the visible label is the regression guard (the row was empty before).
    expect(screen.getByRole('option', { name: 'alpha' })).toBeInTheDocument();

    fireEvent.click(emptyOption);
    // Selecting the empty value must not turn into placeholder text
    expect(model).toHaveValue('');
  });

  it('labels the empty option for oneOf/const enums', async () => {
    renderForm();

    const oneOf = screen.getByRole('combobox', { name: 'OneOf model' });
    expect(oneOf).toHaveAttribute('aria-invalid', 'false');
    openDropdown(oneOf);
    expect(await screen.findByRole('option', { name: EMPTY_LABEL })).toBeInTheDocument();
  });

  it('labels the empty option for multi-enum checkbox groups and tracks its state', () => {
    renderForm();

    const emptyCheckbox = screen.getByRole('checkbox', { name: EMPTY_LABEL });
    expect(emptyCheckbox).toBeInTheDocument();
    expect(emptyCheckbox).not.toBeChecked();

    // The stock renderer derives `checked` from a truthy value, so a selected
    // empty string could never show as checked (or be unticked).
    fireEvent.click(emptyCheckbox);
    expect(emptyCheckbox).toBeChecked();

    fireEvent.click(emptyCheckbox);
    expect(emptyCheckbox).not.toBeChecked();
  });

  it('leaves enums without an empty option on the stock renderer', async () => {
    renderForm();

    const plain = screen.getByRole('combobox', { name: 'Plain choice' });
    openDropdown(plain);
    expect(await screen.findByRole('option', { name: 'alpha' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: EMPTY_LABEL })).not.toBeInTheDocument();
  });
});
