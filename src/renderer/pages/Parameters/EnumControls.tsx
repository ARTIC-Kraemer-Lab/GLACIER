// EnumControls.tsx
//
// Pipeline schemas sometimes offer an empty string as one of their enum
// options, meaning "none" or "leave blank". JSON Forms maps that value to an
// empty label, which MUI renders as a collapsed row (and, for multi-enum
// arrays, an unlabelled checkbox), so users cannot tell the option is there.
//
// These renderers relabel only the empty option for display. The field itself
// keeps the stock label function (option.label), so an empty selection still
// shows as a blank field rather than placeholder text, and the stored value
// stays the empty string.
import React, { useCallback, useState } from 'react';
import {
  and,
  isControl,
  isDescriptionHidden,
  isEnumControl,
  isOneOfEnumControl,
  rankWith,
  schemaMatches,
  showAsRequired,
  type ControlProps,
  type DispatchPropsOfMultiEnumControl,
  type EnumOption,
  type OwnPropsOfEnum
} from '@jsonforms/core';
import {
  withJsonFormsEnumProps,
  withJsonFormsMultiEnumProps,
  withJsonFormsOneOfEnumProps,
  withTranslateProps,
  type TranslateProps
} from '@jsonforms/react';
import { MuiAutocomplete } from '@jsonforms/material-renderers';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel
} from '@mui/material';
import { useTranslation } from 'react-i18next';

const EMPTY_OPTION_KEY = 'parameters.params.empty-option';

const hasEmptyEnumOption = (schema: any) => Array.isArray(schema?.enum) && schema.enum.includes('');

const hasEmptyOneOfOption = (schema: any) =>
  Array.isArray(schema?.oneOf) && schema.oneOf.some((sub: any) => sub?.const === '');

type EnumAutocompleteProps = ControlProps & OwnPropsOfEnum & TranslateProps;

function InnerEmptyAwareAutocomplete(props: EnumAutocompleteProps) {
  const { t } = useTranslation();
  // JsonForms' context props do not include `isValid`; the stock control passes
  // it explicitly, otherwise MUI marks every field as being in error.
  const isValid = props.errors.length === 0;
  return (
    <MuiAutocomplete
      {...props}
      isValid={isValid}
      renderOption={(optionProps: any, option: EnumOption) => {
        // MUI extracts the React key from the option props itself; spread the
        // remainder so selection/hover styling is preserved.
        const { key, ...liProps } = optionProps;
        return (
          <li key={key} {...liProps}>
            {option.label === '' ? <em>{t(EMPTY_OPTION_KEY)}</em> : option.label}
          </li>
        );
      }}
    />
  );
}

export const EnumControl = withJsonFormsEnumProps(
  withTranslateProps(React.memo(InnerEmptyAwareAutocomplete)),
  false
);

export const OneOfEnumControl = withJsonFormsOneOfEnumProps(
  withTranslateProps(React.memo(InnerEmptyAwareAutocomplete)),
  false
);

type EnumArrayProps = ControlProps & OwnPropsOfEnum & DispatchPropsOfMultiEnumControl;

function useFocus(): [boolean, () => void, () => void] {
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);
  return [focused, onFocus, onBlur];
}

// The stock multi-enum renderer cannot represent an empty-string selection:
// MUI Checkbox derives `checked` from a truthy value, so '' always renders (and
// toggles) as unchecked. Reimplemented here so the empty option behaves like
// any other entry.
function InnerEnumArrayControl(props: EnumArrayProps) {
  const { t } = useTranslation();
  const [focused, onFocus, onBlur] = useFocus();
  const {
    config,
    data,
    description,
    enabled,
    errors,
    id,
    label,
    options,
    path,
    required,
    uischema,
    visible,
    addItem,
    removeItem
  } = props;

  const appliedUiSchemaOptions = { ...(config as any), ...(uischema as any)?.options };
  const isValid = errors.length === 0;
  const showDescription = !isDescriptionHidden(
    visible,
    description,
    focused,
    appliedUiSchemaOptions.showUnfocusedDescription
  );

  if (!visible) return null;

  return (
    <FormControl
      component="fieldset"
      fullWidth={!appliedUiSchemaOptions.trim}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <FormLabel
        error={!isValid}
        component="legend"
        required={showAsRequired(required, appliedUiSchemaOptions.hideRequiredAsterisk)}
      >
        {label}
      </FormLabel>
      <FormGroup row>
        {options.map((option) => {
          const selected = Array.isArray(data) && data.includes(option.value);
          return (
            <FormControlLabel
              id={id + '-label-' + option.value}
              key={option.value}
              disabled={!enabled}
              control={
                <Checkbox
                  id={id + '-' + option.value}
                  checked={selected}
                  onChange={(ev) =>
                    ev.target.checked ? addItem(path, option.value) : removeItem(path, option.value)
                  }
                />
              }
              label={option.label === '' ? <em>{t(EMPTY_OPTION_KEY)}</em> : option.label}
            />
          );
        })}
      </FormGroup>
      <FormHelperText error={!isValid}>
        {!isValid ? errors : showDescription ? description : null}
      </FormHelperText>
    </FormControl>
  );
}

export const EnumArrayControl = withJsonFormsMultiEnumProps(
  React.memo(InnerEnumArrayControl),
  false
);

// Only take over schemas that actually offer an empty option; every other enum
// keeps the stock Material renderer (including radio groups, selects and
// file-path controls). The ranks beat the stock testers (2 for enums, 5 for
// oneOf enums and enum arrays).
export const enumControlTester = rankWith(3, and(isEnumControl, schemaMatches(hasEmptyEnumOption)));

export const oneOfEnumControlTester = rankWith(
  6,
  and(isOneOfEnumControl, schemaMatches(hasEmptyOneOfOption))
);

export const enumArrayControlTester = rankWith(
  6,
  and(
    isControl,
    schemaMatches(
      (schema: any) =>
        schema?.type === 'array' &&
        schema?.uniqueItems === true &&
        Array.isArray(schema?.items?.enum) &&
        schema.items.enum.includes('')
    )
  )
);
